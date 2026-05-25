#!/usr/bin/env bash
# =============================================================================
# AIRI Local Model Setup Script for NVIDIA GTX 1060 3GB
# =============================================================================
# Sets up Ollama with models optimized for 3GB VRAM (Pascal).
#
# Usage:
#   ./scripts/setup-local-models.sh                    # Interactive mode
#   ./scripts/setup-local-models.sh --auto             # Non-interactive, recommended models
#   ./scripts/setup-local-models.sh --models "model1,model2"  # Specific models
#   ./scripts/setup-local-models.sh --check            # Check Ollama status only
#   ./scripts/setup-local-models.sh --uncensored       # Include uncensored models (≤3B)
#   ./scripts/setup-local-models.sh --large            # Include large models (7B/13B) — needs 8GB+ VRAM
# =============================================================================

set -euo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# --- Model Definitions ---
# Format: "ollama_tag|description|vram_2k|speed|use_case"

RECOMMENDED_MODELS=(
  "gemma2:2b-instruct-q4_K_M|Gemma 2 2B (Q4_K_M) - Best quality chat|~2.1 GB|25-35 t/s|Creative/Chat"
  "qwen2.5:1.5b-instruct-q4_K_M|Qwen 2.5 1.5B (Q4_K_M) - Coding + 8k context|~1.3 GB|50-70 t/s|Code/General"
  "llama3.2:3b-instruct-q3_K_M|Llama 3.2 3B (Q3_K_M) - Best reasoning|~1.9 GB|20-30 t/s|All-rounder"
)

FAST_MODELS=(
  "llama3.2:1b-instruct-q4_K_M|Llama 3.2 1B (Q4_K_M) - Fastest, 16k+ context|~1.1 GB|60-90 t/s|Speed/Context"
  "smollm2:1.7b-instruct-q4_K_M|SmolLM2 1.7B (Q4_K_M) - Instruction following|~1.4 GB|45-60 t/s|Instructions"
)

# Verified uncensored models (≤3B only)
UNCENSORED_MODELS=(
  "tinydolphin:1.1b|TinyDolphin 1.1B - Uncensored, Dolphin dataset|~0.7 GB|50-80 t/s|Uncensored/Chat"
  "dolphin-phi:2.7b|Dolphin Phi 2.7B - Uncensored, based on Microsoft Phi|~1.6 GB|30-50 t/s|Uncensored/Chat"
)

# Large models (7B/13B) — require 8GB+ VRAM. Will stutter on GTX 1060 3GB.
LARGE_MODELS=(
  "llama2-uncensored:7b-chat-q2_K|Llama 2 Uncensored 7B (Q2_K) - Minimum VRAM uncensored|~2.8 GB|5-15 t/s|Uncensored/Large"
  "llama2-uncensored:7b-chat-q3_K_M|Llama 2 Uncensored 7B (Q3_K_M) - Better quality|~3.3 GB|5-15 t/s|Uncensored/Large"
  "wizard-vicuna-uncensored:7b|Wizard Vicuna Uncensored 7B - Good uncensored chat|~3.8 GB|5-15 t/s|Uncensored/Chat"
  "wizardlm-uncensored:13b|WizardLM Uncensored 13B - Best uncensored quality|~7.4 GB|2-8 t/s|Uncensored/Premium"
)

# --- Helpers ---

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_header(){ echo -e "\n${BOLD}${CYAN}$1${NC}\n"; }

separator() { echo -e "${CYAN}$(printf '─%.0s' {1..60})${NC}"; }

# --- Functions ---

check_ollama_installed() {
  if command -v ollama &>/dev/null; then
    log_ok "Ollama installed: $(ollama --version 2>/dev/null | head -1)"
    return 0
  else
    log_error "Ollama not found"
    echo ""
    echo "Install Ollama:"
    echo "  curl -fsSL https://ollama.com/install.sh | sh"
    return 1
  fi
}

check_ollama_running() {
  if curl -s --max-time 3 http://localhost:11434/ &>/dev/null; then
    log_ok "Ollama server is running on localhost:11434"
    return 0
  else
    log_warn "Ollama server not responding on localhost:11434"
    echo ""
    echo "Start Ollama:"
    echo "  ollama serve &"
    echo ""
    echo "If using systemd:"
    echo "  sudo systemctl start ollama"
    return 1
  fi
}

check_cors() {
  local cors_header
  cors_header=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Origin: http://localhost:5173" \
    --max-time 3 \
    http://localhost:11434/ 2>/dev/null || echo "000")

  if [[ "$cors_header" == "200" ]]; then
    log_ok "CORS appears configured (got 200 with Origin header)"
    return 0
  else
    log_warn "CORS may not be configured (got HTTP $cors_header with Origin header)"
    echo ""
    echo "To fix, set both OLLAMA_ORIGINS and OLLAMA_HOST before starting Ollama:"
    echo "  export OLLAMA_ORIGINS=\"*\""
    echo "  export OLLAMA_HOST=\"0.0.0.0\""
    echo "  ollama serve"
    echo ""
    echo "Or for systemd:"
    echo "  sudo systemctl edit ollama"
    echo "  # Add: [Service]"
    echo "  #       Environment=\"OLLAMA_ORIGINS=*\""
    echo "  #       Environment=\"OLLAMA_HOST=0.0.0.0\""
    echo "  sudo systemctl restart ollama"
    return 1
  fi
}

list_installed_models() {
  log_header "Installed Models"
  local models
  models=$(ollama list 2>/dev/null || echo "")

  if [[ -z "$models" ]]; then
    log_warn "No models installed yet"
  else
    echo "$models"
  fi
}

# Check if a model is already installed (exact name match)
model_is_installed() {
  local model="$1"
  ollama list 2>/dev/null | awk '{print $1}' | grep -qFx "$model"
}

pull_model() {
  local model="$1"
  local description="$2"

  if model_is_installed "$model"; then
    log_ok "Already installed: $model"
    return 0
  fi

  log_info "Pulling $model ($description)..."
  echo -e "${CYAN}This may take several minutes depending on your connection...${NC}"

  if ollama pull "$model" 2>&1; then
    log_ok "Successfully pulled: $model"
    return 0
  else
    log_error "Failed to pull: $model"
    return 1
  fi
}

print_model_table() {
  local -n models=$1
  local title="$2"

  log_header "$title"
  printf "  ${BOLD}%-4s %-45s %-12s %-12s %s${NC}\n" "#" "Model" "VRAM (2k)" "Speed" "Use Case"
  separator

  local i=1
  for entry in "${models[@]}"; do
    IFS='|' read -r model desc vram speed usecase <<< "$entry"
    printf "  ${CYAN}%-4s${NC} %-45s %-12s %-12s %s\n" "$i." "$model" "$vram" "$speed" "$usecase"
    ((i++))
  done
  echo ""
}

interactive_menu() {
  local choices=()
  local include_uncensored=false
  local include_large=false

  log_header "GTX 1060 3GB - Model Selection"
  echo -e "Select models to install. Your ${BOLD}3GB VRAM${NC} limits you to ~2.4-2.7 GB usable."
  echo -e "All listed models are ≤3B parameters. Models above ~2.2 GB may stutter."
  echo ""

  print_model_table RECOMMENDED_MODELS "Recommended Models"
  print_model_table FAST_MODELS "Fast / Large Context Models"

  echo -e "${BOLD}Quick options:${NC}"
  echo "  a) All recommended models"
  echo "  b) Pick individual models"
  echo "  c) Just check status (don't pull anything)"
  echo ""
  read -rp "Choose [a/b/c]: " choice

  case "$choice" in
    a|A)
      for entry in "${RECOMMENDED_MODELS[@]}"; do
        IFS='|' read -r model desc _ _ _ <<< "$entry"
        choices+=("$model")
      done
      ;;
    b|B)
      echo ""
      echo "Enter model numbers separated by spaces (e.g., '1 3 5'):"
      echo ""
      local i=1
      local idx_map=()
      for entry in "${RECOMMENDED_MODELS[@]}" "${FAST_MODELS[@]}"; do
        IFS='|' read -r model desc vram speed usecase <<< "$entry"
        printf "  ${CYAN}%2s${NC} %-45s %s\n" "$i" "$model" "$desc"
        idx_map+=("$model")
        ((i++))
      done
      echo ""
      read -rp "Models to install: " -a selections

      for sel in "${selections[@]}"; do
        local idx=$((sel - 1))
        if [[ $idx -ge 0 && $idx -lt ${#idx_map[@]} ]]; then
          choices+=("${idx_map[$idx]}")
        else
          log_warn "Invalid selection: $sel"
        fi
      done
      ;;
    c|C)
      list_installed_models
      return 0
      ;;
    *)
      log_error "Invalid choice"
      return 1
      ;;
  esac

  # Ask about uncensored models
  echo ""
  read -rp "Include uncensored models (≤3B)? [y/N]: " uncensored_choice
  if [[ "$uncensored_choice" =~ ^[Yy]$ ]]; then
    include_uncensored=true
  fi

  # Ask about large models
  echo ""
  echo -e "${YELLOW}Large models (7B/13B) require 8GB+ VRAM and will stutter on GTX 1060 3GB.${NC}"
  read -rp "Include large models anyway? [y/N]: " large_choice
  if [[ "$large_choice" =~ ^[Yy]$ ]]; then
    include_large=true
  fi

  # Add uncensored models if requested
  if $include_uncensored; then
    print_model_table UNCENSORED_MODELS "Uncensored Models (≤3B)"
    for entry in "${UNCENSORED_MODELS[@]}"; do
      IFS='|' read -r model desc _ _ _ <<< "$entry"
      choices+=("$model")
    done
  fi

  # Add large models if requested
  if $include_large; then
    print_model_table LARGE_MODELS "Large Models (7B/13B) — 8GB+ VRAM recommended"
    echo "Select large model numbers separated by spaces, or 'all':"
    read -rp "Large models to install: " -a large_selections

    local all_large=false
    for sel in "${large_selections[@]}"; do
      if [[ "$sel" == "all" ]]; then
        all_large=true
        break
      fi
    done

    if $all_large; then
      for entry in "${LARGE_MODELS[@]}"; do
        IFS='|' read -r model desc _ _ _ <<< "$entry"
        choices+=("$model")
      done
    else
      for sel in "${large_selections[@]}"; do
        local idx=$((sel - 1))
        if [[ $idx -ge 0 && $idx -lt ${#LARGE_MODELS[@]} ]]; then
          IFS='|' read -r model desc _ _ _ <<< "${LARGE_MODELS[$idx]}"
          choices+=("$model")
        else
          log_warn "Invalid selection: $sel"
        fi
      done
    fi
  fi

  if [[ ${#choices[@]} -eq 0 ]]; then
    log_warn "No models selected"
    return 0
  fi

  echo ""
  log_info "Will pull ${#choices[@]} model(s): ${choices[*]}"
  read -rp "Proceed? [Y/n]: " confirm
  if [[ "$confirm" =~ ^[Nn]$ ]]; then
    log_info "Aborted"
    return 0
  fi

  echo ""
  local success=0
  local failed=0
  for model in "${choices[@]}"; do
    if pull_model "$model" "User selection"; then
      ((success++))
    else
      ((failed++))
    fi
    echo ""
  done

  separator
  log_header "Summary"
  log_ok "$success model(s) pulled successfully"
  if [[ $failed -gt 0 ]]; then
    log_error "$failed model(s) failed"
  fi

  echo ""
  list_installed_models

  echo ""
  log_header "Next Steps"
  echo "1. Open AIRI"
  echo "2. Go to Settings → Providers → Ollama"
  echo "3. Base URL: http://localhost:11434/v1/"
  echo "4. Click 'Validate'"
  echo "5. Go to Settings → Modules → Consciousness"
  echo "6. Select your model from the dropdown"
}

# --- Main ---

main() {
  local mode="interactive"
  local custom_models=""
  local include_uncensored=false
  local include_large=false

  # Parse args
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --auto)
        mode="auto"
        shift
        ;;
      --models)
        mode="custom"
        custom_models="$2"
        shift 2
        ;;
      --check)
        mode="check"
        shift
        ;;
      --uncensored)
        include_uncensored=true
        shift
        ;;
      --large)
        include_large=true
        shift
        ;;
      --help|-h)
        echo "Usage: $0 [--auto|--models \"model1,model2\"|--check|--uncensored|--large|--help]"
        echo ""
        echo "Options:"
        echo "  --auto         Non-interactive, pull recommended models"
        echo "  --models LIST  Pull specific models (comma-separated)"
        echo "  --check        Check Ollama status only"
        echo "  --uncensored   Include uncensored models (with --auto)"
        echo "  --large        Include large 7B/13B models (with --auto)"
        echo "  --help         Show this help"
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        echo "Use --help for usage"
        exit 1
        ;;
    esac
  done

  log_header "AIRI Local Model Setup (GTX 1060 3GB)"

  # Step 1: Check Ollama
  echo -e "${BOLD}Step 1: Checking Ollama installation${NC}"
  separator
  check_ollama_installed || exit 1
  echo ""

  # Step 2: Check server
  echo -e "${BOLD}Step 2: Checking Ollama server${NC}"
  separator
  check_ollama_running || {
    log_info "Attempting to start Ollama..."
    ollama serve &
    sleep 3
    check_ollama_running || exit 1
  }
  echo ""

  # Step 3: Check CORS
  echo -e "${BOLD}Step 3: Checking CORS configuration${NC}"
  separator
  check_cors || true
  echo ""

  # Step 4: Show installed models
  list_installed_models
  echo ""

  # Step 5: Pull models based on mode
  case "$mode" in
    check)
      log_info "Status check complete"
      ;;
    auto)
      log_header "Auto-pulling recommended models"
      for entry in "${RECOMMENDED_MODELS[@]}"; do
        IFS='|' read -r model desc _ _ _ <<< "$entry"
        pull_model "$model" "$desc" || true
        echo ""
      done
      if $include_uncensored; then
        log_header "Pulling uncensored models"
        for entry in "${UNCENSORED_MODELS[@]}"; do
          IFS='|' read -r model desc _ _ _ <<< "$entry"
          pull_model "$model" "$desc" || true
          echo ""
        done
      fi
      if $include_large; then
        log_header "Pulling large models"
        for entry in "${LARGE_MODELS[@]}"; do
          IFS='|' read -r model desc _ _ _ <<< "$entry"
          pull_model "$model" "$desc" || true
          echo ""
        done
      fi
      list_installed_models
      ;;
    custom)
      IFS=',' read -ra models <<< "$custom_models"
      log_header "Pulling custom models"
      for model in "${models[@]}"; do
        model=$(echo "$model" | xargs) # trim whitespace
        pull_model "$model" "Custom selection" || true
        echo ""
      done
      list_installed_models
      ;;
    interactive)
      interactive_menu
      ;;
  esac

  echo ""
  log_header "Setup Complete"
  echo -e "Models are ready. Configure AIRI at: ${CYAN}Settings → Providers → Ollama${NC}"
  echo -e "Base URL: ${CYAN}http://localhost:11434/v1/${NC}"
}

main "$@"
