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

# Base absoluta das APIs (Vercel) embarcada no bundle nativo. O webview não tem
# /api local, então o nativo chama a API de produção. Usa o host canônico www:
# o apex (toorganizado.com.br) redireciona pra www e o redirect cross-host
# DERRUBA o header Authorization (Bearer) → tem que bater direto no www.
# Override: NEXT_PUBLIC_API_BASE=... npm run build:native (ex.: pra apontar local).
API_BASE="${NEXT_PUBLIC_API_BASE:-https://www.toorganizado.com.br}"

echo "→ next build (BUILD_TARGET=native, output:export, API_BASE=$API_BASE)…"
BUILD_TARGET=native NEXT_PUBLIC_API_BASE="$API_BASE" npx next build --webpack
echo "→ build nativo OK — saída em ./out"
