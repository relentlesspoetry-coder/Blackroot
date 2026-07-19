#!/usr/bin/env python3
"""
sync-patch-notes.py  (re-added again V0.18.20; the tools/ dir keeps vanishing — no VCS)

Regenerates the EMBEDDED patch-notes fallback inside the current `Blackroot V*.html`
from the canonical `PATCH_NOTES.md`. Mirrors Game.prototype.renderPatchNotesMarkdown
(systems/ui-system.js) exactly:
  ## title            -> <section class="patchNoteEntry"><h4>title</h4> …
  ### sub-header      -> <h5>sub-header</h5>
  - bullet / * bullet -> <li>…</li>
  (indented) - sub    -> nested <ul><li>…</li></ul> under the previous bullet
  inline: **bold** -> <strong>, `code` -> <code>, *em* -> <em>

Usage:  python3 tools/sync-patch-notes.py
Targets the newest `Blackroot V*.html` next to PATCH_NOTES.md.
"""

import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline(s):
    s = esc(s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"(?<!\*)\*([^*\s][^*]*?)\*(?!\*)", r"<em>\1</em>", s)
    return s


def parse_entries(md):
    entries = []
    cur = None
    group = None

    def new_group(head):
        nonlocal group
        group = {"head": head, "items": []}
        if cur is not None:
            cur["groups"].append(group)
        return group

    for raw in md.splitlines():
        line = raw.rstrip()
        h2 = re.match(r"^##\s+(.*)", line)
        if h2:
            cur = {"title": h2.group(1), "groups": []}
            entries.append(cur)
            group = None
            new_group(None)
            continue
        if cur is None:
            continue
        h3 = re.match(r"^###\s+(.*)", line)
        if h3:
            new_group(h3.group(1))
            continue
        if group is None:
            new_group(None)
        sub = re.match(r"^\s+[-*]\s+(.*)", line)
        if sub:
            if group["items"]:
                group["items"][-1].setdefault("sub", []).append(sub.group(1))
            else:
                group["items"].append({"text": sub.group(1)})
            continue
        bul = re.match(r"^[-*]\s+(.*)", line)
        if bul:
            group["items"].append({"text": bul.group(1)})
            continue
    return entries


def render_group(g):
    lis = []
    for it in g["items"]:
        li = "<li>" + inline(it["text"])
        if it.get("sub"):
            li += "<ul>" + "".join("<li>" + inline(s) + "</li>" for s in it["sub"]) + "</ul>"
        lis.append(li + "</li>")
    out = ""
    if g["head"]:
        out += "<h5>" + inline(g["head"]) + "</h5>"
    if lis:
        out += "<ul>" + "".join(lis) + "</ul>"
    return out


def render(md):
    return "".join(
        '<section class="patchNoteEntry"><h4>' + inline(e["title"]) + "</h4>"
        + "".join(render_group(g) for g in e["groups"]) + "</section>"
        for e in parse_entries(md)
    )


def main():
    with open(os.path.join(ROOT, "PATCH_NOTES.md"), "r", encoding="utf-8") as f:
        md = f.read()
    html_candidates = sorted(glob.glob(os.path.join(ROOT, "Blackroot V*.html")))
    if not html_candidates:
        print("ERROR: no 'Blackroot V*.html' found", file=sys.stderr)
        return 1
    html_path = html_candidates[-1]
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()
    rendered = render(md)
    if len(rendered) < 40:
        print("ERROR: rendered patch notes suspiciously short; aborting", file=sys.stderr)
        return 1
    pattern = re.compile(
        r'(<div class="patchNotesEntries" data-patch-notes-source="[^"]*">)(.*?)(</div>)', re.DOTALL)
    replaced = {"n": 0}

    def repl(m):
        if replaced["n"] == 0 and m.group(2).strip():
            replaced["n"] = 1
            return m.group(1) + "\n" + rendered + "\n        " + m.group(3)
        return m.group(0)

    new_html, _ = pattern.subn(repl, html)
    if replaced["n"] == 0:
        print("ERROR: no populated .patchNotesEntries container found in " + os.path.basename(html_path), file=sys.stderr)
        return 1
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(new_html)
    print("Synced %d patch-note entries into %s" % (len(parse_entries(md)), os.path.basename(html_path)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
