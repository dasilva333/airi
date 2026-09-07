import json
import time
import re
import needle

test_cases = [
    {
        "id": "1-conversational-hesitation",
        "description": "Clear conversational hesitation in English reasoning",
        "speech_language": "en",
        "text": "Let's see here... Orbital decay happens when satellite altitude decreases due to atmospheric drag. Hmm, wait, I should explain the atmospheric density scale height first before giving the formula."
    },
    {
        "id": "2-discarded-hypothesis",
        "description": "Discarded hypothesis (negated thought - must NOT be spoken)",
        "speech_language": "en",
        "text": "Looking at the user's login error log. Wait, maybe the password is wrong. No, authentication succeeded with status 200, it's the OAuth token refresh that timed out."
    },
    {
        "id": "3-chinese-reasoning-english-card",
        "description": "Chinese reasoning trace when character speaks English",
        "speech_language": "en",
        "text": "用户在询问关于东京旅行的路线规划。我需要先梳理一下新宿和涩谷的交通。首先推荐山手线，另外需要注意天气变化。"
    },
    {
        "id": "4-chinese-reasoning-chinese-card",
        "description": "Chinese reasoning trace when character speaks Chinese",
        "speech_language": "zh",
        "text": "用户在询问关于东京旅行的路线规划。我需要先梳理一下新宿和涩谷的交通。嗯，我想想看，首先推荐山手线。"
    },
    {
        "id": "5-dense-math-scratchpad",
        "description": "Dense math scratchpad (no conversational content - must abstain)",
        "speech_language": "en",
        "text": "Calculating matrix eigenvalues. det(A - lambda*I) = (3 - lambda)(2 - lambda) - 4 = lambda^2 - 5*lambda + 2 = 0. lambda = (5 +- sqrt(25 - 8))/2 = (5 +- sqrt(17))/2."
    },
    {
        "id": "6-internal-meta-deliberation",
        "description": "Internal persona meta-deliberation (must NOT leak persona instructions)",
        "speech_language": "en",
        "text": "The user is teasing me about blushing. I need to maintain my tsundere persona as Airi. Don't sound too eager. Pretend I don't care at all."
    }
]

# Mode 2B Tool: Strict Span Extraction with explicit abstention
tool_mode_2b = {
    "name": "extract_spoken_aside",
    "description": "Extract a short (2-8 word) conversational hesitation that appears verbatim in the reasoning buffer and matches the target speech language. If the text is math, code, a rejected/false hypothesis, or in a foreign language, return null.",
    "parameters": {
        "type": "object",
        "properties": {
            "aside": {
                "type": ["string", "null"],
                "description": "Verbatim conversational aside in target language, or null if unsuitable."
            }
        },
        "required": ["aside"]
    }
}

# Mode 2C Tool: In-Character Paraphrase Generation
tool_mode_2c = {
    "name": "generate_in_character_aside",
    "description": "Generate a very brief (2-6 word) in-character hesitation or reaction to speak aloud while thinking. Must be in the character's target speech language and in persona (Airi, slightly tsundere companion).",
    "parameters": {
        "type": "object",
        "properties": {
            "spoken_reaction": {
                "type": "string",
                "description": "Brief spoken reaction in persona, e.g. 'Wait a second...', 'Hold on, let me see...'"
            }
        },
        "required": ["spoken_reaction"]
    }
}

print("=" * 80)
print("EXPERIMENT 1: MODE 2B (STRICT SPAN EXTRACTION + ABSTENTION)")
print("=" * 80)

engine_2b = needle.Needle(tools=[tool_mode_2b])

for tc in test_cases:
    query = f"Target Speech Language: {tc['speech_language']}\nReasoning Buffer:\n{tc['text']}"
    t0 = time.perf_counter()
    resp = engine_2b.complete(query, max_new_tokens=64)
    dt_ms = (time.perf_counter() - t0) * 1000
    
    runtime_conf = resp.get("confidence")
    resp_type = resp.get("type")
    calls = resp.get("function_calls") or []
    
    print(f"\n[Case {tc['id']}]: {tc['description']}")
    print(f"  Execution Time: {dt_ms:.1f}ms | Runtime Confidence: {runtime_conf} | Response Type: {resp_type}")
    if calls:
        for c in calls:
            args = c.get("arguments", {})
            aside = args.get("aside")
            # Validation checks
            verbatim = (aside in tc['text']) if aside else False
            print(f"  Tool Call: {c.get('name')}(aside={repr(aside)})")
            print(f"  Verbatim match in source: {verbatim}")
    else:
        print("  -> ABSTAINED (No tool calls generated)")

engine_2b.close()

print("\n" + "=" * 80)
print("EXPERIMENT 2: MODE 2C (IN-CHARACTER PROSE PARAPHRASE GENERATION)")
print("=" * 80)

engine_2c = needle.Needle(
    system="You are Airi's subconscious thought vocalizer. When thinking takes a long time, generate a brief, in-character hesitation in the target language.",
    tools=[tool_mode_2c]
)

for tc in test_cases:
    query = f"Target Speech Language: {tc['speech_language']}\nReasoning Buffer:\n{tc['text']}"
    t0 = time.perf_counter()
    resp = engine_2c.complete(query, max_new_tokens=64)
    dt_ms = (time.perf_counter() - t0) * 1000
    
    runtime_conf = resp.get("confidence")
    calls = resp.get("function_calls") or []
    
    print(f"\n[Case {tc['id']}]: {tc['description']}")
    print(f"  Execution Time: {dt_ms:.1f}ms | Runtime Confidence: {runtime_conf}")
    if calls:
        for c in calls:
            args = c.get("arguments", {})
            reaction = args.get("spoken_reaction")
            print(f"  Generated Reaction: {repr(reaction)}")
    else:
        print("  -> ABSTAINED (No tool calls generated)")

engine_2c.close()
