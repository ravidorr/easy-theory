#!/usr/bin/env python3
"""
Audit sign SVG files for content mismatches by checking sodipodi:docname.
For each mismatch, falls back to the PNG if available.
Outputs a SQL UPDATE statement to fix image_path in the signs table.
"""

import os
import re
import sys

SIGNS_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "signs")

docname_re = re.compile(r'sodipodi:docname="([^"]+)"')
number_re = re.compile(r'\b(\d+)\.svg')


def get_docname_number(svg_path):
    with open(svg_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read(4096)  # docname is always near the top
    m = docname_re.search(content)
    if not m:
        return None
    docname = m.group(1)
    nm = number_re.search(docname)
    return int(nm.group(1)) if nm else None


def main():
    mismatches = []
    no_docname = []
    ok = []

    svg_files = sorted(
        f for f in os.listdir(SIGNS_DIR) if f.startswith("sign-") and f.endswith(".svg")
    )

    for fname in svg_files:
        m = re.match(r"sign-(\d+)\.svg$", fname)
        if not m:
            continue
        file_number = int(m.group(1))
        svg_path = os.path.join(SIGNS_DIR, fname)
        docname_number = get_docname_number(svg_path)

        if docname_number is None:
            no_docname.append(file_number)
        elif docname_number != file_number:
            png_exists = os.path.exists(os.path.join(SIGNS_DIR, f"sign-{file_number}.png"))
            mismatches.append((file_number, docname_number, png_exists))
        else:
            ok.append(file_number)

    print(f"Total SVGs checked: {len(svg_files)}")
    print(f"  Correct:          {len(ok)}")
    print(f"  Mismatched:       {len(mismatches)}")
    print(f"  No docname:       {len(no_docname)}")

    if mismatches:
        print("\nMismatched signs (file_number → actual docname number, png_available):")
        for file_num, doc_num, has_png in mismatches:
            print(f"  sign-{file_num}.svg contains sign {doc_num}  [png: {'yes' if has_png else 'NO'}]")

        can_fix = [(n, has_png) for n, _, has_png in mismatches if has_png]
        cannot_fix = [(n, doc) for n, doc, has_png in mismatches if not has_png]

        print(f"\nCan fix with PNG fallback: {len(can_fix)}")
        print(f"Cannot fix (no PNG):       {len(cannot_fix)}")

        if cannot_fix:
            print("\nSigns with no PNG fallback:")
            for n, doc in cannot_fix:
                print(f"  sign-{n} (contains sign {doc})")

        if can_fix:
            print("\n-- SQL to fix image_path (paste into Supabase SQL editor):")
            print("UPDATE signs SET image_path = CASE sign_number")
            for n, _ in can_fix:
                print(f"  WHEN '{n}' THEN '/signs/sign-{n}.png'")
            print("END")
            print(f"WHERE sign_number IN ({', '.join(repr(str(n)) for n, _ in can_fix)});")

    if no_docname:
        print(f"\nSVGs without sodipodi:docname (cannot validate):")
        for n in no_docname:
            print(f"  sign-{n}.svg")


if __name__ == "__main__":
    main()
