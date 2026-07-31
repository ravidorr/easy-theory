#!/usr/bin/env python3
"""Validate the local private-car question release against the Ministry XML.

This deliberately parses the original RSS independently of parse_questions.py:
it checks the B licence subset, each question's four options and one answer
marker, the approved topic mapping, source hash, and every referenced image.
"""

import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
XML_PATH = ROOT / "seeds" / "theoryexam.xml"
SEED_PATH = ROOT / "seeds" / "questions.sql"
MANIFEST_PATH = ROOT / "content" / "reviews" / "release.json"
CAR_B = "В"  # Cyrillic capital Ve, the private-car licence marker in the feed.
TOPICS = {"תמרורים", "חוקי התנועה", "בטיחות", "הכרת הרכב"}
LI_RE = re.compile(r"<li>(.*?)</li>", re.DOTALL)
CORRECT_RE = re.compile(r"id=['\"]correctAnswer(\d+)['\"]")
LICENSE_RE = re.compile(r"«([^»]+)»")
IMG_RE = re.compile(r'<img[^>]+src="([^"]+)"')
TITLE_RE = re.compile(r"^(\d+)\.\s*(.+)", re.DOTALL)
SEED_NUMBER_RE = re.compile(r"\('(?:signs|traffic-laws|safety|vehicle)',\s*(\d+),")


def fail(errors: list[str]) -> None:
    for error in errors:
        print(f"question-bank: {error}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    errors: list[str] = []
    if not XML_PATH.exists():
        fail([f"missing Ministry XML snapshot: {XML_PATH.relative_to(ROOT)}"])

    checksum = hashlib.sha256(XML_PATH.read_bytes()).hexdigest()
    manifest = json.loads(MANIFEST_PATH.read_text())
    source = next((entry for entry in manifest["sources"] if entry["kind"] == "question_bank"), None)
    if not source or source.get("sourceChecksum") != checksum:
        errors.append("Ministry XML SHA-256 does not match the review manifest")

    channel = ET.parse(XML_PATH).getroot().find("channel")
    if channel is None:
        errors.append("Ministry XML has no RSS channel")
        fail(errors)

    seen: set[int] = set()
    valid_numbers: set[int] = set()
    for item in channel.findall("item"):
        description = (item.findtext("description") or "").strip()
        licences = LICENSE_RE.findall(description)
        if CAR_B not in licences:
            continue
        title = (item.findtext("title") or "").strip()
        title_match = TITLE_RE.match(title)
        if not title_match:
            errors.append(f"B-licence item has no numbered question: {title[:80]}")
            continue
        number = int(title_match.group(1))
        if number in seen:
            errors.append(f"duplicate B-licence question number {number}")
        seen.add(number)

        topic = (item.findtext("category") or "").strip()
        if topic not in TOPICS:
            errors.append(f"question {number} has unknown topic {topic!r}")

        options = LI_RE.findall(description)
        answer_markers = CORRECT_RE.findall(description)
        if len(options) != 4:
            errors.append(f"question {number} has {len(options)} options, expected 4")
        matching_markers = [marker for marker in answer_markers if int(marker) == number]
        if len(matching_markers) != 1 or len(answer_markers) != 1:
            errors.append(f"question {number} does not have exactly one correct answer marker")

        image = IMG_RE.search(description)
        if image:
            filename = Path(urlparse(image.group(1)).path).name
            if not filename or not (ROOT / "public" / "questions" / filename).is_file():
                correct_option = next((option for option in options if "correctAnswer" in option), "")
                correct_text = re.sub(r"<[^>]+>", "", correct_option).strip()
                fallback = ROOT / "public" / "signs" / f"sign-{correct_text}.png"
                if not re.fullmatch(r"\d{2,4}", correct_text) or not fallback.is_file():
                    errors.append(f"question {number} references unavailable image {filename or image.group(1)}")
        valid_numbers.add(number)

    seeded_numbers = {int(value) for value in SEED_NUMBER_RE.findall(SEED_PATH.read_text())}
    if seeded_numbers != valid_numbers:
        missing = sorted(valid_numbers - seeded_numbers)
        unexpected = sorted(seeded_numbers - valid_numbers)
        if missing:
            errors.append(f"seed missing B-licence question numbers: {missing}")
        if unexpected:
            errors.append(f"seed contains non-B or unknown question numbers: {unexpected}")

    if errors:
        fail(errors)
    print(f"Ministry B-licence question bank validated: {len(valid_numbers)} questions, SHA-256 {checksum}")


if __name__ == "__main__":
    main()
