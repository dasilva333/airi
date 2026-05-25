# Ollama Integration Guide

Complete guide for connecting AIRI to a local Ollama server.

## Prerequisites

- [Ollama](https://ollama.com) installed and running
- At least one model pulled (`ollama pull <model>`)

## Required Environment Variables

Ollama requires two environment variables for AIRI to connect properly:

### `OLLAMA_ORIGINS` (CORS)

Ollama blocks cross-origin requests by default. AIRI (web app) runs on a different origin than Ollama's server, so you **must** configure CORS.

```bash
export OLLAMA_ORIGINS="*"
```

Or to be more restrictive:
```bash
export OLLAMA_ORIGINS="http://localhost,http://localhost:5173,https://airi.moeru.ai"
```

### `OLLAMA_HOST` (Bind Address)

Ollama may bind to `127.0.0.1` by default, which can cause connectivity issues in some environments. Set it explicitly:

```bash
export OLLAMA_HOST="0.0.0.0"
```

## Starting Ollama

### Temporary (current session)

```bash
export OLLAMA_ORIGINS="*"
export OLLAMA_HOST="0.0.0.0"
ollama serve
```

### Persistent — Linux (systemd)

```bash
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

### Persistent — macOS (launchd)

Edit `~/Library/LaunchAgents/com.ollama.plist` or create one with the environment variables, then:

```bash
launchctl unload ~/Library/LaunchAgents/com.ollama.plist
launchctl load ~/Library/LaunchAgents/com.ollama.plist
```

### Persistent — Windows (PowerShell)

```powershell
$env:OLLAMA_ORIGINS="*"
$env:OLLAMA_HOST="0.0.0.0"
ollama serve
```

To make it permanent, add these as system environment variables via System Properties → Environment Variables.

## Verifying the Server

```bash
# Check Ollama is running
curl http://localhost:11434/

# Should return: "Ollama is running"

# List available models
curl http://localhost:11434/api/tags

# Test CORS (should return 200)
curl -H "Origin: http://localhost:5173" -o /dev/null -w "%{http_code}" http://localhost:11434/
```

## Connecting to AIRI

1. Open AIRI → **Settings** → **Providers** → **Ollama**
2. Set **Base URL**: `http://localhost:11434/v1/`
3. Click **Validate** to confirm connectivity
4. Go to **Settings** → **Modules** → **Consciousness**
5. Select your Ollama model from the dropdown

The Ollama provider auto-discovers all pulled models — no manual model configuration needed.

## Troubleshooting

### "Failed to reach Ollama server" / "Failed to fetch"

**Cause**: CORS not configured or Ollama not running.

**Fix**:
```bash
export OLLAMA_ORIGINS="*"
export OLLAMA_HOST="0.0.0.0"
ollama serve
```

### "Model list check failed: Failed to fetch"

**Cause**: Same as above — the connectivity check and model list check both fail when CORS blocks the request.

**Fix**: Set `OLLAMA_ORIGINS` and restart Ollama.

### "Extra configuration needed for Ollama" (OLLAMA_HOST)

**Cause**: Ollama is running but the validation check can't reach it.

**Fix**: Set `OLLAMA_HOST="0.0.0.0"` and restart Ollama.

### Ollama works in browser but not in AIRI

**Cause**: The Ollama web UI uses a different port/proxy. AIRI connects directly to `localhost:11434`.

**Fix**: Ensure `OLLAMA_ORIGINS` is set and Ollama is bound to `0.0.0.0` (not just `127.0.0.1`).

### Models not appearing in AIRI

1. Verify models are pulled: `ollama list`
2. Go to Settings → Providers → Ollama → click **Validate**
3. If validation passes but models still don't appear, go to Settings → Modules → Consciousness and check the model dropdown

### Slow inference / stuttering output

See [Local Models on GTX 1060 3GB](./local-models-gtx1060.md) for hardware-specific optimization tips.
