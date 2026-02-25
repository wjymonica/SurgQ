#!/usr/bin/env python3
"""
Revise questions/toolX/meta.json from tool_questions_resource.txt:
- Sync stem, option text, feedback text from the txt
- Set feedback image to the highlighted image: <stem>_highlighted.jpg (or null if none)
"""
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
RESOURCE_TXT = BASE / "questions" / "tool_questions_resource.txt"
QUESTIONS_DIR = BASE / "questions"


def feedback_image_to_highlighted(path):
    """Convert Feedback image path from txt to highlighted filename, or None."""
    path = (path or "").strip()
    if not path or path == "(none)":
        return None
    # lap1/lap1_label/007321.jpg -> 007321_highlighted.jpg
    # lap_others/frame_0010.jpg -> frame_0010_highlighted.jpg
    stem = Path(path).stem
    return f"{stem}_highlighted.jpg"


def parse_resource_txt(txt_path):
    """
    Parse full resource txt. Yields (qid, stem_text, options_list, overall_feedback, is_open_ended).
    options_list: list of {option_idx, text, answer, feedback_text, feedback_image}
    overall_feedback: {feedback_text, feedback_image} or None
    """
    text = Path(txt_path).read_text(encoding="utf-8")
    # Match === toolN === at line start (^ or after \n) so tool1 is not merged into first block
    blocks = re.split(r"(?:^|\n)=== (tool\d+) ===\n", text)
    # blocks[0] may be empty, blocks[1]=tool1, blocks[2]=content1, blocks[3]=tool10, ...
    for i in range(1, len(blocks) - 1, 2):
        qid = blocks[i].strip()
        body = blocks[i + 1] if i + 1 < len(blocks) else ""
        lines = body.split("\n")
        stem_text = ""
        options_list = []
        overall_feedback = None
        is_open_ended = False
        j = 0
        while j < len(lines):
            line = lines[j]
            if line.strip() == "Question stem:":
                j += 1
                stem_parts = []
                while j < len(lines) and not lines[j].strip().startswith("Option ") and lines[j].strip() != "(open-ended)":
                    stem_parts.append(lines[j].strip())
                    j += 1
                stem_text = " ".join(stem_parts).strip()
                continue
            if line.strip() == "(open-ended)":
                is_open_ended = True
                j += 1
                related_tools = related_targets = ""
                fb_text = fb_image = ""
                while j < len(lines):
                    l = lines[j]
                    if l.strip().startswith("==="):
                        break
                    if "Related tools:" in l:
                        related_tools = l.split("Related tools:", 1)[1].strip()
                    elif "Related targets:" in l:
                        related_targets = l.split("Related targets:", 1)[1].strip()
                    elif "Feedback text:" in l:
                        fb_text = l.split("Feedback text:", 1)[1].strip()
                        if fb_text == "(none)":
                            fb_text = ""
                    elif "Feedback image:" in l:
                        fb_image = l.split("Feedback image:", 1)[1].strip()
                        j += 1
                        break
                    j += 1
                overall_feedback = {"feedback_text": fb_text, "feedback_image": fb_image}
                continue
            m = re.match(r"\s*Option (\d+) \(answer=([YN])\):\s*(.*)", line)
            if m:
                opt_idx = int(m.group(1))
                answer = m.group(2)
                opt_text = m.group(3).strip()
                j += 1
                fb_text = fb_image = ""
                while j < len(lines):
                    l = lines[j]
                    if re.match(r"\s*Option \d+", l) or l.strip().startswith("Overall feedback") or l.strip().startswith("==="):
                        break
                    if "Related tools:" in l:
                        pass
                    elif "Related targets:" in l:
                        pass
                    elif "Feedback text:" in l:
                        fb_text = l.split("Feedback text:", 1)[1].strip()
                        if fb_text == "(none)":
                            fb_text = ""
                    elif "Feedback image:" in l:
                        fb_image = l.split("Feedback image:", 1)[1].strip()
                        j += 1
                        break
                    j += 1
                options_list.append({
                    "option_idx": opt_idx,
                    "text": opt_text,
                    "answer": answer,
                    "feedback_text": fb_text,
                    "feedback_image": fb_image,
                })
                continue
            if "Overall feedback:" in line.strip():
                j += 1
                ofb_text = ofb_image = ""
                while j < len(lines):
                    l = lines[j]
                    if l.strip().startswith("==="):
                        break
                    if "Feedback text:" in l:
                        ofb_text = l.split("Feedback text:", 1)[1].strip()
                    elif "Feedback image:" in l:
                        ofb_image = l.split("Feedback image:", 1)[1].strip()
                        j += 1
                        break
                    j += 1
                overall_feedback = {"feedback_text": ofb_text, "feedback_image": ofb_image}
                continue
            j += 1
        yield qid, stem_text, options_list, overall_feedback, is_open_ended


def main():
    for qid, stem_text, options_list, overall_feedback, is_open_ended in parse_resource_txt(RESOURCE_TXT):
        meta_path = QUESTIONS_DIR / qid / "meta.json"
        if not meta_path.exists():
            print(f"Skip {qid}: no meta.json")
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta["stem"]["text"] = stem_text
        if is_open_ended:
            meta["feedback"]["text"] = overall_feedback["feedback_text"] if overall_feedback else ""
            img = feedback_image_to_highlighted(overall_feedback["feedback_image"]) if overall_feedback else None
            meta["feedback"]["image"] = img
        else:
            # MCQ
            for opt in options_list:
                idx = opt["option_idx"]
                if idx >= len(meta["options"]):
                    continue
                meta["options"][idx]["text"] = opt["text"]
                meta["options"][idx]["answer"] = opt["answer"]
                meta["options"][idx]["feedback"]["text"] = opt["feedback_text"] or None
                meta["options"][idx]["feedback"]["image"] = feedback_image_to_highlighted(opt["feedback_image"])
            if overall_feedback and meta.get("feedback") is not None:
                meta["feedback"]["text"] = overall_feedback["feedback_text"] or None
                meta["feedback"]["image"] = feedback_image_to_highlighted(overall_feedback["feedback_image"])
        meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Updated {meta_path.relative_to(BASE)}")


if __name__ == "__main__":
    main()
