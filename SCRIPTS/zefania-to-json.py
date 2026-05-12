"""
Convert a Zefania XML Bible file to the flat JSON format used by the COC Bible reader.

Output format:
{
  "1": { "1": { "1": "verse text", "2": "verse text", ... }, ... },
  "2": { ... },
  ...
}

Usage:
  python zefania-to-json.py <input.zefania.xml> <output.json>
"""

import sys
import json
import xml.etree.ElementTree as ET

def convert(src, dst):
    tree = ET.parse(src)
    root = tree.getroot()
    bible = {}

    for book in root.findall('BIBLEBOOK'):
        bnum = book.get('bnumber')
        if not bnum:
            continue
        chapters = {}
        for chapter in book.findall('CHAPTER'):
            cnum = chapter.get('cnumber')
            if not cnum:
                continue
            verses = {}
            for verse in chapter.findall('VERS'):
                vnum = verse.get('vnumber')
                text = (verse.text or '').strip()
                if vnum and text:
                    verses[vnum] = text
            if verses:
                chapters[cnum] = verses
        if chapters:
            bible[bnum] = chapters

    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(bible, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Written {dst}")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python zefania-to-json.py <input.xml> <output.json>")
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2])
