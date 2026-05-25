# Local Models on NVIDIA GTX 1060 3GB

Setup guide for running uncensored local models on a GTX 1060 3GB (Pascal architecture) with AIRI via Ollama.

## Hardware Constraints

The primary bottleneck is the **3072 MB VRAM limit**. The OS and display driver reserve 300–600 MB, leaving **2.4–2.7 GB usable** before offloading to system RAM (CPU), which drops inference speed by ~90%.

### Pascal-Specific Warning

If you exceed 3GB, the GTX 1060 offloads layers to system RAM via the PCIe bus. On Pascal cards, this causes **stuttering** — tokens appear in bursts of 5 followed by a 2-second pause.

## Prerequisites

1. **Ollama** installed and running with proper environment variables
2. **AIRI** connected to your Ollama instance

### Installing Ollama

```bash
# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Verify installation
ollama --version
```

### Configuring Ollama for AIRI

Ollama requires two environment variables for AIRI to connect:

1. **`OLLAMA_ORIGINS="*"`** — CORS (required for web app → Ollama)
2. **`OLLAMA_HOST="0.0.0.0"`** — bind address (ensures Ollama listens on all interfaces)

```bash
# Linux (systemd)
sudo systemctl edit ollama
```

Add:
```ini
[Service]
Environment="OLLAMA_ORIGINS=*"
Environment="OLLAMA_HOST=0.0.0.0"
```

Then restart:
```bash
sudo systemctl restart ollama
```

Or set temporarily:
```bash
export OLLAMA_ORIGINS="*"
export OLLAMA_HOST="0.0.0.0"
ollama serve
```

See the [Ollama Integration Guide](./ollama.md) for platform-specific instructions (macOS, Windows, etc.).

## Recommended Models

All models use **GGUF K-Quants** via Ollama, which is the only format that effectively utilizes Pascal's FP32 performance (bypassing the architecture's slow FP16 processing).

> **Avoid EXL2 / AWQ formats** — these are optimized for Tensor Cores (RTX 20-series+). On Pascal, they run at ~2 tokens/second.

### Primary Recommendations

| Model | Parameters | Quant | VRAM (2k ctx) | VRAM (4k ctx) | Speed (t/s) | Best For |
|-------|-----------|-------|---------------|---------------|-------------|----------|
| `gemma-2-2b` | 2.6B | Q4_K_M | ~2.1 GB | ~2.4 GB | 25–35 | High-quality chat, creative |
| `qwen2.5-1.5b` | 1.5B | Q4_K_M | ~1.3 GB | ~1.5 GB | 50–70 | Coding, large context (8k) |
| `llama-3.2-3b` | 3.2B | Q3_K_M | ~1.9 GB | ~2.2 GB | 20–30 | Best reasoning, all-rounder |

### Extended Options

| Model | Parameters | Quant | VRAM (2k ctx) | Speed (t/s) | Best For |
|-------|-----------|-------|---------------|-------------|----------|
| `llama-3.2-1b` | 1.2B | Q4_K_M | ~1.1 GB | 60–90 | Maximum context (16k–32k) |
| `smollm2-1.7b` | 1.7B | Q4_K_M | ~1.4 GB | 45–60 | Instruction following |
| `phi-3-mini` | 3.8B | Q3_K_S | ~2.3 GB | 15–20 | Scientific/logical reasoning |

### Quantization Guidelines

- **Under 2B parameters**: Use **4-bit** (Q4_K_M). 3-bit causes "intelligence collapse" in small models (broken syntax/hallucinations).
- **Above 2B parameters**: Use **3-bit** (Q3_K_M) to save VRAM. Higher parameter count retains reasoning at lower bit-depths.

## Pulling Models

Use the helper script below, or pull manually:

```bash
# Best all-rounder (uncensored, creative)
ollama pull gemma2:2b-instruct-q4_K_M

# Best for coding + large context
ollama pull qwen2.5:1.5b-instruct-q4_K_M

# Best reasoning (3-bit to fit in VRAM)
ollama pull llama3.2:3b-instruct-q3_K_M

# Fastest, maximum context
ollama pull llama3.2:1b-instruct-q4_K_M
```

### Uncensored Models (≤3B, verified)

These are the only uncensored models on Ollama's library that fit within 3GB VRAM:

| Model | Parameters | Size | Context | Description |
|-------|-----------|------|---------|-------------|
| `tinydolphin:1.1b` | 1.1B | 637MB | 4K | Uncensored, trained on Dolphin 2.8 dataset by Eric Hartford, based on TinyLlama |
| `dolphin-phi:2.7b` | 2.7B | 1.6GB | 2K | Explicitly uncensored, based on Microsoft Phi by Eric Hartford |

```bash
# Pull uncensored models
ollama pull tinydolphin:1.1b
ollama pull dolphin-phi:2.7b
```

> **Note**: Other uncensored models exist on Ollama (e.g., `llama2-uncensored:7b`, `wizardlm-uncensored:13b`, `wizard-vicuna-uncensored:7b`) but they are **all >3B parameters** and will not fit in 3GB VRAM. The two models above are the only verified uncensored options that work on a GTX 1060 3GB.

### Large Models (7B/13B) — 8GB+ VRAM Recommended

If you have a more powerful GPU (8GB+ VRAM), these uncensored models offer significantly better quality:

| Model | Parameters | Size | Speed (t/s) | Description |
|-------|-----------|------|-------------|-------------|
| `llama2-uncensored:7b-chat-q2_K` | 7B | ~2.8 GB | 5–15 | Minimum VRAM uncensored |
| `llama2-uncensored:7b-chat-q3_K_M` | 7B | ~3.3 GB | 5–15 | Better quality |
| `wizard-vicuna-uncensored:7b` | 7B | ~3.8 GB | 5–15 | Good uncensored chat |
| `wizardlm-uncensored:13b` | 13B | ~7.4 GB | 2–8 | Best uncensored quality |

> ⚠️ **GTX 1060 3GB warning**: These models will stutter severely on 3GB VRAM. Only use them with 8GB+ VRAM.

## Context Window Strategy

The KV Cache scales linearly with token count (~50–150 MB per 1024 tokens).

1. **Llama-3.2-1B**: Model weights ~0.8 GB → push context to **16k–32k** tokens
2. **Gemma-2-2B / Llama-3.2-3B**: Use Q3_K_M to sustain **4k–8k** context
3. **Qwen2.5-1.5B**: Comfortable at **8k** context

## Connecting to AIRI

1. Open AIRI → Settings → Providers → Ollama
2. Set Base URL: `http://localhost:11434/v1/`
3. Click "Validate" to confirm connectivity
4. Go to Settings → Modules → Consciousness
5. Select your Ollama model from the dropdown

The Ollama provider auto-discovers all pulled models — no manual configuration needed.

## Helper Script

Use [`scripts/setup-local-models.sh`](https://github.com/moeru-ai/airi/blob/main/scripts/setup-local-models.sh) to automate the full setup:

```bash
# Make executable
chmod +x scripts/setup-local-models.sh

# Run interactive setup
./scripts/setup-local-models.sh

# Or specify models directly
./scripts/setup-local-models.sh --models "gemma2:2b-instruct-q4_K_M,qwen2.5:1.5b-instruct-q4_K_M"

# Auto-pull recommended + uncensored models
./scripts/setup-local-models.sh --auto --uncensored

# Auto-pull recommended + uncensored + large models (8GB+ VRAM)
./scripts/setup-local-models.sh --auto --uncensored --large
```

**CLI flags:**

| Flag | Description |
|------|-------------|
| `--auto` | Non-interactive, pull recommended models |
| `--models "m1,m2"` | Pull specific models (comma-separated) |
| `--check` | Check Ollama status only |
| `--uncensored` | Include uncensored models (≤3B) |
| `--large` | Include large 7B/13B models (8GB+ VRAM recommended) |
| `--help` | Show usage information |
```

## Troubleshooting

### "Stuttering" output (bursts of 5 tokens, then pause)
- **Cause**: VRAM exceeded, offloading to system RAM
- **Fix**: Use a smaller quant (Q3 instead of Q4), reduce context window, or switch to a smaller model

### "Connection refused" / "Failed to fetch" in AIRI
- **Cause**: Ollama not running, CORS not configured, or wrong bind address
- **Fix**: Set both env vars and restart:
  ```bash
  export OLLAMA_ORIGINS="*"
  export OLLAMA_HOST="0.0.0.0"
  ollama serve
  ```

### "Extra configuration needed for Ollama" (OLLAMA_HOST)
- **Cause**: Ollama is running but AIRI can't reach it
- **Fix**: Set `OLLAMA_HOST="0.0.0.0"` and restart Ollama

### Models not appearing in AIRI
- **Cause**: Provider not validated
- **Fix**: Go to Settings → Providers → Ollama → click "Validate"

### Slow inference (< 10 t/s on small models)
- **Cause**: Wrong format (EXL2/AWQ instead of GGUF)
- **Fix**: Ensure you're pulling GGUF models via Ollama (default)
