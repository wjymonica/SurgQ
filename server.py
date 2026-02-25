import json
import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GradeRequest(BaseModel):
    answer: str
    rubric: list[str] = []
    stem: dict[str, Any] = {}


client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


@app.post("/grade")
def grade_answer(payload: GradeRequest) -> dict[str, str]:
    if not payload.answer.strip():
        raise HTTPException(status_code=400, detail="Answer is required.")

    rubric_lines = "\n".join(f"- {item}" for item in payload.rubric) or "- (none)"
    stem_text = payload.stem.get("text") or ""

    system_prompt = (
        "You are a strict grader. Use the rubric to decide whether the "
        "answer aligns with expectations. Return JSON with keys: "
        "verdict (pass or fail) and reason (short)."
    )

    user_prompt = (
        f"Question: {stem_text}\n\n"
        f"Rubric:\n{rubric_lines}\n\n"
        f"Answer:\n{payload.answer}\n\n"
        "Evaluate alignment with the rubric and respond with JSON only."
    )

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    content = response.choices[0].message.content or ""
    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500, detail="Model did not return valid JSON."
        )

    verdict = str(result.get("verdict", "")).lower()
    if verdict not in {"pass", "fail"}:
        verdict = "fail"

    reason = str(result.get("reason", "")).strip() or "No reason provided."

    return {"verdict": verdict, "reason": reason}
