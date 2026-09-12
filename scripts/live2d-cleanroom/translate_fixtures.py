#!/usr/bin/env python3
"""
translate_fixtures.py - Translates CJK text in sample Live2D fixtures to English.
Outputs a new English dataset (fixtures/sample_dsl_models_en.json) without modifying original files.
Uses an offline-first persistent translation cache (fixtures/translation_cache.json).
"""

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FIXTURE = os.path.join(BASE_DIR, 'fixtures', 'sample_dsl_models.json')
OUTPUT_FIXTURE = os.path.join(BASE_DIR, 'fixtures', 'sample_dsl_models_en.json')
CACHE_FILE = os.path.join(BASE_DIR, 'fixtures', 'translation_cache.json')

CJK_REGEX = re.compile(r'[\u4e00-\u9fff\u3040-\u30ff]')

# Curated domain overrides for Live2D creator idioms
DOMAIN_OVERRIDES = {
    '去布料': 'Remove Fabric / Strip Clothes',
    '背景隐藏': 'Hide Background',
    '是否打阿库娅？': 'Hit Aqua?',
    '是否再来一把？': 'Play another round?',
    '是！': 'Yes!',
    '当然！': 'Of course!',
    '必须的！': 'Definitely!',
    '算了（关闭窗口）': 'Forget it (Close)',
    '要让大狸狸先回去么？': 'Should Big Raccoon go back first?',
    '要让大狸狸出来么？': 'Should Big Raccoon come out?',
    '好的': 'Okay',
    '不用了': 'No need',
    '晚安': 'Good night',
    '开启誓约动画': 'Enable Oath Animation',
    '关闭誓约动画': 'Disable Oath Animation',
    '开启登录动画': 'Enable Login Animation',
    '关闭登录动画': 'Disable Login Animation',
}


def load_cache():
    if os.path.isfile(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_cache(cache):
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def translate_text(text):
    text = text.strip()
    if not text or not CJK_REGEX.search(text):
        return text

    if text in DOMAIN_OVERRIDES:
        return DOMAIN_OVERRIDES[text]

    # Clean punctuation placeholders like {$br} before sending
    clean_text = text.replace('{$br}', ' ')

    url = f"https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=en&dt=t&q={urllib.parse.quote(clean_text)}"
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            translated = ''.join(p[0] for p in data[0] if p and p[0]).strip()
            return translated if translated else text
    except Exception as e:
        # Fallback to MyMemory
        try:
            mm_url = f"https://api.mymemory.translated.net/get?q={urllib.parse.quote(clean_text[:400])}&langpair=autodetect|en"
            mm_req = urllib.request.Request(mm_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(mm_req, timeout=6) as resp:
                d = json.loads(resp.read().decode('utf-8'))
                res = d.get('responseData', {}).get('translatedText')
                if res and not res.startswith('MYMEMORY WARNING'):
                    return res
        except Exception:
            pass
        print(f"Warning: translation failed for '{text[:25]}...': {e}", file=sys.stderr)
        return text


def main():
    print(f"Loading input fixture: {INPUT_FIXTURE}")
    with open(INPUT_FIXTURE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    models = data.get('models', [])
    cache = load_cache()
    # Populate cache with overrides
    for k, v in DOMAIN_OVERRIDES.items():
        cache[k] = v

    print(f"Extracting CJK strings across {len(models)} models...")
    strings_to_translate = set()

    for m in models:
        title = m.get('title', '')
        if CJK_REGEX.search(title):
            strings_to_translate.add(title)

        f = m.get('features', {})
        for c in f.get('cutscenes', []):
            t = c.get('text')
            if t and CJK_REGEX.search(t):
                strings_to_translate.add(t)

        for ch in f.get('choices', []):
            t = ch.get('text')
            if t and CJK_REGEX.search(t):
                strings_to_translate.add(t)
            for opt in ch.get('choices', []):
                ot = opt.get('Text')
                if ot and CJK_REGEX.search(ot):
                    strings_to_translate.add(ot)

        for p in f.get('param_values', []):
            n = p.get('Name', '')
            if n and CJK_REGEX.search(n):
                strings_to_translate.add(n)

        for v in f.get('var_floats', []):
            n = v.get('Name', '')
            if n and CJK_REGEX.search(n):
                strings_to_translate.add(n)

    missing = [s for s in strings_to_translate if s not in cache]
    print(f"Total unique CJK strings: {len(strings_to_translate)}")
    print(f"Already cached: {len(strings_to_translate) - len(missing)}")
    print(f"New strings to translate: {len(missing)}")

    # Translate new strings
    if missing:
        print("Translating via Google Translate API...")
        for i, text in enumerate(missing, 1):
            trans = translate_text(text)
            cache[text] = trans
            if i % 25 == 0 or i == len(missing):
                print(f"  [{i}/{len(missing)}] translated...")
                save_cache(cache)
            time.sleep(0.08)  # Polite throttle

        save_cache(cache)
        print("All translations cached successfully!")

    # Now construct the enriched English dataset
    print(f"Creating enriched English dataset -> {OUTPUT_FIXTURE}")
    en_models = []

    for m in models:
        m_en = json.loads(json.dumps(m))  # Deep copy
        
        # Title
        t = m_en.get('title', '')
        if t in cache:
            m_en['title_en'] = cache[t]

        f = m_en.get('features', {})
        
        # Cutscenes
        for c in f.get('cutscenes', []):
            raw = c.get('text', '')
            if raw in cache:
                c['text_en'] = cache[raw]

        # Choices
        for ch in f.get('choices', []):
            raw_p = ch.get('text', '')
            if raw_p in cache:
                ch['text_en'] = cache[raw_p]
            for opt in ch.get('choices', []):
                raw_opt = opt.get('Text', '')
                if raw_opt in cache:
                    opt['Text_en'] = cache[raw_opt]

        # Param values
        for p in f.get('param_values', []):
            pn = p.get('Name', '')
            if pn in cache:
                p['Name_en'] = cache[pn]

        # Var floats
        for v in f.get('var_floats', []):
            vn = v.get('Name', '')
            if vn in cache:
                v['Name_en'] = cache[vn]

        en_models.append(m_en)

    output_payload = {
        'description': 'Representative Live2D DSL capability sample (Enriched with English Translations)',
        'source_fixture': 'sample_dsl_models.json',
        'generated_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'sample_count': len(en_models),
        'models': en_models
    }

    with open(OUTPUT_FIXTURE, 'w', encoding='utf-8') as f:
        json.dump(output_payload, f, ensure_ascii=False, indent=2)

    out_size_kb = os.path.getsize(OUTPUT_FIXTURE) / 1024
    print(f"Successfully created English dataset: {OUTPUT_FIXTURE} ({out_size_kb:.1f} KB)")


if __name__ == '__main__':
    main()
