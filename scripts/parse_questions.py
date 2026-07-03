#!/usr/bin/env python3
"""
One-time pipeline: download the official theory exam XML from data.gov.il,
parse 1,802 questions for car license (Cyrillic В), download 599 question
images, and emit:
  - seeds/topics.sql
  - seeds/questions.sql
  - public/questions/{number}.jpg  (downloaded images)

Usage:
  python3 scripts/parse_questions.py
"""

import os
import re
import ssl
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

# data.gov.il uses a cert chain that Python 3.9 on macOS doesn't trust
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE
_OPENER = urllib.request.build_opener(urllib.request.HTTPSHandler(context=_SSL_CTX))
urllib.request.install_opener(_OPENER)

# ── paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
QUESTIONS_OUT = PROJECT_ROOT / "public" / "questions"
SEEDS_OUT     = PROJECT_ROOT / "seeds"

XML_URL = (
    "https://data.gov.il/dataset/618dd157-8df3-43e7-bf9a-00974b4919e9"
    "/resource/8c0f314f-583d-48b6-9f5f-4483d95f6848"
    "/download/theoryexamhe-data.xml"
)
XML_CACHE = PROJECT_ROOT / "seeds" / "theoryexam.xml"

# Image base URL (HTTP — downloaded at seed time to avoid mixed-content)
IMG_BASE_HTTP  = "http://tqpic.mot.gov.il/"
IMG_BASE_HTTPS = "https://tqpic.mot.gov.il/"

# Car (B) license in the XML uses Cyrillic В (U+0412)
CAR_B = "В"

# Category → topic slug mapping
CATEGORY_TOPIC: dict[str, dict] = {
    "תמרורים": {
        "slug": "signs",
        "name_he": "תמרורים",
        "description_he": "הכרת תמרורי הדרך ומשמעותם",
        "order_index": 1,
        "icon": "/signs/sign-302.png",
    },
    "חוקי התנועה": {
        "slug": "traffic-laws",
        "name_he": "חוקי התנועה",
        "description_he": "כללי הנסיעה, קדימויות וחובות הנהג",
        "order_index": 2,
        "icon": "/signs/sign-301.png",
    },
    "בטיחות": {
        "slug": "safety",
        "name_he": "בטיחות",
        "description_he": "נסיעה בטוחה, חגורות ומרחק בטיחות",
        "order_index": 3,
        "icon": "/signs/sign-131.png",
    },
    "הכרת הרכב": {
        "slug": "vehicle",
        "name_he": "הכרת הרכב",
        "description_he": "מערכות הרכב, תחזוקה ומכניקה בסיסית",
        "order_index": 4,
        "icon": "/signs/sign-110.png",
    },
}


# ── SQL helpers ───────────────────────────────────────────────────────────────
def sql_str(s: str) -> str:
    return "'" + (s or "").replace("'", "''") + "'"


def sql_arr(items: list[str]) -> str:
    escaped = ["'" + x.replace("'", "''") + "'" for x in items]
    return "ARRAY[" + ",".join(escaped) + "]"


# ── Download XML ──────────────────────────────────────────────────────────────
def ensure_xml() -> Path:
    if XML_CACHE.exists():
        print(f"Using cached XML at {XML_CACHE}")
        return XML_CACHE

    print(f"Downloading XML from {XML_URL} …")
    SEEDS_OUT.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(XML_URL, XML_CACHE)
    print(f"  → saved to {XML_CACHE} ({XML_CACHE.stat().st_size:,} bytes)")
    return XML_CACHE


# ── Parse XML ─────────────────────────────────────────────────────────────────
# The feed is RSS 2.0.  Each <item> has:
#   <title>NNNN. question text</title>
#   <description><![CDATA[ HTML with <ul><li> answers, optional <img>, license span ]]></description>
#   <category>תמרורים</category>
#
# Inside the CDATA HTML:
#   - <li><span [id="correctAnswerNNNN"]>answer text</span></li>  (4 answers)
#   - <img src="http://tqpic.mot.gov.il/3NNNN.jpg">              (optional image)
#   - <span style="float: left;">| «В» | «A» | … | </span>       (license types)

_SPAN_TEXT_RE  = re.compile(r'<span[^>]*>(.*?)</span>', re.DOTALL)
_CORRECT_ID_RE = re.compile(r'id="correctAnswer(\d+)"')
_IMG_SRC_RE    = re.compile(r'<img[^>]+src="([^"]+)"')
_LICENSE_RE    = re.compile(r'«([^»]+)»')
_LI_RE         = re.compile(r'<li>(.*?)</li>', re.DOTALL)


def _strip_tags(html: str) -> str:
    return re.sub(r'<[^>]+>', '', html).strip()


def parse_questions(xml_path: Path) -> list[dict]:
    """Parse RSS theory exam XML; return car-B questions only."""
    tree = ET.parse(xml_path)
    root = tree.getroot()

    # RSS: root → channel → item*
    channel = root.find("channel")
    items = channel.findall("item") if channel is not None else root.findall(".//item")
    print(f"  Found {len(items)} raw items in XML")

    questions = []
    skipped = 0

    for item in items:
        title_el = item.find("title")
        desc_el  = item.find("description")
        cat_el   = item.find("category")

        if title_el is None or desc_el is None:
            continue

        title_text = (title_el.text or "").strip()
        desc_html  = (desc_el.text or "").strip()
        topic_raw  = (cat_el.text or "").strip() if cat_el is not None else ""

        # ── Filter by license type ────────────────────────────────────────────
        license_types = _LICENSE_RE.findall(desc_html)
        if CAR_B not in license_types:
            skipped += 1
            continue

        # ── Question number + text from <title> ───────────────────────────────
        m = re.match(r'^(\d+)\.\s*(.*)', title_text, re.DOTALL)
        if not m:
            continue
        q_num   = int(m.group(1))
        q_text  = m.group(2).strip()

        # ── Parse answers from <li> items ─────────────────────────────────────
        li_matches = _LI_RE.findall(desc_html)
        options_raw = []
        correct_idx = 0
        for i, li_html in enumerate(li_matches[:4]):
            # Check if this li contains the correct answer span
            if f'id="correctAnswer{q_num}"' in li_html:
                correct_idx = i
            # Strip all tags to get plain text
            text = _strip_tags(li_html)
            options_raw.append(text)

        if len(options_raw) < 4:
            continue  # malformed item

        # ── Image ─────────────────────────────────────────────────────────────
        img_m = _IMG_SRC_RE.search(desc_html)
        img_filename = ""
        img_url      = ""
        if img_m:
            img_src      = img_m.group(1)
            img_filename = Path(img_src).name          # e.g. "31073.jpg"
            img_url      = f"/questions/{img_filename}"

        option_map = ["a", "b", "c", "d"]
        correct_option = option_map[correct_idx]
        correct_value = options_raw[correct_idx].strip()

        # If the correct answer IS a sign number (2-3 digits) and we have no
        # downloaded image, use the local sign PNG instead of leaving empty.
        if (not img_url or img_url.startswith("/questions/")) and \
           re.fullmatch(r'\d{2,4}', correct_value):
            local_sign = Path(PROJECT_ROOT) / "public" / "signs" / f"sign-{correct_value}.png"
            if local_sign.exists():
                img_url = f"/signs/sign-{correct_value}.png"

        questions.append({
            "question_number": q_num,
            "question_he":     q_text,
            "option_a":        options_raw[0],
            "option_b":        options_raw[1],
            "option_c":        options_raw[2],
            "option_d":        options_raw[3],
            "correct_option":  correct_option,
            "image_filename":  img_filename,
            "image_url":       img_url,
            "license_types":   license_types,
            "topic_raw":       topic_raw,
        })

    print(f"  Parsed {len(questions)} car-B questions (skipped {skipped} other licenses)")
    return questions


# ── Download question images ───────────────────────────────────────────────────
def download_images(questions: list[dict]) -> int:
    QUESTIONS_OUT.mkdir(parents=True, exist_ok=True)
    need = [q for q in questions if q["image_filename"]]
    print(f"\nDownloading {len(need)} question images …")

    done = 0
    failed = 0
    for q in need:
        fname = Path(q["image_filename"]).name
        dest = QUESTIONS_OUT / fname
        if dest.exists() and dest.stat().st_size > 500:
            done += 1
            continue

        for base in [IMG_BASE_HTTPS, IMG_BASE_HTTP]:
            url = base + q["image_filename"]
            try:
                urllib.request.urlretrieve(url, dest)
                if dest.stat().st_size > 500:
                    done += 1
                    break
                dest.unlink(missing_ok=True)
            except Exception:
                continue
        else:
            failed += 1
            # Keep local path even if download failed — quiz page checks existence server-side

        if (done + failed) % 50 == 0:
            print(f"  {done} downloaded, {failed} failed …")
        time.sleep(0.05)  # gentle rate limit

    print(f"  Done: {done} images, {failed} failures")
    return done


# ── Write SQL ──────────────────────────────────────────────────────────────────
def write_topics_sql(questions: list[dict]) -> None:
    topics_seen = {}
    for q in questions:
        raw = q["topic_raw"]
        for cat, meta in CATEGORY_TOPIC.items():
            if cat in raw or raw in cat:
                if meta["slug"] not in topics_seen:
                    topics_seen[meta["slug"]] = meta
                break

    # Always emit all 4 topics even if no questions found yet
    all_topics = list(CATEGORY_TOPIC.values())

    path = SEEDS_OUT / "topics.sql"
    with open(path, "w", encoding="utf-8") as f:
        f.write("-- Auto-generated by scripts/parse_questions.py\n\n")
        f.write("INSERT INTO topics (id, slug, name_he, description_he, order_index, icon) VALUES\n")
        rows = []
        for meta in all_topics:
            rows.append(
                f"  (gen_random_uuid(), {sql_str(meta['slug'])}, "
                f"{sql_str(meta['name_he'])}, "
                f"{sql_str(meta.get('description_he', ''))}, "
                f"{meta['order_index']}, "
                f"{sql_str(meta.get('icon', ''))})"
            )
        f.write(",\n".join(rows))
        f.write("\nON CONFLICT (slug) DO NOTHING;\n")
    print(f"Topics SQL → {path}")


def write_questions_sql(questions: list[dict]) -> None:
    path = SEEDS_OUT / "questions.sql"

    # Build topic slug lookup (match by raw topic description)
    def topic_slug(raw: str) -> str:
        for cat, meta in CATEGORY_TOPIC.items():
            if cat in raw or raw in cat:
                return meta["slug"]
        return "traffic-laws"  # fallback

    with open(path, "w", encoding="utf-8") as f:
        f.write("-- Auto-generated by scripts/parse_questions.py\n")
        f.write("-- Insert questions referencing topics by slug lookup.\n\n")
        f.write("INSERT INTO questions\n")
        f.write("  (id, topic_id, question_number, question_he,\n")
        f.write("   option_a, option_b, option_c, option_d,\n")
        f.write("   correct_option, image_url, license_types)\n")
        f.write("SELECT\n")
        f.write("  gen_random_uuid(), t.id, v.question_number, v.question_he,\n")
        f.write("  v.option_a, v.option_b, v.option_c, v.option_d,\n")
        f.write("  v.correct_option, v.image_url, v.license_types\n")
        f.write("FROM (VALUES\n")

        rows = []
        for q in questions:
            slug = topic_slug(q["topic_raw"])
            rows.append(
                f"  ({sql_str(slug)}, {q['question_number']}, "
                f"{sql_str(q['question_he'])}, "
                f"{sql_str(q['option_a'])}, {sql_str(q['option_b'])}, "
                f"{sql_str(q['option_c'])}, {sql_str(q['option_d'])}, "
                f"{sql_str(q['correct_option'])}, "
                f"{sql_str(q['image_url'])}, "
                f"{sql_arr(q['license_types'])})"
            )
        f.write(",\n".join(rows))
        f.write(
            "\n) AS v(topic_slug, question_number, question_he,"
            "\n       option_a, option_b, option_c, option_d,"
            "\n       correct_option, image_url, license_types)\n"
        )
        f.write("JOIN topics t ON t.slug = v.topic_slug\n")
        f.write("ON CONFLICT (question_number) DO UPDATE SET image_url = EXCLUDED.image_url;\n")

    print(f"Questions SQL → {path}  ({len(questions)} rows)")


# ── main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    print("=== parse_questions.py ===\n")

    xml_path = ensure_xml()

    print("\nParsing questions …")
    questions = parse_questions(xml_path)

    # Print topic breakdown
    from collections import Counter
    topic_counts = Counter(q["topic_raw"] for q in questions)
    print("\nTopic breakdown:")
    for topic, count in sorted(topic_counts.items(), key=lambda x: -x[1]):
        print(f"  {count:4d}  {topic}")

    download_images(questions)

    SEEDS_OUT.mkdir(parents=True, exist_ok=True)
    write_topics_sql(questions)
    write_questions_sql(questions)

    print(f"\nDone. {len(questions)} questions ready to seed.")
    print("Next: run seeds/schema.sql + seeds/topics.sql + seeds/questions.sql + seeds/signs.sql in Supabase.")


if __name__ == "__main__":
    main()
