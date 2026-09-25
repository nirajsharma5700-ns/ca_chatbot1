#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-5173}"

cd "$PROJECT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' "npm is required to run CA Assist." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  printf '%s\n' "Dependencies are missing; installing from package-lock.json..."
  npm ci
fi

printf 'Starting CA Assist at http://127.0.0.1:%s/ca_chatbot1/\n' "$PORT"
exec npm run dev -- --host 127.0.0.1 --port "$PORT" --strictPort
