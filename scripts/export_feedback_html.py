#!/usr/bin/env python3
"""
Generate a single HTML file with all question stems and feedback from
questions/index.json and each folder's meta.json. Open the file in a browser
and use Print → Save as PDF to export a PDF.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = ROOT / "questions" / "index.json"
OUTPUT_PATH = ROOT / "export-feedback.html"


def main():
    index_path = INDEX_PATH
    if not index_path.exists():
        print(f"Missing {index_path}")
        return
    with open(index_path, encoding="utf-8") as f:
        question_ids = json.load(f)
    if not isinstance(question_ids, list):
        question_ids = []

    sections = []
    for i, qid in enumerate(question_ids, start=1):
        meta_path = ROOT / "questions" / qid / "meta.json"
        if not meta_path.exists():
            sections.append(f"<section class='q-block'><h2>Question {i}: {qid}</h2><p>No meta.json found.</p></section>")
            continue
        with open(meta_path, encoding="utf-8") as f:
            meta = json.load(f)

        stem = meta.get("stem") or {}
        stem_text = stem.get("text") or "(No stem text)"
        stem_image = stem.get("image")
        parts = [f"<h2>Question {i}: {qid}</h2>", f"<p class='stem'>{_esc(stem_text)}</p>"]
        if stem_image:
            parts.append(f"<img src='questions/{_esc(qid)}/{_esc(stem_image)}' alt='Stem' class='thumb' />")

        if meta.get("question_type") == "open_ended":
            rubric = meta.get("rubric") or []
            parts.append("<p class='rubric'><strong>Rubric:</strong> " + _esc(", ".join(str(x) for x in rubric)) + "</p>")
            fb = (meta.get("feedback") or {}).get("text") or ""
            if fb:
                parts.append(f"<pre class='feedback'>{_esc(fb)}</pre>")
        else:
            options = meta.get("options") or []
            for j, opt in enumerate(options):
                letter = chr(65 + j)
                correct = (opt.get("answer") or "").upper() == "Y"
                opt_text = opt.get("text") or opt.get("image") or "(image option)"
                parts.append(f"<div class='option'><strong>Option {letter}</strong> ({'Correct' if correct else 'Incorrect'}): {_esc(str(opt_text))}</div>")
                if opt.get("image"):
                    parts.append(f"<img src='questions/{_esc(qid)}/{_esc(opt['image'])}' alt='Option {letter}' class='thumb' />")
                fb = (opt.get("feedback") or {}).get("text")
                if fb:
                    parts.append(f"<pre class='feedback option-feedback'>{_esc(fb)}</pre>")
                fb_img = (opt.get("feedback") or {}).get("image")
                if fb_img:
                    parts.append(f"<img src='questions/{_esc(qid)}/{_esc(fb_img)}' alt='Feedback {letter}' class='thumb' />")
            overall = (meta.get("feedback") or {}).get("text")
            if overall:
                parts.append(f"<pre class='feedback overall'>{_esc(overall)}</pre>")

        sections.append("<section class='q-block'>" + "\n".join(parts) + "</section>")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>All question feedback</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; color: #1b1d21; background: #fff; }}
    .print-note {{ margin-bottom: 24px; padding: 12px 16px; background: #e8eaef; border-radius: 8px; font-size: 14px; }}
    .print-note strong {{ display: block; margin-bottom: 4px; }}
    .q-block {{ margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e8eaef; page-break-inside: avoid; }}
    .q-block h2 {{ font-size: 1.1rem; margin: 0 0 8px; color: #2f5bea; }}
    .stem {{ margin: 0 0 12px; font-size: 15px; line-height: 1.5; }}
    .stem-img {{ margin: 0 0 8px; font-size: 13px; color: #6b7280; }}
    .rubric {{ margin: 8px 0; font-size: 14px; color: #4a4f57; }}
    .option {{ margin: 8px 0 4px; font-size: 14px; }}
    .feedback {{ white-space: pre-wrap; font-size: 13px; margin: 4px 0 12px; padding: 10px; background: #f8f9fc; border-radius: 6px; border-left: 3px solid #2f5bea; }}
    .option-feedback {{ margin-left: 16px; }}
    .thumb {{ max-width: 180px; height: auto; display: block; margin: 4px 0 8px; border-radius: 6px; }}
    @media print {{ body {{ padding: 16px; }} .print-note {{ background: #f0f0f0; }} }}
  </style>
</head>
<body>
  <div class="print-note">
    <strong>Export to PDF</strong>
    Use your browser’s Print dialog (Ctrl+P / Cmd+P) and choose <strong>Save as PDF</strong> or <strong>Print to PDF</strong>.
  </div>
  <h1>All question feedback</h1>
  {chr(10).join(sections)}
</body>
</html>
"""
    OUTPUT_PATH.write_text(html, encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")


def _esc(s: str) -> str:
    if s is None:
        return ""
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


if __name__ == "__main__":
    main()
