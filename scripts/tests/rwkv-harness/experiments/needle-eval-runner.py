import json
import os
import re
import sys
import time
import needle

CANDIDATES = [1, 2, 3]

def sanitize_chat_content(text):
    text = re.sub(r'<\|ACT:[^>]*\|>', ' ', text)
    text = re.sub(r'<\|[^>]+\|>', ' ', text)
    text = re.sub(r'\[[^\]]+\]', ' ', text)
    text = text.replace('\r', ' ')
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def build_window_messages(transcript, max_messages=80):
    out = []
    for m in transcript:
        if m.get('role') not in ('user', 'assistant'):
            continue
        c = m.get('content')
        if isinstance(c, str):
            text = sanitize_chat_content(c)
        elif isinstance(c, list):
            text = sanitize_chat_content(' '.join([p.get('text', '') for p in c if isinstance(p, dict)]))
        else:
            continue
        if text:
            out.append({'role': m['role'], 'content': text, 'createdAt': m.get('createdAt', 0)})
    out.sort(key=lambda x: x['createdAt'])
    return out[-max_messages:]

def build_evidence_window(messages, char_name="Bot", max_lines=40):
    lines = []
    for i, m in enumerate(messages[-max_lines:]):
        speaker = "User" if m['role'] == 'user' else char_name
        lines.append(f"{i}: {speaker}: {m['content']}")
    return '\n'.join(lines)

echo_chips_tool = {
    "name": "extract_echo_chips",
    "description": "Extract 3-5 semantic Echo Chips (pills) summarizing emotional tone, recurring flavor, or journal moments.",
    "parameters": {
        "type": "object",
        "properties": {
            "pills": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "content": {"type": "string", "description": "Short evocative summary phrase (2-6 words)"},
                        "type": {"type": "string", "enum": ["mood", "flavor", "journal_candidate"]},
                        "relevanceScore": {"type": "number", "minimum": 0.0, "maximum": 1.0}
                    },
                    "required": ["content", "type", "relevanceScore"]
                }
            }
        },
        "required": ["pills"]
    }
}

agent = needle.Needle(tools=[echo_chips_tool])

results = {}

for cand in CANDIDATES:
    fp = f"test-prompts/echo-chips-corpus-candidate{cand}.json"
    if not os.path.exists(fp):
        fp = f"scripts/tests/rwkv-harness/test-prompts/echo-chips-corpus-candidate{cand}.json"
    with open(fp, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    title = data.get("candidateTitle", f"Candidate {cand}")
    session_id = data.get("sessionId", f"candidate{cand}")
    transcript = data.get("chatTranscript", [])
    window = build_window_messages(transcript, 80)
    
    # 1. Full window (up to 35 lines)
    evidence_full = build_evidence_window(window, "Bot", max_lines=35)
    
    # 2. Recent window (last 6 turns, within Needle's 256 token sweet spot)
    evidence_recent = build_evidence_window(window, "Bot", max_lines=6)
    
    cand_results = {}
    
    # Run full
    print(f"Running Candidate {cand} (Full)...", flush=True)
    t0 = time.time()
    agent.reset()
    res_full = agent.complete(f"Transcript:\n{evidence_full}\n\nTask: Extract 3-5 echo chips summarizing the conversation.")
    elapsed_full = time.time() - t0
    cand_results["full"] = {
        "elapsed_sec": elapsed_full,
        "response": res_full
    }
    
    # Run recent
    print(f"Running Candidate {cand} (Recent 6 turns)...", flush=True)
    t0 = time.time()
    agent.reset()
    res_recent = agent.complete(f"Transcript:\n{evidence_recent}\n\nTask: Extract 3-5 echo chips summarizing the conversation.")
    elapsed_recent = time.time() - t0
    cand_results["recent"] = {
        "elapsed_sec": elapsed_recent,
        "response": res_recent
    }
    
    results[cand] = cand_results

out_path = "reports/03-needle-eval-raw.json"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print(f"Saved raw Needle outputs to {out_path}", flush=True)
