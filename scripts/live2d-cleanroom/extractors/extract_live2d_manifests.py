#!/usr/bin/env python3
"""
extract_live2d_manifests.py - Live2D Cleanroom Manifest & DSL Extractor
Scans Live2D model archives (.zip) on the storage volume and extracts
manifests and creator DSL capabilities (VarFloats, change_cos, ParamValue, Choices, etc.).
"""

import argparse
import json
import os
import re
import sys
import time
import zipfile
from collections import Counter


def find_manifest_in_namelist(namelist):
    """Find primary .model3.json (Live2D v3/v4) or .model.json (Live2D v2) in zip."""
    m3 = [n for n in namelist if n.lower().endswith('.model3.json') and not n.startswith('__MACOSX/')]
    if m3:
        # Prefer root or shallowest manifest
        m3.sort(key=lambda x: (x.count('/'), len(x)))
        return m3[0], 'model3'
    m2 = [n for n in namelist if n.lower().endswith('.model.json') and not n.startswith('__MACOSX/')]
    if m2:
        m2.sort(key=lambda x: (x.count('/'), len(x)))
        return m2[0], 'model2'
    return None, None


def decode_zip_bytes(raw_bytes):
    """Try decoding manifest bytes with utf-8, then fallback to utf-8-sig, gbk, shift_jis."""
    for enc in ('utf-8', 'utf-8-sig', 'gbk', 'shift_jis', 'cp932', 'latin1'):
        try:
            return raw_bytes.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw_bytes.decode('utf-8', errors='ignore')


CHANGE_COS_RE = re.compile(r'change_cos\s+([^\s;\'"]+)', re.IGNORECASE)


def inspect_dsl_features(manifest_data, raw_text):
    """Inspect parsed manifest data and raw text for creator DSL patterns."""
    features = {
        'has_dsl': False,
        'var_floats': [],
        'costumes': [],
        'param_values': [],
        'choices': [],
        'cutscenes': [],
        'intimacy': None,
        'commands': [],
    }

    # 1. Costumes (change_cos)
    costumes_found = set(CHANGE_COS_RE.findall(raw_text))
    if costumes_found:
        features['has_dsl'] = True
        features['costumes'] = sorted(list(costumes_found))

    # Helper recursive walker to find VarFloats, Choices, ParamValue, Intimacy, Sound/Text
    def walk(obj, path=""):
        if isinstance(obj, dict):
            # Check VarFloats
            if 'VarFloats' in obj and isinstance(obj['VarFloats'], list):
                features['has_dsl'] = True
                features['var_floats'].extend(obj['VarFloats'])

            # Check Choices
            if 'Choices' in obj and isinstance(obj['Choices'], list):
                features['has_dsl'] = True
                features['choices'].append({
                    'parent': path,
                    'text': obj.get('Text'),
                    'choices': obj['Choices']
                })

            # Check ParamValue
            if 'ParamValue' in obj:
                features['has_dsl'] = True
                items = obj['ParamValue'].get('Items', []) if isinstance(obj['ParamValue'], dict) else []
                features['param_values'].extend(items)

            # Check Intimacy
            if 'Intimacy' in obj and isinstance(obj['Intimacy'], (dict, int, float)):
                features['has_dsl'] = True
                if features['intimacy'] is None:
                    features['intimacy'] = []
                features['intimacy'].append(obj['Intimacy'])

            # Check Command / PostCommand / InitCommand
            for cmd_key in ('Command', 'PostCommand', 'InitCommand', 'Commands'):
                if cmd_key in obj and isinstance(obj[cmd_key], str):
                    features['has_dsl'] = True
                    features['commands'].append(obj[cmd_key])

            # Check Cutscenes (Sound + Text or Voice lines)
            if 'Text' in obj and ('Sound' in obj or 'NextMtn' in obj or 'Expression' in obj):
                features['has_dsl'] = True
                features['cutscenes'].append({
                    'group': path,
                    'text': str(obj.get('Text')),
                    'sound': obj.get('Sound'),
                    'expression': obj.get('Expression'),
                    'next_mtn': obj.get('NextMtn')
                })

            for k, v in obj.items():
                walk(v, f"{path}.{k}" if path else k)

        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                walk(item, f"{path}[{i}]")

    walk(manifest_data)
    return features


def process_model(model_meta, base_dir):
    """Process a single model container zip and extract capabilities."""
    rel_path = model_meta.get('relative_container_path', '').replace('/', os.sep)
    zip_path = os.path.join(base_dir, rel_path)

    record = {
        'id': model_meta.get('id'),
        'title': model_meta.get('title'),
        'relative_path': model_meta.get('relative_container_path'),
        'format': None,
        'manifest_file': None,
        'has_dsl': False,
        'features': None,
        'error': None
    }

    if not os.path.isfile(zip_path):
        record['error'] = 'File not found'
        return record

    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            namelist = z.namelist()
            manifest_file, fmt = find_manifest_in_namelist(namelist)
            if not manifest_file:
                record['format'] = 'unknown'
                return record

            record['format'] = fmt
            record['manifest_file'] = manifest_file

            raw_bytes = z.read(manifest_file)
            raw_text = decode_zip_bytes(raw_bytes)

            try:
                manifest_data = json.loads(raw_text)
            except Exception:
                # Sometimes manifests contain trailing commas or comments
                # Try a quick strip or record raw regex match
                manifest_data = {}

            features = inspect_dsl_features(manifest_data, raw_text)
            record['has_dsl'] = features['has_dsl']
            if features['has_dsl']:
                record['features'] = {
                    'costume_count': len(features['costumes']),
                    'costumes': features['costumes'][:50],
                    'var_float_count': len(features['var_floats']),
                    'var_floats': features['var_floats'][:50],
                    'param_value_count': len(features['param_values']),
                    'param_values': features['param_values'][:50],
                    'choice_count': len(features['choices']),
                    'choices': features['choices'][:20],
                    'cutscene_count': len(features['cutscenes']),
                    'cutscenes': features['cutscenes'][:20],
                    'command_count': len(features['commands']),
                    'commands': features['commands'][:50],
                    'has_intimacy': features['intimacy'] is not None
                }
    except Exception as e:
        record['error'] = str(e)

    return record


def main():
    parser = argparse.ArgumentParser(description="Extract Live2D capabilities and DSL manifests.")
    parser.add_argument('--catalog', default=r'E:\Avatar models\index\catalog.json', help="Path to catalog.json")
    parser.add_argument('--models-dir', default=r'E:\Avatar models', help="Base directory for avatar model zips")
    parser.add_argument('--output', default=r'E:\Avatar models\index\extracted_dsl_capabilities.json', help="Output JSON path")
    parser.add_argument('--limit', type=int, default=0, help="Max models to process (0 for all)")
    parser.add_argument('--offset', type=int, default=0, help="Skip first N models")
    parser.add_argument('--dsl-only', action='store_true', help="Only save models with detected DSL")
    args = parser.parse_args()

    print(f"Loading catalog from: {args.catalog}")
    t0 = time.time()
    with open(args.catalog, 'r', encoding='utf-8') as f:
        catalog_data = json.load(f)

    all_models = catalog_data.get('models', [])
    live2d_models = [m for m in all_models if m.get('model_type') == 'live2d']
    print(f"Catalog loaded in {time.time()-t0:.2f}s. Found {len(live2d_models)} Live2D models out of {len(all_models)} total.")

    if args.offset > 0:
        live2d_models = live2d_models[args.offset:]
    if args.limit > 0:
        live2d_models = live2d_models[:args.limit]

    total_to_process = len(live2d_models)
    print(f"Processing {total_to_process} models from base dir: {args.models_dir}")

    results = []
    dsl_count = 0
    format_counts = Counter()
    error_count = 0

    t_start = time.time()
    for idx, model_meta in enumerate(live2d_models, 1):
        rec = process_model(model_meta, args.models_dir)
        format_counts[rec.get('format') or 'none'] += 1

        if rec.get('error'):
            error_count += 1

        if rec.get('has_dsl'):
            dsl_count += 1
            results.append(rec)
        elif not args.dsl_only:
            results.append(rec)

        if idx % 500 == 0 or idx == total_to_process:
            elapsed = time.time() - t_start
            rate = idx / elapsed if elapsed > 0 else 0
            print(f"[{idx}/{total_to_process}] ({idx/total_to_process*100:.1f}%) - "
                  f"DSL found: {dsl_count}, Rate: {rate:.1f} models/s, Elapsed: {elapsed:.1f}s")

    elapsed_total = time.time() - t_start
    print(f"\nCompleted in {elapsed_total:.2f}s ({len(live2d_models)/elapsed_total:.1f} models/s)")
    print(f"Format summary: {dict(format_counts)}")
    print(f"Total DSL models found: {dsl_count}")
    print(f"Errors: {error_count}")

    output_payload = {
        'extracted_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'total_scanned': total_to_process,
        'dsl_models_count': dsl_count,
        'format_summary': dict(format_counts),
        'elapsed_seconds': round(elapsed_total, 2),
        'models': results
    }

    print(f"Saving output to: {args.output}")
    out_dir = os.path.dirname(args.output)
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output_payload, f, ensure_ascii=False, indent=2)

    file_size_mb = os.path.getsize(args.output) / (1024 * 1024)
    print(f"Successfully saved {file_size_mb:.2f} MB to {args.output}")


if __name__ == '__main__':
    main()
