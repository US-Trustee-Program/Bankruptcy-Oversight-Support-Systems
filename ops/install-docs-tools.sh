#!/usr/bin/env bash

# Installs local tooling needed to regenerate docs/ diagrams on macOS.
# Tools covered:
# - Structurizr CLI (provides `structurizr.sh` used by architecture/export-architecture-diagrams.sh)
#   Installation strategy:
#     1) Try Homebrew (if available)
#     2) FALLBACK: Download latest release and install under XDG Base Dirs
#        - Binaries placed in $XDG_BIN_HOME (defaults to ~/.local/bin)
#        - Payload stored in  $XDG_DATA_HOME/structurizr-cli (defaults to ~/.local/share/structurizr-cli)
#        - Adds ~/.local/bin to PATH if needed
# - Python 3 + PyYAML (needed by ops/scripts/pipeline/workflow-diagram-generator.py)
#   Prefer a project-local virtual environment managed by `uv` under dev-tools/.venv-docs
#
# Usage (from repo root):
#   sh ./ops/install-docs-tools.sh

set -euo pipefail

echo "[docs-tools] Starting tooling installation checks"

OS_NAME="$(uname -s 2>/dev/null || echo unknown)"
if [ "$OS_NAME" != "Darwin" ]; then
  echo "[docs-tools] This helper currently supports macOS only (detected: $OS_NAME)."
  echo "[docs-tools] Please install the prerequisites manually:"
  echo "  - Structurizr CLI: https://docs.structurizr.com/cli/installation#local-installation"
  echo "  - Python 3 + PyYAML: python3 -m pip install --user pyyaml"
  exit 1
fi

HAVE_BREW=true
if ! command -v brew >/dev/null 2>&1; then
  HAVE_BREW=false
  echo "[docs-tools] Homebrew not found. Will attempt Structurizr CLI fallback install using XDG directories."
  echo "[docs-tools] If you prefer Homebrew, install it and re-run:"
  echo "  /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
fi

ensure_structurizr_via_brew() {
  # Not all environments have the same formula name; try common ones.
  echo "[docs-tools] Attempting Structurizr CLI install via Homebrew..."
  set +e
  brew install structurizr-cli >/dev/null 2>&1
  local struct_exit=$?
  if [ $struct_exit -ne 0 ]; then
    echo "[docs-tools] 'brew install structurizr-cli' failed or formula not found. Trying 'structurizr'..."
    brew install structurizr >/dev/null 2>&1
  fi
  set -e
}

install_structurizr_xdg_fallback() {
  echo "[docs-tools] Installing Structurizr CLI using XDG Base Directories fallback..."

  # Resolve XDG dirs
  local XDG_DATA_HOME_DIR=${XDG_DATA_HOME:-"$HOME/.local/share"}
  local XDG_BIN_HOME_DIR=${XDG_BIN_HOME:-"$HOME/.local/bin"}
  local TARGET_DIR="$XDG_DATA_HOME_DIR/structurizr-cli"
  local BIN_LINK="$XDG_BIN_HOME_DIR/structurizr.sh"

  # Requirements
  if ! command -v curl >/dev/null 2>&1; then
    echo "[docs-tools] 'curl' is required to download Structurizr CLI."
    if [ "$HAVE_BREW" = true ]; then
      echo "[docs-tools] Installing curl via Homebrew..."
      brew install curl
    else
      echo "[docs-tools] Please install curl and re-run."
      return 1
    fi
  fi
  if ! command -v unzip >/dev/null 2>&1; then
    echo "[docs-tools] 'unzip' is required to extract Structurizr CLI."
    if [ "$HAVE_BREW" = true ]; then
      echo "[docs-tools] Installing unzip via Homebrew (zip)..."
      brew install unzip || brew install zip
    else
      echo "[docs-tools] Please install unzip and re-run."
      return 1
    fi
  fi

  mkdir -p "$XDG_DATA_HOME_DIR" "$XDG_BIN_HOME_DIR"

  local TMP_DIR
  TMP_DIR=$(mktemp -d)
  trap 'rm -rf "$TMP_DIR"' EXIT

  local ZIP_URL="https://github.com/structurizr/cli/releases/latest/download/structurizr-cli.zip"
  local ZIP_PATH="$TMP_DIR/structurizr-cli.zip"
  echo "[docs-tools] Downloading latest Structurizr CLI from $ZIP_URL ..."
  curl -fL -o "$ZIP_PATH" "$ZIP_URL"

  echo "[docs-tools] Extracting CLI..."
  rm -rf "$TARGET_DIR"
  mkdir -p "$TARGET_DIR"
  unzip -q "$ZIP_PATH" -d "$TARGET_DIR"

  # Ensure executable bit and create/update symlink in XDG bin
  if [ -f "$TARGET_DIR/structurizr.sh" ]; then
    chmod +x "$TARGET_DIR/structurizr.sh"
  fi
  ln -sf "$TARGET_DIR/structurizr.sh" "$BIN_LINK"

  # Ensure XDG bin is on PATH for future shells; print guidance for current shell
  case ":$PATH:" in
    *":$XDG_BIN_HOME_DIR:"*) ;;
    *)
      echo "[docs-tools] Adding $XDG_BIN_HOME_DIR to your PATH for future shells..."
      local SHELL_RC
      if [ -n "${ZSH_VERSION-}" ] || [ "${SHELL:-}" = "/bin/zsh" ] || [[ "${SHELL:-}" == *"zsh"* ]]; then
        SHELL_RC="$HOME/.zshrc"
      elif [ -n "${BASH_VERSION-}" ] || [ "${SHELL:-}" = "/bin/bash" ] || [[ "${SHELL:-}" == *"bash"* ]]; then
        SHELL_RC="$HOME/.bashrc"
      else
        SHELL_RC="$HOME/.profile"
      fi
      mkdir -p "$(dirname "$SHELL_RC")"
      if ! grep -qs "\.local/bin" "$SHELL_RC" 2>/dev/null; then
        echo "export PATH=\"$XDG_BIN_HOME_DIR:\$PATH\"" >> "$SHELL_RC"
        echo "[docs-tools] Appended PATH update to $SHELL_RC"
      fi
      echo "[docs-tools] For current shell, run: export PATH=\"$XDG_BIN_HOME_DIR:\$PATH\""
      ;;
  esac

  if command -v structurizr.sh >/dev/null 2>&1; then
    echo "[docs-tools] Structurizr CLI installed via XDG fallback. Version: $(structurizr.sh -v 2>&1 | head -n1)"
    return 0
  else
    echo "[docs-tools] Structurizr CLI installation via XDG fallback completed, but command not found on current PATH."
    echo "[docs-tools] Try: export PATH=\"$XDG_BIN_HOME_DIR:\$PATH\" and run 'structurizr.sh -v'"
    return 1
  fi
}

# Install Structurizr CLI if missing
if ! command -v structurizr.sh >/dev/null 2>&1; then
  if [ "$HAVE_BREW" = true ]; then
    ensure_structurizr_via_brew || true
  fi
  if ! command -v structurizr.sh >/dev/null 2>&1; then
    # Brew not available or brew install failed — use fallback
    install_structurizr_xdg_fallback || {
      echo "[docs-tools] Failed to install Structurizr CLI automatically."
      echo "[docs-tools] You can install manually and ensure structurizr.sh is on your PATH:"
      echo "  1) Download: https://github.com/structurizr/cli/releases"
      echo "  2) Unzip and add the directory containing structurizr.sh to your PATH"
      echo "  3) Verify with: structurizr.sh -v"
      exit 1
    }
  fi
  echo "[docs-tools] Structurizr CLI installed. Version: $(structurizr.sh -v 2>&1 | head -n1)"
else
  echo "[docs-tools] Structurizr CLI already present: $(command -v structurizr.sh)"
fi

# Ensure Python 3 exists
if ! command -v python3 >/dev/null 2>&1; then
  if [ "$HAVE_BREW" = true ]; then
    echo "[docs-tools] Python 3 not found. Installing via Homebrew..."
    brew install python
  else
    echo "[docs-tools] Python 3 not found and Homebrew is unavailable."
    echo "[docs-tools] Please install Python 3 from https://www.python.org/downloads/ and re-run."
    exit 1
  fi
fi

# Ensure pip is available
if ! python3 -m pip --version >/dev/null 2>&1; then
  echo "[docs-tools] pip for Python 3 not available. Bootstrapping via ensurepip..."
  python3 -m ensurepip --upgrade >/dev/null 2>&1 || true
fi

# ---------------------------
# Project-local Python venv via `uv`
# ---------------------------
VENV_DIR="dev-tools/.venv-docs"
# We'll determine the interpreter after (may be python3 or python depending on platform)
VENV_PY=""

echo "[docs-tools] Ensuring a project-local virtual environment exists at $VENV_DIR (managed by uv if available)"

# Try to ensure uv exists
ensure_uv() {
  if command -v uv >/dev/null 2>&1; then
    return 0
  fi
  if [ "$HAVE_BREW" = true ]; then
    echo "[docs-tools] Installing 'uv' via Homebrew..."
    set +e
    brew install uv >/dev/null 2>&1
    local uv_exit=$?
    set -e
    if [ $uv_exit -eq 0 ] && command -v uv >/dev/null 2>&1; then
      return 0
    fi
  fi
  # Official installer (XDG ~/.local/bin)
  echo "[docs-tools] Installing 'uv' using official installer..."
  curl -fsSL https://astral.sh/uv/install.sh | sh
  # Try to pick up ~/.local/bin for current shell session
  if [ -d "$HOME/.local/bin" ]; then
    case ":$PATH:" in
      *":$HOME/.local/bin:"*) ;;
      *) export PATH="$HOME/.local/bin:$PATH" ;;
    esac
  fi
  if ! command -v uv >/dev/null 2>&1; then
    echo "[docs-tools] 'uv' installation completed but not found on PATH. Ensure ~/.local/bin is in PATH and re-run."
    return 1
  fi
}

if ! [ -d "$VENV_DIR" ]; then
  if ensure_uv; then
    echo "[docs-tools] Creating venv with uv at $VENV_DIR ..."
    uv venv "$VENV_DIR"
  else
    echo "[docs-tools] 'uv' unavailable; creating venv with python3 -m venv at $VENV_DIR ..."
    python3 -m venv "$VENV_DIR"
  fi
else
  echo "[docs-tools] Found existing venv: $VENV_DIR"
fi

# Ensure both python and python3 shims exist in the venv for portability
if [ -x "$VENV_DIR/bin/python" ] && [ ! -x "$VENV_DIR/bin/python3" ]; then
  echo "[docs-tools] Creating python3 shim in venv (symlink to python)"
  ln -s "python" "$VENV_DIR/bin/python3" || true
fi
if [ -x "$VENV_DIR/bin/python3" ] && [ ! -x "$VENV_DIR/bin/python" ]; then
  echo "[docs-tools] Creating python shim in venv (symlink to python3)"
  ln -s "python3" "$VENV_DIR/bin/python" || true
fi

# Pick interpreter (prefer python3)
if [ -x "$VENV_DIR/bin/python3" ]; then
  VENV_PY="$VENV_DIR/bin/python3"
elif [ -x "$VENV_DIR/bin/python" ]; then
  VENV_PY="$VENV_DIR/bin/python"
fi

# Upgrade/ensure pip and ensure PyYAML inside the venv
if [ -n "$VENV_PY" ] && [ -x "$VENV_PY" ]; then
  # Make sure pip exists inside the venv
  if ! "$VENV_PY" -m pip --version >/dev/null 2>&1; then
    echo "[docs-tools] Bootstrapping pip in the venv via ensurepip..."
    "$VENV_PY" -m ensurepip --upgrade >/dev/null 2>&1 || true
  fi

  # Try upgrading pip/setuptools if pip is now available
  if "$VENV_PY" -m pip --version >/dev/null 2>&1; then
    echo "[docs-tools] Upgrading pip/setuptools in the venv..."
    "$VENV_PY" -m pip install --upgrade pip setuptools >/dev/null 2>&1 || true
  fi

  echo "[docs-tools] Installing PyYAML in the venv..."
  if command -v uv >/dev/null 2>&1; then
    # Prefer uv to install into this venv's interpreter (does not require pip)
    uv pip install --python "$VENV_PY" pyyaml >/dev/null
  else
    # Fallback to pip within the venv
    if ! "$VENV_PY" -m pip install pyyaml >/dev/null 2>&1; then
      echo "[docs-tools] Failed to install PyYAML using pip in venv. Consider installing 'uv' and re-running."
      exit 1
    fi
  fi

  echo "[docs-tools] Verifying PyYAML import from venv..."
  "$VENV_PY" - << 'PY'
try:
    import yaml  # type: ignore
    print('OK')
except Exception as e:
    raise SystemExit(f"Failed: {e}")
PY
else
  echo "[docs-tools] ERROR: Venv python not found under $VENV_DIR/bin (python or python3)"
  exit 1
fi

echo "[docs-tools] All prerequisite tools appear to be installed."
echo "[docs-tools] Virtual env ready at $VENV_DIR (python: ${VENV_PY:-unknown})."
echo "[docs-tools] Next step: npm run docs:regen"

exit 0
