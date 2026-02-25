#!/usr/bin/env python3
"""Strip [A:], [B:], [C:], [D:], [A.], [B.], [C.], [D.] from feedback text in tool question meta.json."""
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
QUESTIONS = BASE / "questions"

# Remove leading "[A:" or "[B." etc. and trailing "]"
PREFIX_RE = re.compile(r"^\s*\[[A-D]\s*[.:]\s*", re.IGNORECASE)
SUFFIX_RE = re.compile(r"\s*\]\s*$")


def clean_feedback_text(s):
    if not s or not isinstance(s, str):
        return s
    s = PREFIX_RE.sub("", s.strip())
    s = SUFFIX_RE.sub("", s)
    return s.strip()


def process_meta(path):
    import json
    with open(path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    changed = False
    for opt in meta.get("options") or []:
        fb = opt.get("feedback") or {}
        text = fb.get("text")
        if text:
            new_text = clean_feedback_text(text)
            if new_text != text:
                fb["text"] = new_text
                changed = True
    overall = meta.get("feedback") or {}
    text = overall.get("text")
    if text:
        new_text = clean_feedback_text(text)
        if new_text != text:
            overall["text"] = new_text
            changed = True
    if changed:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
        print(path.relative_to(BASE))
    return changed


def clean_resource_txt(path):
    """Update Feedback text: lines in tool_questions_resource.txt to remove prefixes."""
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    out = []
    for line in lines:
        if "Feedback text: [" in line:
            rest = line.split("Feedback text: ", 1)[1]
            rest = PREFIX_RE.sub("", rest.strip())
            rest = SUFFIX_RE.sub("", rest)
            line = "    Feedback text: " + rest.strip()
        out.append(line)
    path.write_text("\n".join(out), encoding="utf-8")
    print("Updated:", path.relative_to(BASE))


def main():
    for qdir in sorted(QUESTIONS.glob("tool*")):
        if not qdir.is_dir():
            continue
        meta_path = qdir / "meta.json"
        if meta_path.exists():
            process_meta(meta_path)
    resource_txt = QUESTIONS / "tool_questions_resource.txt"
    if resource_txt.exists():
        clean_resource_txt(resource_txt)


if __name__ == "__main__":
    main()
