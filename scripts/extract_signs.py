#!/usr/bin/env python3
"""
One-time pipeline: extract sign images and Hebrew text from the official
Israeli traffic-sign chart PDF (לות"ם ספטמבר 2022) and produce:
  - public/signs/sign-{number}.png  — one PNG per sign
  - seeds/signs.sql                 — INSERT statements for the signs table

Usage:
  python3 scripts/extract_signs.py <path-to-pdf>
"""

import os
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from html import unescape
from pathlib import Path

# ── paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
SIGNS_OUT = PROJECT_ROOT / "public" / "signs"
SEEDS_OUT = PROJECT_ROOT / "seeds" / "signs.sql"
TMP_XML_DIR = Path("/tmp/signs-extract")

# ── sign-number regex: 3-4 digits, optional פ (illuminated variant) ─────────
SIGN_NUMBER_RE = re.compile(r"^\d{3,4}[פ]?$")

# ── category by number prefix ────────────────────────────────────────────────
def category_for(number: str) -> str:
    n = int(re.sub(r"[^\d]", "", number))
    if 100 <= n <= 199:
        return "warning"
    if 200 <= n <= 299:
        return "mandatory"
    if 300 <= n <= 399:
        return "right_of_way"
    if 400 <= n <= 499:
        return "prohibition"
    if 500 <= n <= 599:
        return "road_marking"
    if 600 <= n <= 699:
        return "guidance"
    if 700 <= n <= 799:
        return "traffic_light"
    if 800 <= n <= 899:
        return "road_surface"
    return "other"


# ── reverse Hebrew text from PDF visual-order storage ───────────────────────
def fix_hebrew(raw: str) -> str:
    """
    PDF stores RTL text in visual (left-to-right) order within each fragment.
    Reversing a single fragment's characters yields correct logical Hebrew.
    Do NOT concatenate fragments before calling this — reverse each individually.
    """
    fixed = raw[::-1].strip()
    fixed = re.sub(r"\s+", " ", fixed)
    return fixed


def join_tokens(tokens_sorted_rtl: list) -> str:
    """
    Given tokens already sorted in RTL reading order (highest left first),
    reverse each individually and join with a space.
    """
    parts = [fix_hebrew(t["raw"]) for t in tokens_sorted_rtl if t["raw"].strip()]
    return " ".join(p for p in parts if p)


# Matches a lone Hebrew letter (article/fragment) at the start of a string
_LONE_LETTER_PREFIX = re.compile(r"^[א-ת]\s+")

def clean_description(text: str) -> str:
    """Remove common PDF extraction artifacts from a description string."""
    if not text:
        return text
    # Remove stray lone Hebrew letter at the very start (e.g. "ה ", "מ ")
    text = _LONE_LETTER_PREFIX.sub("", text)
    # Remove repeated spaces
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


# ── extract XML + images via pdftohtml ───────────────────────────────────────
def extract_xml(pdf_path: Path) -> Path:
    TMP_XML_DIR.mkdir(parents=True, exist_ok=True)
    xml_out = TMP_XML_DIR / "signs.xml"
    print(f"Running pdftohtml -xml (pages 7–94)…")
    subprocess.run(
        [
            "pdftohtml", "-xml", "-f", "7", "-l", "94",
            "-nodrm", str(pdf_path), str(xml_out),
        ],
        check=True,
        capture_output=True,
    )
    print(f"  → XML written to {xml_out}")
    return xml_out


# ── parse a single page ───────────────────────────────────────────────────────
def parse_page(page_elem):
    """Return (images, text_tokens) for a page element."""
    images = []
    tokens = []

    for child in page_elem:
        if child.tag == "image":
            src = child.get("src", "")
            top = int(child.get("top", 0))
            left = int(child.get("left", 0))
            w = int(child.get("width", 0))
            h = int(child.get("height", 0))
            images.append({"top": top, "left": left, "w": w, "h": h, "src": src})

        elif child.tag == "text":
            raw = unescape("".join(child.itertext())).strip()
            if not raw:
                continue
            bold = child.find(".//b") is not None
            top = int(child.get("top", 0))
            left = int(child.get("left", 0))
            tokens.append({"top": top, "left": left, "raw": raw, "bold": bold})

    return images, tokens


# ── find sign-number tokens on a page ─────────────────────────────────────────
def find_sign_numbers(tokens, page_width: int):
    """
    Sign numbers are bold integers (3-4 digits, optional פ) in the
    right-side zone (left > ~35% of page width).
    Returns list of {number, top, left} dicts, sorted by top.
    """
    threshold = page_width * 0.35
    candidates = []
    for t in tokens:
        if t["bold"] and t["left"] >= threshold and SIGN_NUMBER_RE.match(t["raw"]):
            candidates.append({"number": t["raw"], "top": t["top"], "left": t["left"]})
    # Deduplicate (same number/top can appear as separate char-fragments in some pages)
    seen = set()
    unique = []
    for c in sorted(candidates, key=lambda x: x["top"]):
        key = (c["number"], c["top"])
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique


# ── assign the closest image to each sign number ─────────────────────────────
def assign_images(sign_numbers, images, page_width: int):
    """
    For each sign number, find the image in the right-side column
    whose vertical centre is closest (within 200px) to the sign-number's top.
    Returns list of (sign_info, image | None).
    """
    img_zone_left = page_width * 0.55   # images are right-column
    right_images = [img for img in images if img["left"] >= img_zone_left]

    result = []
    for sign in sign_numbers:
        best_img = None
        best_dist = 999
        for img in right_images:
            img_center = img["top"] + img["h"] / 2
            dist = abs(sign["top"] - img_center)
            if dist < best_dist and dist < 200:
                best_dist = dist
                best_img = img
        result.append((sign, best_img))
    return result


# ── collect description text for each sign ───────────────────────────────────
def collect_descriptions(sign_numbers, tokens, page_width: int, page_height: int):
    """
    For each sign, collect non-bold text tokens between its top and the
    next sign's top (or page bottom).

    The page has two text columns (RTL):
      - Col 3 "פירוש" (meaning): roughly left > 22% of page width
      - Col 4 "כוחו יפה" (validity/where applies): left <= 22%

    We use col-3 text as name_he and combine both as full_description.
    Each token is reversed individually before joining (PDF stores RTL in
    visual order, so per-fragment reversal gives correct logical Hebrew).

    Returns dict: sign_number -> {"name": str, "full": str}
    """
    meaning_threshold = page_width * 0.22   # ~151px on standard 688-wide page

    boundaries = [(s["top"], s["number"]) for s in sign_numbers]
    boundaries.append((page_height - 120, None))

    descriptions = {}
    for i, (top_start, number) in enumerate(boundaries[:-1]):
        top_end = boundaries[i + 1][0]

        block = [
            t for t in tokens
            if top_start - 20 <= t["top"] < top_end
            and not t["bold"]
            and t["top"] > 100
            and t["top"] < page_height - 120
        ]

        # Group into rows (10px vertical tolerance)
        rows: list[list] = []
        for t in sorted(block, key=lambda x: x["top"]):
            if rows and abs(t["top"] - rows[-1][0]["top"]) <= 10:
                rows[-1].append(t)
            else:
                rows.append([t])

        meaning_parts = []
        validity_parts = []

        for row in rows:
            # Within each row sort RTL: highest left value = read first
            row.sort(key=lambda x: -x["left"])
            meaning_row = [t for t in row if t["left"] > meaning_threshold]
            validity_row = [t for t in row if t["left"] <= meaning_threshold]
            if meaning_row:
                meaning_parts.append(join_tokens(meaning_row))
            if validity_row:
                validity_parts.append(join_tokens(validity_row))

        name = " ".join(p for p in meaning_parts if p)
        validity = " ".join(p for p in validity_parts if p)
        full = (name + " " + validity).strip() if validity else name

        descriptions[number] = {"name": name, "full": full}
    return descriptions


# ── copy image to public/signs/ with proper name ─────────────────────────────
def copy_sign_image(img_src: str, sign_number: str) -> str:
    src = Path(img_src)
    if not src.exists():
        # pdftohtml sometimes strips path prefix — try TMP_XML_DIR
        src = TMP_XML_DIR / src.name
    if not src.exists():
        return ""
    dest_name = f"sign-{sign_number}.png"
    dest = SIGNS_OUT / dest_name
    shutil.copy2(src, dest)
    return f"/signs/{dest_name}"


# ── SQL escaping ──────────────────────────────────────────────────────────────
def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


# ── main ──────────────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2:
        print(f"Usage: python3 {sys.argv[0]} <pdf-path>")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"Error: {pdf_path} not found")
        sys.exit(1)

    # Clear existing extracted signs
    SIGNS_OUT.mkdir(parents=True, exist_ok=True)
    for f in SIGNS_OUT.glob("*.png"):
        f.unlink()

    # Run pdftohtml
    xml_path = extract_xml(pdf_path)

    # Parse XML
    print("Parsing XML…")
    tree = ET.parse(xml_path)
    root = tree.getroot()

    signs = []   # list of {number, description, image_path, category}
    seen_numbers = set()
    skipped_pages = []

    for page in root.findall("page"):
        page_num = page.get("number")
        page_width = int(page.get("width", 688))
        page_height = int(page.get("height", 969))

        images, tokens = parse_page(page)
        sign_numbers = find_sign_numbers(tokens, page_width)

        if not sign_numbers:
            skipped_pages.append(page_num)
            continue

        assignments = assign_images(sign_numbers, images, page_width)
        descriptions = collect_descriptions(sign_numbers, tokens, page_width, page_height)

        for sign_info, img in assignments:
            number = sign_info["number"]
            if number in seen_numbers:
                continue   # skip duplicate (same sign on multiple pages)
            seen_numbers.add(number)

            desc = descriptions.get(number, {"name": "", "full": ""})
            image_path = ""
            if img:
                image_path = copy_sign_image(img["src"], number)

            if not image_path:
                print(f"  ⚠ No image found for sign {number} (page {page_num})")

            name = clean_description(desc["name"])
            full = clean_description(desc["full"])
            # If meaning column gave nothing, fall back to full (both columns)
            if not name:
                name = full
            signs.append({
                "number": number,
                "name": name,
                "full": full,
                "image_path": image_path,
                "category": category_for(number),
            })

    signs.sort(key=lambda s: int(re.sub(r"[^\d]", "", s["number"])))

    print(f"\nExtracted {len(signs)} signs")
    print(f"Skipped pages (no sign numbers found): {skipped_pages[:10]}{'…' if len(skipped_pages) > 10 else ''}")

    # Write SQL seed
    SEEDS_OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(SEEDS_OUT, "w", encoding="utf-8") as f:
        f.write("-- Auto-generated by scripts/extract_signs.py\n")
        f.write("-- Source: לות\"ם ספטמבר 2022 (ק\"ת 10328, 13.09.2022)\n\n")
        f.write("INSERT INTO signs (id, sign_number, name_he, meaning_he, image_path, category) VALUES\n")
        rows = []
        for s in signs:
            name = (s["name"] or s["number"])[:120]
            meaning = (s["full"] or s["name"] or "")[:300]
            rows.append(
                f"  (gen_random_uuid(), {sql_str(s['number'])}, "
                f"{sql_str(name)}, "
                f"{sql_str(meaning)}, "
                f"{sql_str(s['image_path'])}, "
                f"{sql_str(s['category'])})"
            )
        f.write(",\n".join(rows))
        f.write(";\n")

    print(f"SQL seed written to {SEEDS_OUT}")
    print(f"Sign images written to {SIGNS_OUT}/")

    # Print a sample
    print("\nSample output (first 15 signs):")
    for s in signs[:15]:
        print(f"  {s['number']:>6}  [{s['category']:<13}]  name: {s['name'][:55]}")


if __name__ == "__main__":
    main()
