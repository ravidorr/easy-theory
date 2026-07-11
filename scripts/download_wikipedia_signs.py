#!/usr/bin/env python3
"""
Download high-quality SVG sign images from Wikimedia Commons.

For each sign number in public/signs/, this script:
  1. Batch-queries the Wikimedia Commons API (50 files per request) to find SVG URLs
  2. Falls back to Israel_road_sign_{number}a.svg if the plain version is missing
  3. Downloads each found SVG to public/signs/sign-{number}.svg
  4. Writes seeds/signs_wikipedia_patch.sql to update image_path in the DB

Usage:
  python3 scripts/download_wikipedia_signs.py
"""

import json
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

# macOS Python ships without system certs; bypass verification for public Wikimedia downloads
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
SIGNS_DIR = PROJECT_ROOT / "public" / "signs"
SEEDS_DIR = PROJECT_ROOT / "seeds"
PATCH_SQL = SEEDS_DIR / "signs_wikipedia_patch.sql"

API_BASE = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "easy-theory-sign-downloader/1.0 (educational project)"

API_BATCH_SIZE = 50   # Wikimedia API max titles per query
API_BATCH_DELAY = 1.0 # seconds between batch API calls
DOWNLOAD_DELAY = 30.0 # seconds between file downloads (conservative to avoid rate limits)
DOWNLOAD_RETRIES = 2  # retry attempts per file
RETRY_BACKOFF = 60.0  # seconds to wait on retry


def batch_get_image_urls(filenames: list) -> dict:
    """
    Query up to API_BATCH_SIZE filenames at once via the Wikimedia API.
    Returns {filename_without_File_prefix: direct_url} for files that exist.
    """
    titles = "|".join(f"File:{fn}" for fn in filenames)
    params = urllib.parse.urlencode({
        "action": "query",
        "titles": titles,
        "prop": "imageinfo",
        "iiprop": "url",
        "format": "json",
    })
    url = f"{API_BASE}?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"  Batch API error: {e}")
        return {}

    result = {}
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        if "missing" in page:
            continue
        title = page.get("title", "")
        # Strip "File:" prefix; API normalizes underscores→spaces, convert back
        fn = title.removeprefix("File:").replace(" ", "_")
        imageinfo = page.get("imageinfo", [])
        if imageinfo:
            result[fn] = imageinfo[0].get("url")
    return result


def resolve_sign_urls(numbers: list) -> dict:
    """
    For each sign number, resolve the best SVG URL from Wikimedia Commons.
    Returns {number: (url, source_filename)}.
    Queries the API in batches to avoid rate limits.
    """
    # Build candidate lists: primary first, then 'a' variant
    primaries = [f"Israel_road_sign_{n}.svg" for n in numbers]
    fallbacks = [f"Israel_road_sign_{n}a.svg" for n in numbers]

    # Query all primaries in batches
    print("Phase 1: querying primary filenames via API...")
    primary_urls = {}
    for i in range(0, len(primaries), API_BATCH_SIZE):
        batch = primaries[i:i + API_BATCH_SIZE]
        found = batch_get_image_urls(batch)
        primary_urls.update(found)
        print(f"  Batch {i // API_BATCH_SIZE + 1}: found {len(found)}/{len(batch)}")
        if i + API_BATCH_SIZE < len(primaries):
            time.sleep(API_BATCH_DELAY)

    # Identify which signs need the fallback ('a' variant) — only those not found in phase 1
    missing_primary = [n for n in numbers if f"Israel_road_sign_{n}.svg" not in primary_urls]
    print(f"  {len(numbers) - len(missing_primary)} signs resolved from primary filenames")
    fallback_urls = {}
    if missing_primary:
        fb_candidates = [f"Israel_road_sign_{n}a.svg" for n in missing_primary]
        print(f"\nPhase 2: querying 'a' variant for {len(missing_primary)} missing signs...")
        for i in range(0, len(fb_candidates), API_BATCH_SIZE):
            batch = fb_candidates[i:i + API_BATCH_SIZE]
            found = batch_get_image_urls(batch)
            fallback_urls.update(found)
            print(f"  Batch {i // API_BATCH_SIZE + 1}: found {len(found)}/{len(batch)}")
            if i + API_BATCH_SIZE < len(fb_candidates):
                time.sleep(API_BATCH_DELAY)

    # Merge: primary preferred, then fallback
    resolved = {}
    for n in numbers:
        pkey = f"Israel_road_sign_{n}.svg"
        fkey = f"Israel_road_sign_{n}a.svg"
        if pkey in primary_urls:
            resolved[n] = (primary_urls[pkey], pkey)
        elif fkey in fallback_urls:
            resolved[n] = (fallback_urls[fkey], fkey)
    return resolved


def download_file(url: str, dest: Path) -> bool:
    """Download url to dest, honouring Retry-After on 429. Returns True on success."""
    import urllib.error
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(1, DOWNLOAD_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as resp:
                dest.write_bytes(resp.read())
            return True
        except urllib.error.HTTPError as e:
            if e.code == 429:
                retry_after = int(e.headers.get("Retry-After", RETRY_BACKOFF * attempt))
                print(f"  Rate-limited (429). Waiting {retry_after}s before retry {attempt}/{DOWNLOAD_RETRIES}...")
                time.sleep(retry_after)
            else:
                print(f"  Attempt {attempt} failed: {e}")
                if attempt < DOWNLOAD_RETRIES:
                    time.sleep(RETRY_BACKOFF)
        except Exception as e:
            print(f"  Attempt {attempt} failed: {e}")
            if attempt < DOWNLOAD_RETRIES:
                time.sleep(RETRY_BACKOFF)
    return False


def get_sign_numbers() -> list:
    """Return sorted list of sign numbers we currently have PNGs for."""
    numbers = []
    for f in SIGNS_DIR.glob("sign-*.png"):
        m = re.match(r"sign-(\d+)\.png$", f.name)
        if m:
            numbers.append(m.group(1))
    return sorted(numbers, key=int)


def main():
    numbers = get_sign_numbers()
    print(f"Found {len(numbers)} sign PNGs to process.\n")

    resolved = resolve_sign_urls(numbers)
    print(f"\nAPI phase complete: {len(resolved)}/{len(numbers)} signs have SVGs on Commons.\n")
    print("Phase 3: downloading SVGs...\n")

    downloaded = []
    failed = []
    no_svg = [n for n in numbers if n not in resolved]

    for i, (num, (url, src_fn)) in enumerate(resolved.items(), 1):
        dest = SIGNS_DIR / f"sign-{num}.svg"
        if dest.exists():
            downloaded.append(num)
            print(f"[{i}/{len(resolved)}] {num}: already downloaded, skipping")
            continue
        print(f"[{i}/{len(resolved)}] {num}: {src_fn} ...", end=" ")
        sys.stdout.flush()
        if download_file(url, dest):
            downloaded.append(num)
            print("OK")
        else:
            failed.append(num)
            print("FAILED (keeping PNG)")
        if i < len(resolved):
            time.sleep(DOWNLOAD_DELAY)

    print(f"\n{'─'*60}")
    print(f"Downloaded:  {len(downloaded)} SVGs")
    print(f"Failed:      {len(failed)}")
    print(f"No SVG on Commons: {len(no_svg)}")
    if failed:
        print(f"Failed sign numbers: {', '.join(failed)}")
    if no_svg:
        print(f"No-SVG sign numbers: {', '.join(no_svg)}")

    if not downloaded:
        print("\nNothing to patch.")
        return

    nums_sql = ", ".join(f"'{n}'" for n in downloaded)
    patch = (
        "-- Auto-generated by scripts/download_wikipedia_signs.py\n"
        "-- Updates image_path to SVG for signs downloaded from Wikimedia Commons\n\n"
        "UPDATE signs\n"
        "SET image_path = '/signs/sign-' || sign_number || '.svg'\n"
        f"WHERE sign_number IN ({nums_sql});\n"
    )
    PATCH_SQL.write_text(patch, encoding="utf-8")
    print(f"\nSQL patch written to: {PATCH_SQL.relative_to(PROJECT_ROOT)}")
    print("Apply it with: psql $DATABASE_URL -f seeds/signs_wikipedia_patch.sql")


if __name__ == "__main__":
    main()
