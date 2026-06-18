#!/usr/bin/env bash
# Build estático (output:'export') p/ empacotar no Capacitor.
# Move temporariamente o que NÃO é exportável (API, middleware, route handler
# que lê Request), roda o build com BUILD_TARGET=native e RESTAURA tudo no fim
# (trap EXIT — mesmo se falhar). O build web (sem a env) fica intocado.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STASH=".native-build-stash"
rm -rf "$STASH"
mkdir -p "$STASH"

# Itens não-exportáveis a relocar. (cartoes/[id] não existe mais — virou a rota
# estática /cartoes/detalhe?id=, compatível com export.)
ITEMS=(
  "app/api"
  "proxy.ts"
  "app/auth/callback"
)

MOVED=()
restore() {
  for p in "${MOVED[@]:-}"; do
    if [ -e "$STASH/$p" ]; then
      mkdir -p "$(dirname "$p")"
      rm -rf "$p"
      mv "$STASH/$p" "$p"
    fi
  done
  rm -rf "$STASH"
}
trap restore EXIT

for item in "${ITEMS[@]}"; do
  if [ -e "$item" ]; then
    mkdir -p "$STASH/$(dirname "$item")"
    mv "$item" "$STASH/$item"
    MOVED+=("$item")
    echo "  relocado: $item"
  fi
done

echo "→ next build (BUILD_TARGET=native, output:export)…"
BUILD_TARGET=native npx next build --webpack
echo "→ build nativo OK — saída em ./out"
