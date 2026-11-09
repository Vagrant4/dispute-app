#!/usr/bin/env python3
"""Audit a uiautomator XML dump for overlap, clipping, bottom obstruction, and ellipsis."""
import argparse
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

BOUNDS = re.compile(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]")

def load_xml(args):
    if args.xml:
        return open(args.xml, encoding="utf-8").read()
    command = ["adb"] + (["-s", args.serial] if args.serial else []) + ["exec-out", "uiautomator", "dump", "/dev/tty"]
    return subprocess.check_output(command, text=True, encoding="utf-8", errors="replace")

def box(node):
    match = BOUNDS.fullmatch(node.get("bounds", ""))
    return tuple(map(int, match.groups())) if match else None

def overlaps(a, b):
    return min(a[2], b[2]) > max(a[0], b[0]) and min(a[3], b[3]) > max(a[1], b[1])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("xml", nargs="?", help="uiautomator XML file")
    parser.add_argument("--serial")
    parser.add_argument("--bottom-reserved", type=int, default=144, help="system/tab-bar region in px")
    args = parser.parse_args()
    xml = load_xml(args)
    xml = xml[xml.find("<?xml"):] if "<?xml" in xml else xml
    root = ET.fromstring(xml)
    nodes = [(node, box(node)) for node in root.iter("node") if box(node)]
    width = max((bounds[2] for _, bounds in nodes), default=0)
    height = max((bounds[3] for _, bounds in nodes), default=0)
    issues = []
    clickable = [(node, bounds) for node, bounds in nodes if node.get("clickable") == "true"]
    for index, (node, bounds) in enumerate(clickable):
        label = node.get("content-desc") or node.get("text") or node.get("resource-id") or "<unlabelled>"
        if bounds[0] < 0 or bounds[1] < 0 or bounds[2] > width or bounds[3] > height:
            issues.append(f"OFFSCREEN {label}: {bounds}")
        if bounds[3] > height - args.bottom_reserved:
            issues.append(f"BOTTOM-REGION {label}: {bounds}")
        for other, other_bounds in clickable[index + 1:]:
            if overlaps(bounds, other_bounds):
                other_label = other.get("content-desc") or other.get("text") or other.get("resource-id") or "<unlabelled>"
                issues.append(f"OVERLAP {label} {bounds} / {other_label} {other_bounds}")
    for node, bounds in nodes:
        value = node.get("text", "")
        if value.endswith("...") or value.endswith("…"):
            issues.append(f"ELLIPSIZED {value!r}: {bounds}")
    print("\n".join(issues) if issues else "UI sweep: no flagged elements")
    return 1 if issues else 0

if __name__ == "__main__":
    sys.exit(main())
