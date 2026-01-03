#!/usr/bin/env bash
set -euo pipefail

REPO_OWNER="bdumasfortin"
REPO_NAME="pirate-survival-html"
ASSET_NAME="server.zip"
SERVICE_NAME="${PIRATE_SERVICE:-pirate-server}"

if [[ -n "${SERVER_DIR:-}" ]]; then
  INSTALL_DIR="$SERVER_DIR"
elif [[ -d "/opt/sailorquest-server" ]]; then
  INSTALL_DIR="/opt/sailorquest-server"
elif [[ -d "$HOME/sailorquest-server" ]]; then
  INSTALL_DIR="$HOME/sailorquest-server"
else
  INSTALL_DIR="/opt/sailorquest-server"
fi

URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/${ASSET_NAME}"
TMP_FILE="$(mktemp)"
TMP_DIR="$(mktemp -d)"

SUDO=""
if [[ $EUID -ne 0 ]] && command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
fi

cleanup() {
  rm -f "${TMP_FILE}"
  rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

if ! command -v unzip >/dev/null 2>&1; then
  echo "unzip is required. Install with: sudo apt-get install unzip"
  exit 1
fi

echo "Downloading ${URL}"
curl -fL "${URL}" -o "${TMP_FILE}"

echo "Extracting bundle"
${SUDO} install -d "${INSTALL_DIR}"
${SUDO} unzip -o "${TMP_FILE}" -d "${TMP_DIR}"

for filename in server.js README.md package.json; do
  if [[ ! -f "${TMP_DIR}/${filename}" ]]; then
    echo "Missing ${filename} in ${ASSET_NAME}"
    exit 1
  fi
done

${SUDO} install -m 755 "${TMP_DIR}/server.js" "${INSTALL_DIR}/server.js"
${SUDO} install -m 644 "${TMP_DIR}/README.md" "${INSTALL_DIR}/README.md"
${SUDO} install -m 644 "${TMP_DIR}/package.json" "${INSTALL_DIR}/package.json"

if command -v systemctl >/dev/null 2>&1; then
  echo "Restarting ${SERVICE_NAME}.service"
  ${SUDO} systemctl restart "${SERVICE_NAME}"
  ${SUDO} systemctl status "${SERVICE_NAME}" --no-pager
else
  echo "systemctl not found. Restart your server process manually."
fi
