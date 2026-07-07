#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = ["Pillow", "numpy"]
# ///
"""Remove external white background from all public/signs/*.png, in-place."""

import sys
from pathlib import Path
from collections import deque

import numpy as np
from PIL import Image

TOLERANCE = 10       # BFS flood fill: pixels with all channels >= (255 - TOLERANCE) are "white"
FRINGE_THRESHOLD = 200  # Second pass: near-white anti-aliased fringe pixels adjacent to transparent


def remove_background(path: Path) -> None:
    img = Image.open(path).convert("RGBA")
    data = np.array(img, dtype=np.uint8)
    h, w = data.shape[:2]
    threshold = 255 - TOLERANCE

    def is_white(y: int, x: int) -> bool:
        r, g, b = data[y, x, :3]
        return int(r) >= threshold and int(g) >= threshold and int(b) >= threshold

    visited = np.zeros((h, w), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    # Seed from all four edges
    for x in range(w):
        for y in (0, h - 1):
            if not visited[y, x] and is_white(y, x):
                visited[y, x] = True
                queue.append((y, x))
    for y in range(1, h - 1):
        for x in (0, w - 1):
            if not visited[y, x] and is_white(y, x):
                visited[y, x] = True
                queue.append((y, x))

    # BFS pass 1: remove connected pure-white background
    while queue:
        cy, cx = queue.popleft()
        data[cy, cx, 3] = 0  # transparent
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_white(ny, nx):
                visited[ny, nx] = True
                queue.append((ny, nx))

    # Pass 2: remove anti-aliased fringe — near-white pixels adjacent to already-transparent ones.
    # Iterates until stable so the fringe is fully consumed regardless of thickness.
    # Only affects outer-edge fringe: inner-edge pixels are not adjacent to transparent pixels.
    channels = data[:, :, :3].astype(np.int32)
    changed = True
    while changed:
        transparent = data[:, :, 3] == 0
        near_white = (
            (~transparent)
            & (channels[:, :, 0] >= FRINGE_THRESHOLD)
            & (channels[:, :, 1] >= FRINGE_THRESHOLD)
            & (channels[:, :, 2] >= FRINGE_THRESHOLD)
        )
        adj = np.zeros((h, w), dtype=bool)
        adj[1:, :] |= transparent[:-1, :]
        adj[:-1, :] |= transparent[1:, :]
        adj[:, 1:] |= transparent[:, :-1]
        adj[:, :-1] |= transparent[:, 1:]
        to_remove = near_white & adj
        changed = bool(to_remove.any())
        if changed:
            data[to_remove, 3] = 0

    Image.fromarray(data).save(path)


def main() -> None:
    signs_dir = Path(__file__).parent.parent / "public" / "signs"
    sample = "--sample" in sys.argv

    images = sorted(signs_dir.glob("sign-*.png"))
    if sample:
        images = [p for p in images if p.name in ("sign-302.png", "sign-303.png")]

    print(f"Processing {len(images)} image(s)...")
    for i, path in enumerate(images, 1):
        remove_background(path)
        print(f"  [{i}/{len(images)}] {path.name}")
    print("Done.")


if __name__ == "__main__":
    main()
