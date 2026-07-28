#!/usr/bin/env bash
set -euo pipefail

find_executable() {
  local name="$1"
  local dir
  local candidate

  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return 0
  fi

  for dir in \
    "$HOME/.var/app/com.visualstudio.code/config/nvm/versions/node"/*/bin \
    "$HOME/.nvm/versions/node"/*/bin \
    "$HOME/.config/nvm/versions/node"/*/bin \
    /usr/local/bin \
    /usr/bin \
    /bin; do
    [ -d "$dir" ] || continue
    candidate="$dir/$name"
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

NODE_BIN="$(find_executable node)" || {
  echo "Node.js is not available for MCP startup." >&2
  exit 127
}

NPX_BIN="$(find_executable npx)" || {
  echo "npx is not available for MCP startup." >&2
  exit 127
}

export PATH="$(dirname "$NODE_BIN"):$PATH"
exec "$NPX_BIN" "$@"
