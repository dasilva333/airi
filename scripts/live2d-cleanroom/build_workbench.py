#!/usr/bin/env python3
"""
build_workbench.py - Compiles the standalone Live2D Gimmick Deck Cleanroom Workbench.
Embeds fixtures/sample_dsl_models_en.json into a dependency-free, modern glassmorphic HTML testbench.
Supports English translations, bilingual subtitles, and instant language toggling.
"""

import json
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FIXTURE_PATH = os.path.join(BASE_DIR, 'fixtures', 'sample_dsl_models_en.json')
FALLBACK_PATH = os.path.join(BASE_DIR, 'fixtures', 'sample_dsl_models.json')
OUTPUT_PATH = os.path.join(BASE_DIR, 'index.html')

def load_fixture():
    path = FIXTURE_PATH if os.path.isfile(FIXTURE_PATH) else FALLBACK_PATH
    if not os.path.isfile(path):
        print(f"Error: Fixture not found at {path}", file=sys.stderr)
        sys.exit(1)
    print(f"Using fixture: {path}")
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live2D Gimmick Deck &amp; DSL Views Explorer</title>
  <style>
    :root {
      --bg-main: #0b0f19;
      --bg-surface: #111827;
      --bg-surface-elevated: #1f2937;
      --bg-surface-hover: #263345;
      --border-color: rgba(255, 255, 255, 0.08);
      --border-color-hover: rgba(255, 255, 255, 0.18);
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --text-dim: #6b7280;
      
      --c-cutscenes: #f43f5e;
      --c-cutscenes-bg: rgba(244, 63, 94, 0.12);
      --c-commands: #f59e0b;
      --c-commands-bg: rgba(245, 158, 11, 0.12);
      --c-varfloats: #0ea5e9;
      --c-varfloats-bg: rgba(14, 165, 233, 0.12);
      --c-costumes: #a855f7;
      --c-costumes-bg: rgba(168, 85, 247, 0.12);
      --c-intimacy: #10b981;
      --c-intimacy-bg: rgba(16, 185, 129, 0.12);
      --c-params: #f97316;
      --c-params-bg: rgba(249, 115, 22, 0.12);
      --c-choices: #6366f1;
      --c-choices-bg: rgba(99, 102, 241, 0.12);
      --c-all: #38bdf8;
      --c-all-bg: rgba(56, 189, 248, 0.12);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-main);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      padding-bottom: 4rem;
      line-height: 1.5;
    }

    /* Top Navigation Header */
    header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(11, 15, 25, 0.88);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-color);
      padding: 0.85rem 2rem;
    }

    .header-inner {
      max-width: 1700px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-badge {
      background: linear-gradient(135deg, #0ea5e9, #a855f7);
      color: #fff;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .brand h1 {
      font-size: 1.2rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.01em;
    }

    .header-tools {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      flex-wrap: wrap;
    }

    .search-input {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      border-radius: 8px;
      padding: 0.45rem 0.9rem;
      font-size: 0.85rem;
      min-width: 280px;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-input:focus {
      border-color: #0ea5e9;
    }

    .segmented-picker {
      display: flex;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }

    .seg-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 0.45rem 0.8rem;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .seg-btn.active, .seg-btn:hover {
      background: var(--bg-surface-elevated);
      color: #fff;
    }
    .seg-btn.active {
      color: #38bdf8;
    }

    /* Main Container */
    main {
      max-width: 1700px;
      margin: 0 auto;
      padding: 1.75rem 2rem;
    }

    /* 4x2 Navigator Cards Grid */
    .nav-grid-title {
      font-size: 0.82rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .nav-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.75rem;
    }

    @media (max-width: 1100px) {
      .nav-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 640px) {
      .nav-grid {
        grid-template-columns: 1fr;
      }
    }

    .nav-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }

    .nav-card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--card-accent, transparent);
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .nav-card:hover {
      background: var(--bg-surface-hover);
      border-color: var(--border-color-hover);
      transform: translateY(-2px);
    }

    .nav-card.active {
      background: var(--bg-surface-elevated);
      border-color: var(--card-accent, #38bdf8);
      box-shadow: 0 0 20px -5px var(--card-accent-glow, rgba(56, 189, 248, 0.3));
    }
    .nav-card.active::before {
      opacity: 1;
      height: 4px;
    }

    .nav-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.4rem;
    }

    .nav-card-icon-title {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .nav-card-icon {
      font-size: 1.25rem;
      line-height: 1;
    }

    .nav-card-title {
      font-size: 0.92rem;
      font-weight: 700;
      color: #fff;
    }

    .nav-card-count {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      background: var(--card-accent-bg, rgba(255, 255, 255, 0.08));
      color: var(--card-accent, #fff);
    }

    .nav-card-stats {
      font-size: 0.74rem;
      color: var(--text-dim);
      margin-top: 0.2rem;
    }

    /* Active Filter Banner */
    .filter-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.75rem 1.25rem;
      margin-bottom: 1.5rem;
    }

    .filter-banner-text {
      font-size: 0.88rem;
      color: var(--text-muted);
    }
    .filter-banner-text strong {
      color: #fff;
    }

    /* Model Cards Grid */
    .models-grid {
      display: grid;
      gap: 1.5rem;
    }
    .models-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
    .models-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
    .models-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }

    @media (max-width: 1400px) {
      .models-grid.cols-4 { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 1024px) {
      .models-grid.cols-3, .models-grid.cols-4 { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 720px) {
      .models-grid.cols-2, .models-grid.cols-3, .models-grid.cols-4 { grid-template-columns: 1fr; }
    }

    /* Model Item Card */
    .model-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .model-card:hover {
      border-color: var(--border-color-hover);
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.4);
    }

    .model-header {
      padding: 1rem 1.25rem;
      background: rgba(255, 255, 255, 0.02);
      border-bottom: 1px solid var(--border-color);
    }

    .model-meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.35rem;
    }

    .model-id-badge {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.74rem;
      color: var(--text-dim);
      background: rgba(255, 255, 255, 0.04);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }

    .model-format-badge {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
    }
    .badge-model3 {
      background: rgba(14, 165, 233, 0.15);
      color: #38bdf8;
    }
    .badge-model2 {
      background: rgba(168, 85, 247, 0.15);
      color: #c084fc;
    }

    .model-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #fff;
      line-height: 1.3;
      margin-bottom: 0.5rem;
      word-break: break-word;
    }

    .model-title-sub {
      font-size: 0.78rem;
      color: var(--text-dim);
      margin-top: -0.3rem;
      margin-bottom: 0.5rem;
      font-weight: 400;
    }

    .model-tags-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .tag-pill {
      font-size: 0.68rem;
      font-weight: 600;
      padding: 0.15rem 0.45rem;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    /* Card Body / Control Sections */
    .model-body {
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
      flex-grow: 1;
    }

    .form-section {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.85rem 1rem;
    }

    .section-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.6rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Section 1: Costumes */
    .costume-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .costume-pill {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 0.3rem 0.65rem;
      border-radius: 6px;
      font-size: 0.75rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      transition: all 0.15s;
    }
    .costume-pill:hover {
      border-color: var(--c-costumes);
      color: #fff;
    }
    .costume-pill.active {
      background: var(--c-costumes-bg);
      border-color: var(--c-costumes);
      color: #fff;
      font-weight: 600;
    }

    /* Section 2: VarFloats / Toggles */
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.4rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .toggle-row:last-child {
      border-bottom: none;
    }
    .toggle-info {
      display: flex;
      flex-direction: column;
    }
    .toggle-name {
      font-size: 0.82rem;
      font-weight: 600;
      color: #fff;
    }
    .toggle-sub {
      font-size: 0.7rem;
      color: var(--text-dim);
    }
    .toggle-code {
      font-size: 0.68rem;
      font-family: monospace;
      color: var(--text-dim);
    }
    .switch-btn {
      width: 42px;
      height: 22px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 9999px;
      position: relative;
      cursor: pointer;
      transition: background-color 0.2s;
      border: none;
      outline: none;
      flex-shrink: 0;
    }
    .switch-btn::after {
      content: "";
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s;
    }
    .switch-btn.active {
      background: var(--c-varfloats);
    }
    .switch-btn.active::after {
      transform: translateX(20px);
    }

    /* Section 3: Sliders (ParamValue) */
    .slider-row {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.4rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .slider-row:last-child {
      border-bottom: none;
    }
    .slider-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 0.78rem;
    }
    .slider-name-box {
      display: flex;
      align-items: baseline;
      gap: 0.35rem;
      flex-wrap: wrap;
    }
    .slider-name {
      font-weight: 600;
      color: #fff;
    }
    .slider-orig-name {
      font-size: 0.68rem;
      color: var(--text-dim);
    }
    .slider-val {
      font-family: monospace;
      color: var(--c-params);
      font-weight: 700;
    }
    .slider-input {
      width: 100%;
      accent-color: var(--c-params);
      cursor: pointer;
    }

    /* Section 4: Choices */
    .choice-group {
      margin-bottom: 0.6rem;
      padding-bottom: 0.6rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .choice-group:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .choice-prompt-box {
      margin-bottom: 0.4rem;
    }
    .choice-prompt {
      font-size: 0.82rem;
      color: #e5e7eb;
      font-style: italic;
    }
    .choice-prompt-sub {
      font-size: 0.7rem;
      color: var(--text-dim);
      font-style: normal;
    }
    .choice-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .choice-btn {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-color);
      color: #fff;
      border-radius: 6px;
      padding: 0.3rem 0.65rem;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.15s;
      display: inline-flex;
      align-items: baseline;
      gap: 0.3rem;
    }
    .choice-btn:hover {
      border-color: var(--c-choices);
      background: var(--c-choices-bg);
    }
    .choice-sub {
      font-size: 0.68rem;
      color: var(--text-muted);
      opacity: 0.75;
    }
    .choice-target {
      font-size: 0.65rem;
      color: var(--text-dim);
    }

    /* Section 5: Cutscenes & Voice Dialogue */
    .cutscene-item {
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .cutscene-item:last-child {
      border-bottom: none;
    }
    .cutscene-text {
      font-size: 0.84rem;
      color: #f9fafb;
      line-height: 1.35;
      font-weight: 500;
    }
    .cutscene-sub-text {
      font-size: 0.72rem;
      color: var(--text-dim);
      line-height: 1.25;
    }
    .cutscene-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-top: 0.15rem;
    }
    .cutscene-sound {
      font-size: 0.68rem;
      font-family: monospace;
      color: var(--text-dim);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 170px;
    }
    .trigger-btn {
      background: var(--c-cutscenes-bg);
      border: 1px solid var(--c-cutscenes);
      color: #fff;
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      transition: all 0.15s;
    }
    .trigger-btn:hover {
      background: var(--c-cutscenes);
    }

    /* Section 6: Intimacy Meter */
    .intimacy-meter-box {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .intimacy-label-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
    }
    .intimacy-bar {
      height: 8px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 9999px;
      overflow: hidden;
    }
    .intimacy-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #34d399);
      width: 65%;
      border-radius: 9999px;
    }

    /* Section 7: Semicolon Commands */
    .commands-box {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .cmd-badge {
      font-family: monospace;
      font-size: 0.68rem;
      background: rgba(245, 158, 11, 0.1);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Toast Notification */
    #toast-box {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      z-index: 100;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
    }
    .toast {
      background: var(--bg-surface-elevated);
      border: 1px solid #0ea5e9;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      border-radius: 8px;
      padding: 0.85rem 1.25rem;
      color: #fff;
      font-size: 0.85rem;
      max-width: 420px;
      animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: var(--text-dim);
      font-size: 1rem;
      grid-column: 1 / -1;
    }
  </style>
</head>
<body>

  <!-- Top Header -->
  <header>
    <div class="header-inner">
      <div class="brand">
        <span class="brand-badge">AIRI Cleanroom</span>
        <h1>Live2D Gimmick Deck &amp; DSL Views Explorer</h1>
      </div>

      <div class="header-tools">
        <input type="text" id="searchInput" class="search-input" placeholder="Search models, IDs, dialogue text...">
        
        <!-- Language Switcher: Bilingual vs Original -->
        <div class="segmented-picker" id="langPicker">
          <button class="seg-btn active" data-lang="bilingual">EN (Bilingual)</button>
          <button class="seg-btn" data-lang="en_only">EN Only</button>
          <button class="seg-btn" data-lang="raw">Original Raw</button>
        </div>

        <!-- Column Count Picker -->
        <div class="segmented-picker" id="colPicker">
          <button class="seg-btn" data-cols="2">2 Cols</button>
          <button class="seg-btn active" data-cols="3">3 Cols</button>
          <button class="seg-btn" data-cols="4">4 Cols</button>
        </div>
      </div>
    </div>
  </header>

  <main>
    <!-- 4x2 Navigator Cards Grid -->
    <div class="nav-grid-title">
      <span>Capability Navigators (4×2 Views)</span>
      <span id="sampleStats">Loading fixture data...</span>
    </div>

    <div class="nav-grid" id="navGrid">
      <!-- 1. Cutscenes / Voice Dialogue -->
      <div class="nav-card" data-filter="cutscenes" style="--card-accent: var(--c-cutscenes); --card-accent-bg: var(--c-cutscenes-bg); --card-accent-glow: rgba(244, 63, 94, 0.3);">
        <div>
          <div class="nav-card-top">
            <div class="nav-card-icon-title">
              <span class="nav-card-icon">🎬</span>
              <span class="nav-card-title">Cutscenes &amp; Dialogue</span>
            </div>
            <span class="nav-card-count" id="count-cutscenes">--</span>
          </div>
          <div class="nav-card-stats">1,994 models in collection · Subtitles &amp; Voice</div>
        </div>
      </div>

      <!-- 2. Semicolon Commands -->
      <div class="nav-card" data-filter="commands" style="--card-accent: var(--c-commands); --card-accent-bg: var(--c-commands-bg); --card-accent-glow: rgba(245, 158, 11, 0.3);">
        <div>
          <div class="nav-card-top">
            <div class="nav-card-icon-title">
              <span class="nav-card-icon">⚡</span>
              <span class="nav-card-title">Semicolon Commands</span>
            </div>
            <span class="nav-card-count" id="count-commands">--</span>
          </div>
          <div class="nav-card-stats">629 models in collection · Command &amp; PostCommand</div>
        </div>
      </div>

      <!-- 3. VarFloats State Machines -->
      <div class="nav-card" data-filter="var_floats" style="--card-accent: var(--c-varfloats); --card-accent-bg: var(--c-varfloats-bg); --card-accent-glow: rgba(14, 165, 233, 0.3);">
        <div>
          <div class="nav-card-top">
            <div class="nav-card-icon-title">
              <span class="nav-card-icon">🎛️</span>
              <span class="nav-card-title">VarFloats Registers</span>
            </div>
            <span class="nav-card-count" id="count-var_floats">--</span>
          </div>
          <div class="nav-card-stats">516 models in collection · Variable State Guards</div>
        </div>
      </div>

      <!-- 4. Costumes -->
      <div class="nav-card" data-filter="costumes" style="--card-accent: var(--c-costumes); --card-accent-bg: var(--c-costumes-bg); --card-accent-glow: rgba(168, 85, 247, 0.3);">
        <div>
          <div class="nav-card-top">
            <div class="nav-card-icon-title">
              <span class="nav-card-icon">👗</span>
              <span class="nav-card-title">Wardrobe &amp; Costumes</span>
            </div>
            <span class="nav-card-count" id="count-costumes">--</span>
          </div>
          <div class="nav-card-stats">296 models in collection · change_cos Multi-MOC</div>
        </div>
      </div>

      <!-- 5. Intimacy Bounds / Tiers -->
      <div class="nav-card" data-filter="intimacy" style="--card-accent: var(--c-intimacy); --card-accent-bg: var(--c-intimacy-bg); --card-accent-glow: rgba(16, 185, 129, 0.3);">
        <div>
          <div class="nav-card-top">
            <div class="nav-card-icon-title">
              <span class="nav-card-icon">💖</span>
              <span class="nav-card-title">Intimacy &amp; Tiers</span>
            </div>
            <span class="nav-card-count" id="count-intimacy">--</span>
          </div>
          <div class="nav-card-stats">276 models in collection · Affinity Progression</div>
        </div>
      </div>

      <!-- 6. ParamValue Sliders -->
      <div class="nav-card" data-filter="param_values" style="--card-accent: var(--c-params); --card-accent-bg: var(--c-params-bg); --card-accent-glow: rgba(249, 115, 22, 0.3);">
        <div>
          <div class="nav-card-top">
            <div class="nav-card-icon-title">
              <span class="nav-card-icon">🎚️</span>
              <span class="nav-card-title">ParamValue Sliders</span>
            </div>
            <span class="nav-card-count" id="count-param_values">--</span>
          </div>
          <div class="nav-card-stats">254 models in collection · Parts &amp; Mesh Sliders</div>
        </div>
      </div>

      <!-- 7. Choice Trees -->
      <div class="nav-card" data-filter="choices" style="--card-accent: var(--c-choices); --card-accent-bg: var(--c-choices-bg); --card-accent-glow: rgba(99, 102, 241, 0.3);">
        <div>
          <div class="nav-card-top">
            <div class="nav-card-icon-title">
              <span class="nav-card-icon">🌳</span>
              <span class="nav-card-title">Choice Trees &amp; Menus</span>
            </div>
            <span class="nav-card-count" id="count-choices">--</span>
          </div>
          <div class="nav-card-stats">144 models in collection · Branching Choice Options</div>
        </div>
      </div>

      <!-- 8. All Models Overview -->
      <div class="nav-card active" data-filter="all" style="--card-accent: var(--c-all); --card-accent-bg: var(--c-all-bg); --card-accent-glow: rgba(56, 189, 248, 0.3);">
        <div>
          <div class="nav-card-top">
            <div class="nav-card-icon-title">
              <span class="nav-card-icon">🌟</span>
              <span class="nav-card-title">All Sample Models</span>
            </div>
            <span class="nav-card-count" id="count-all">--</span>
          </div>
          <div class="nav-card-stats">4,816 total DSL models in collection · Combined View</div>
        </div>
      </div>
    </div>

    <!-- Active Filter Banner -->
    <div class="filter-banner">
      <div class="filter-banner-text" id="filterStatus">
        Showing: <strong>All Models</strong>
      </div>
      <div class="filter-banner-text" id="modelCountBadge">
        Showing 0 models
      </div>
    </div>

    <!-- Model Cards Dynamic Grid -->
    <div class="models-grid cols-3" id="modelsGrid">
      <!-- Injected via JavaScript -->
    </div>
  </main>

  <div id="toast-box"></div>

  <!-- Embedded Fixture Data -->
  <script id="fixture-data" type="application/json">
__FIXTURE_JSON__
  </script>

  <script>
    (function () {
      // 1. Load Data
      let rawFixture = {};
      try {
        const rawText = document.getElementById('fixture-data').textContent;
        rawFixture = JSON.parse(rawText);
      } catch (err) {
        console.error("Failed to parse embedded fixture data:", err);
      }

      const allModels = rawFixture.models || [];
      let currentFilter = 'all';
      let currentSearch = '';
      let currentCols = 3;
      let currentLang = 'bilingual'; // 'bilingual', 'en_only', 'raw'

      // Local interactive state for controls (switches, sliders, costumes)
      const modelState = {};
      allModels.forEach(m => {
        modelState[m.id] = {
          activeCostume: m.features?.costumes?.[0] || 'Default',
          varStates: {},
          sliderValues: {}
        };
        // Init var states
        (m.features?.var_floats || []).forEach(v => {
          modelState[m.id].varStates[v.Name] = false;
        });
        // Init slider states
        (m.features?.param_values || []).forEach(p => {
          modelState[m.id].sliderValues[p.Name] = p.Value !== undefined ? p.Value : 0.5;
        });
      });

      // 2. Count Capabilities
      const counts = {
        all: allModels.length,
        cutscenes: allModels.filter(m => (m.features?.cutscene_count || 0) > 0).length,
        commands: allModels.filter(m => (m.features?.command_count || 0) > 0).length,
        var_floats: allModels.filter(m => (m.features?.var_float_count || 0) > 0).length,
        costumes: allModels.filter(m => (m.features?.costume_count || 0) > 0).length,
        intimacy: allModels.filter(m => m.features?.has_intimacy).length,
        param_values: allModels.filter(m => (m.features?.param_value_count || 0) > 0).length,
        choices: allModels.filter(m => (m.features?.choice_count || 0) > 0).length,
      };

      Object.keys(counts).forEach(k => {
        const el = document.getElementById('count-' + k);
        if (el) el.textContent = counts[k];
      });

      document.getElementById('sampleStats').textContent = `${allModels.length} models in English-enriched sample`;

      // 3. Filtering & Searching Logic
      function matchesFilter(m) {
        const f = m.features || {};
        switch (currentFilter) {
          case 'cutscenes': return (f.cutscene_count || 0) > 0;
          case 'commands': return (f.command_count || 0) > 0;
          case 'var_floats': return (f.var_float_count || 0) > 0;
          case 'costumes': return (f.costume_count || 0) > 0;
          case 'intimacy': return !!f.has_intimacy;
          case 'param_values': return (f.param_value_count || 0) > 0;
          case 'choices': return (f.choice_count || 0) > 0;
          case 'all':
          default:
            return true;
        }
      }

      function matchesSearch(m) {
        if (!currentSearch) return true;
        const q = currentSearch.toLowerCase();
        if (m.title && m.title.toLowerCase().includes(q)) return true;
        if (m.title_en && m.title_en.toLowerCase().includes(q)) return true;
        if (m.id && m.id.toLowerCase().includes(q)) return true;
        
        // Search inside dialogue text (both raw and en)
        if (m.features?.cutscenes?.some(c => 
          (c.text && c.text.toLowerCase().includes(q)) || 
          (c.text_en && c.text_en.toLowerCase().includes(q))
        )) return true;

        // Search inside choices
        if (m.features?.choices?.some(c => 
          (c.text && c.text.toLowerCase().includes(q)) || 
          (c.text_en && c.text_en.toLowerCase().includes(q)) ||
          c.choices?.some(x => (x.Text && x.Text.toLowerCase().includes(q)) || (x.Text_en && x.Text_en.toLowerCase().includes(q)))
        )) return true;

        // Search inside params
        if (m.features?.param_values?.some(p => 
          (p.Name && p.Name.toLowerCase().includes(q)) || 
          (p.Name_en && p.Name_en.toLowerCase().includes(q))
        )) return true;

        return false;
      }

      // 4. Toast Notification
      function showToast(title, body) {
        const box = document.getElementById('toast-box');
        const t = document.createElement('div');
        t.className = 'toast';
        t.innerHTML = `<strong style="display:block; margin-bottom: 0.25rem; color: #38bdf8;">${escapeHtml(title)}</strong><div>${escapeHtml(body)}</div>`;
        box.appendChild(t);
        setTimeout(() => {
          t.style.opacity = '0';
          t.style.transform = 'translateY(10px)';
          t.style.transition = 'all 0.3s';
          setTimeout(() => t.remove(), 300);
        }, 4000);
      }

      function escapeHtml(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      // Helper to resolve localized text according to active language mode
      function resolveText(primaryEn, origRaw) {
        const hasEn = primaryEn && primaryEn !== origRaw;
        if (currentLang === 'raw') {
          return { main: origRaw || primaryEn, sub: '' };
        }
        if (currentLang === 'en_only') {
          return { main: primaryEn || origRaw, sub: '' };
        }
        // Bilingual
        if (hasEn) {
          return { main: primaryEn, sub: origRaw };
        }
        return { main: origRaw || primaryEn, sub: '' };
      }

      // 5. Render Forms for Each Model
      function renderModels() {
        const grid = document.getElementById('modelsGrid');
        const filtered = allModels.filter(m => matchesFilter(m) && matchesSearch(m));

        document.getElementById('modelCountBadge').textContent = `Showing ${filtered.length} of ${allModels.length} models`;

        if (filtered.length === 0) {
          grid.innerHTML = `<div class="empty-state">No models match the active navigator filter and search query.</div>`;
          return;
        }

        grid.innerHTML = filtered.map(m => renderModelCard(m)).join('');
        attachCardListeners();
      }

      function renderModelCard(m) {
        const f = m.features || {};
        const state = modelState[m.id];
        const formatBadgeClass = m.format === 'model3' ? 'badge-model3' : 'badge-model2';

        // Title resolution
        const titleRes = resolveText(m.title_en, m.title);

        // Tag Pills
        const tags = [];
        if (f.costume_count > 0) tags.push(`<span class="tag-pill" style="background:var(--c-costumes-bg); color:var(--c-costumes)">👗 ${f.costume_count} Costumes</span>`);
        if (f.var_float_count > 0) tags.push(`<span class="tag-pill" style="background:var(--c-varfloats-bg); color:var(--c-varfloats)">🎛️ ${f.var_float_count} VarFloats</span>`);
        if (f.choice_count > 0) tags.push(`<span class="tag-pill" style="background:var(--c-choices-bg); color:var(--c-choices)">🌳 ${f.choice_count} Menus</span>`);
        if (f.param_value_count > 0) tags.push(`<span class="tag-pill" style="background:var(--c-params-bg); color:var(--c-params)">🎚️ ${f.param_value_count} Sliders</span>`);
        if (f.cutscene_count > 0) tags.push(`<span class="tag-pill" style="background:var(--c-cutscenes-bg); color:var(--c-cutscenes)">🎬 ${f.cutscene_count} Voices</span>`);
        if (f.has_intimacy) tags.push(`<span class="tag-pill" style="background:var(--c-intimacy-bg); color:var(--c-intimacy)">💖 Intimacy</span>`);
        if (f.command_count > 0) tags.push(`<span class="tag-pill" style="background:var(--c-commands-bg); color:var(--c-commands)">⚡ ${f.command_count} Commands</span>`);

        return `
          <div class="model-card" data-model-id="${m.id}">
            <div class="model-header">
              <div class="model-meta-row">
                <span class="model-id-badge">ID: ${escapeHtml(m.id)}</span>
                <span class="model-format-badge ${formatBadgeClass}">${escapeHtml(m.format || 'Live2D')}</span>
              </div>
              <h2 class="model-title">${escapeHtml(titleRes.main)}</h2>
              ${titleRes.sub ? `<div class="model-title-sub">${escapeHtml(titleRes.sub)}</div>` : ''}
              <div class="model-tags-row">${tags.join('')}</div>
            </div>

            <div class="model-body">
              ${renderCostumesSection(m, f, state)}
              ${renderVarFloatsSection(m, f, state)}
              ${renderParamValuesSection(m, f, state)}
              ${renderChoicesSection(m, f)}
              ${renderCutscenesSection(m, f)}
              ${renderIntimacySection(m, f)}
              ${renderCommandsSection(m, f)}
            </div>
          </div>
        `;
      }

      function renderCostumesSection(m, f, state) {
        if (!f.costume_count || !f.costumes?.length) return '';
        const items = f.costumes.map(c => {
          const isActive = state.activeCostume === c;
          return `<button class="costume-pill ${isActive ? 'active' : ''}" data-model="${m.id}" data-costume="${escapeHtml(c)}">
            ${isActive ? '●' : '○'} ${escapeHtml(c)}
          </button>`;
        }).join('');

        return `
          <div class="form-section">
            <div class="section-title" style="color:var(--c-costumes)">
              <span>👗 Wardrobe / Costumes (${f.costume_count})</span>
              <span style="font-size:0.65rem; color:var(--text-dim);">change_cos</span>
            </div>
            <div class="costume-list">${items}</div>
          </div>
        `;
      }

      function renderVarFloatsSection(m, f, state) {
        if (!f.var_float_count || !f.var_floats?.length) return '';
        const uniqueVars = {};
        f.var_floats.forEach(v => {
          if (!uniqueVars[v.Name]) uniqueVars[v.Name] = v;
        });

        const rows = Object.values(uniqueVars).slice(0, 6).map(v => {
          const isOn = !!state.varStates[v.Name];
          const nameRes = resolveText(v.Name_en, v.Name);
          return `
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="toggle-name">${escapeHtml(nameRes.main)}</span>
                ${nameRes.sub ? `<span class="toggle-sub">${escapeHtml(nameRes.sub)}</span>` : ''}
                <span class="toggle-code">${escapeHtml(v.Code || 'Type ' + v.Type)}</span>
              </div>
              <button class="switch-btn ${isOn ? 'active' : ''}" data-model="${m.id}" data-var="${escapeHtml(v.Name)}"></button>
            </div>
          `;
        }).join('');

        return `
          <div class="form-section">
            <div class="section-title" style="color:var(--c-varfloats)">
              <span>🎛️ VarFloats State Registers (${Object.keys(uniqueVars).length})</span>
              <span style="font-size:0.65rem; color:var(--text-dim);">GimmickSwitch</span>
            </div>
            <div>${rows}</div>
          </div>
        `;
      }

      function renderParamValuesSection(m, f, state) {
        if (!f.param_value_count || !f.param_values?.length) return '';
        const rows = f.param_values.slice(0, 5).map(p => {
          const val = state.sliderValues[p.Name] ?? 0.5;
          const pRes = resolveText(p.Name_en, p.Name);
          return `
            <div class="slider-row">
              <div class="slider-header">
                <div class="slider-name-box">
                  <span class="slider-name">${escapeHtml(pRes.main)}</span>
                  ${pRes.sub ? `<span class="slider-orig-name">(${escapeHtml(pRes.sub)})</span>` : ''}
                </div>
                <span class="slider-val" id="val-${m.id}-${escapeHtml(p.Name)}">${Number(val).toFixed(2)}</span>
              </div>
              <input type="range" class="slider-input" min="0" max="1" step="0.01" value="${val}"
                data-model="${m.id}" data-param="${escapeHtml(p.Name)}">
            </div>
          `;
        }).join('');

        return `
          <div class="form-section">
            <div class="section-title" style="color:var(--c-params)">
              <span>🎚️ Part Controllers (${f.param_value_count})</span>
              <span style="font-size:0.65rem; color:var(--text-dim);">ParamValue</span>
            </div>
            <div>${rows}</div>
          </div>
        `;
      }

      function renderChoicesSection(m, f) {
        if (!f.choice_count || !f.choices?.length) return '';
        const groups = f.choices.slice(0, 3).map(ch => {
          const promptRes = resolveText(ch.text_en, ch.text);

          const btns = (ch.choices || []).map(b => {
            const btnRes = resolveText(b.Text_en, b.Text);
            return `<button class="choice-btn" data-model="${m.id}" data-next="${escapeHtml(b.NextMtn || 'None')}" data-text="${escapeHtml(btnRes.main)}">
              <span>${escapeHtml(btnRes.main)}</span>
              ${btnRes.sub ? `<span class="choice-sub">(${escapeHtml(btnRes.sub)})</span>` : ''}
              ${b.NextMtn ? `<span class="choice-target">➔ ${escapeHtml(b.NextMtn)}</span>` : ''}
            </button>`;
          }).join('');

          return `
            <div class="choice-group">
              ${promptRes.main ? `
                <div class="choice-prompt-box">
                  <div class="choice-prompt">"${escapeHtml(promptRes.main)}"</div>
                  ${promptRes.sub ? `<div class="choice-prompt-sub">"${escapeHtml(promptRes.sub)}"</div>` : ''}
                </div>
              ` : ''}
              <div class="choice-buttons">${btns}</div>
            </div>
          `;
        }).join('');

        return `
          <div class="form-section">
            <div class="section-title" style="color:var(--c-choices)">
              <span>🌳 Creator Choice Menus (${f.choice_count})</span>
              <span style="font-size:0.65rem; color:var(--text-dim);">Choices</span>
            </div>
            <div>${groups}</div>
          </div>
        `;
      }

      function renderCutscenesSection(m, f) {
        if (!f.cutscene_count || !f.cutscenes?.length) return '';
        const items = f.cutscenes.slice(0, 4).map(c => {
          const cutRes = resolveText(c.text_en, c.text);
          return `
            <div class="cutscene-item">
              <div class="cutscene-text">"${escapeHtml(cutRes.main)}"</div>
              ${cutRes.sub ? `<div class="cutscene-sub-text">"${escapeHtml(cutRes.sub)}"</div>` : ''}
              <div class="cutscene-footer">
                <span class="cutscene-sound" title="${escapeHtml(c.sound || 'Visual Only')}">🔊 ${escapeHtml(c.sound || 'Visual')}</span>
                <button class="trigger-btn" data-model="${m.id}" data-text="${escapeHtml(cutRes.main)}" data-orig="${escapeHtml(c.text || '')}" data-sound="${escapeHtml(c.sound || '')}">
                  ▶ Trigger
                </button>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="form-section">
            <div class="section-title" style="color:var(--c-cutscenes)">
              <span>🎬 Voice &amp; Cutscene Reactions (${f.cutscene_count})</span>
              <span style="font-size:0.65rem; color:var(--text-dim);">AIRI Generative Sync</span>
            </div>
            <div>${items}</div>
          </div>
        `;
      }

      function renderIntimacySection(m, f) {
        if (!f.has_intimacy) return '';
        return `
          <div class="form-section">
            <div class="section-title" style="color:var(--c-intimacy)">
              <span>💖 Intimacy &amp; Affinity Gauge</span>
              <span style="font-size:0.65rem; color:var(--text-dim);">Tier 4 / 16</span>
            </div>
            <div class="intimacy-meter-box">
              <div class="intimacy-label-row">
                <span style="color:var(--text-muted)">Affinity Points</span>
                <span style="font-weight:700; color:#fff;">450 / 520 pts</span>
              </div>
              <div class="intimacy-bar">
                <div class="intimacy-fill"></div>
              </div>
            </div>
          </div>
        `;
      }

      function renderCommandsSection(m, f) {
        if (!f.command_count || !f.commands?.length) return '';
        const badges = f.commands.slice(0, 6).map(c => {
          return `<span class="cmd-badge" title="${escapeHtml(c)}">${escapeHtml(c)}</span>`;
        }).join('');

        return `
          <div class="form-section">
            <div class="section-title" style="color:var(--c-commands)">
              <span>⚡ Semicolon Commands (${f.command_count})</span>
              <span style="font-size:0.65rem; color:var(--text-dim);">PostCommand</span>
            </div>
            <div class="commands-box">${badges}</div>
          </div>
        `;
      }

      // 6. Interactive Listeners
      function attachCardListeners() {
        // Costumes switch
        document.querySelectorAll('.costume-pill').forEach(btn => {
          btn.addEventListener('click', function () {
            const mid = this.getAttribute('data-model');
            const costume = this.getAttribute('data-costume');
            modelState[mid].activeCostume = costume;
            const parent = this.closest('.costume-list');
            parent.querySelectorAll('.costume-pill').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            showToast("👗 Costume Switch Dispatched", `Model ${mid}: Switched costume to ${costume}`);
          });
        });

        // Var switches
        document.querySelectorAll('.switch-btn').forEach(btn => {
          btn.addEventListener('click', function () {
            const mid = this.getAttribute('data-model');
            const vname = this.getAttribute('data-var');
            const newVal = !modelState[mid].varStates[vname];
            modelState[mid].varStates[vname] = newVal;
            this.classList.toggle('active', newVal);
            showToast("🎛️ VarFloat Toggled", `Model ${mid}: ${vname} = ${newVal ? 1 : 0}`);
          });
        });

        // Param sliders
        document.querySelectorAll('.slider-input').forEach(inp => {
          inp.addEventListener('input', function () {
            const mid = this.getAttribute('data-model');
            const pname = this.getAttribute('data-param');
            const val = parseFloat(this.value);
            modelState[mid].sliderValues[pname] = val;
            const valEl = document.getElementById(`val-${mid}-${pname}`);
            if (valEl) valEl.textContent = val.toFixed(2);
          });
        });

        // Choices
        document.querySelectorAll('.choice-btn').forEach(btn => {
          btn.addEventListener('click', function () {
            const mid = this.getAttribute('data-model');
            const text = this.getAttribute('data-text');
            const next = this.getAttribute('data-next');
            showToast("🌳 Choice Selected", `Clicked: "${text}" ➔ Dispatched target: ${next}`);
          });
        });

        // Cutscene Trigger
        document.querySelectorAll('.trigger-btn').forEach(btn => {
          btn.addEventListener('click', function () {
            const mid = this.getAttribute('data-model');
            const text = this.getAttribute('data-text');
            const orig = this.getAttribute('data-orig');
            const sound = this.getAttribute('data-sound');
            showToast("🎬 AIRI Generative Sync Triggered", `Environmental Prompt Injected: "${text}"\n[Original]: "${orig}"\n[Audio Muted]: ${sound || 'none'}`);
          });
        });
      }

      // 7. Navigator Selection Listener
      document.querySelectorAll('.nav-card').forEach(card => {
        card.addEventListener('click', function () {
          document.querySelectorAll('.nav-card').forEach(c => c.classList.remove('active'));
          this.classList.add('active');
          currentFilter = this.getAttribute('data-filter');

          const filterLabels = {
            all: 'All Models (Combined View)',
            cutscenes: 'Cutscenes & Dialogue (Subtitles & Voice Actions)',
            commands: 'Semicolon Commands (Command & PostCommand)',
            var_floats: 'VarFloats Registers (Variable State Machines)',
            costumes: 'Wardrobe & Costumes (change_cos Multi-MOC)',
            intimacy: 'Intimacy & Affinity Progression',
            param_values: 'ParamValue Sliders & Part Controllers',
            choices: 'Choice Trees & Branching Creator Menus'
          };
          document.getElementById('filterStatus').innerHTML = `Showing: <strong>${filterLabels[currentFilter] || currentFilter}</strong>`;
          renderModels();
        });
      });

      // 8. Search Input Listener
      document.getElementById('searchInput').addEventListener('input', function () {
        currentSearch = this.value.trim();
        renderModels();
      });

      // 9. Language Picker Listener
      document.querySelectorAll('#langPicker .seg-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          document.querySelectorAll('#langPicker .seg-btn').forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          currentLang = this.getAttribute('data-lang');
          renderModels();
        });
      });

      // 10. Columns Picker Listener
      document.querySelectorAll('#colPicker .seg-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          document.querySelectorAll('#colPicker .seg-btn').forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          const cols = this.getAttribute('data-cols');
          currentCols = parseInt(cols, 10);
          const grid = document.getElementById('modelsGrid');
          grid.className = `models-grid cols-${currentCols}`;
        });
      });

      // Initial Render
      renderModels();
    })();
  </script>
</body>
</html>
"""

def main():
    print("Loading fixture...")
    fixture = load_fixture()
    fixture_json_str = json.dumps(fixture, ensure_ascii=False, indent=2)
    
    html = HTML_TEMPLATE.replace('__FIXTURE_JSON__', fixture_json_str)
    
    print(f"Writing workbench HTML to {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(html)
        
    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"Done! Generated standalone workbench: {OUTPUT_PATH} ({size_kb:.1f} KB)")

if __name__ == '__main__':
    main()
