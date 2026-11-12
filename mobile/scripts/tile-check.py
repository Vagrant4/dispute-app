#!/usr/bin/env python3
"""Flag the yellow/black and white visual signature of an OSM blocked tile."""
import argparse
import sys

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("png")
    parser.add_argument("--crop", required=True, help="left,top,right,bottom")
    args = parser.parse_args()
    try:
        from PIL import Image
    except ImportError:
        print("tile-check: Pillow is required (python3 -m pip install Pillow)", file=sys.stderr)
        return 2
    image = Image.open(args.png).convert("RGB").crop(tuple(map(int, args.crop.split(","))))
    pixels = list(image.getdata())
    total = max(1, len(pixels))
    yellow = sum(r > 170 and g > 130 and b < 90 for r, g, b in pixels) / total
    black = sum(r < 55 and g < 55 and b < 55 for r, g, b in pixels) / total
    white = sum(r > 225 and g > 225 and b > 225 for r, g, b in pixels) / total
    blocked = yellow > 0.025 and black > 0.025 and white > 0.20
    print(f"blocked={str(blocked).lower()} yellow={yellow:.3f} black={black:.3f} white={white:.3f}")
    return 1 if blocked else 0

if __name__ == "__main__":
    sys.exit(main())
