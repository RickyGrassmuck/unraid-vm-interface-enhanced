#!/bin/bash
# build.sh — package and optionally scp the plugin to an Unraid server
#
# Usage:
#   ./build.sh                    # build the .txz only
#   ./build.sh root@tower         # build and scp to Unraid host
#   ./build.sh --install root@tower  # build, scp, and install via ssh
#
# Requirements: makepkg (Slackware tool, available on Unraid itself)
# If running on Linux without makepkg, the script falls back to tar+xz.

set -euo pipefail

PLUGIN="vm-interface-enhanced"
VERSION="2026.03.23"
PKG="${PLUGIN}-${VERSION}.txz"
SOURCE_DIR="source"

echo "==> Building ${PKG}"

# ── Build the .txz package ─────────────────────────────────────────
if command -v makepkg &>/dev/null; then
  # Proper Slackware package — preserves ownership / permissions
  (cd "$SOURCE_DIR" && makepkg -l y -c n "../${PKG}")
else
  # Fallback: plain tar archive (Unraid can still install these)
  echo "    makepkg not found; using tar fallback"
  tar -C "$SOURCE_DIR" -cJf "${PKG}" .
fi

echo "==> Built: ${PKG}"

# ── Compute SHA256 and update the .plg file ────────────────────────
SHA=$(sha256sum "${PKG}" | awk '{print $1}')
echo "==> SHA256: ${SHA}"
sed -i "s|<!ENTITY sha256.*|<!ENTITY sha256      \"${SHA}\">|" "${PLUGIN}.plg"
echo "==> Updated sha256 in ${PLUGIN}.plg"

# ── Optional: push to Unraid ───────────────────────────────────────
INSTALL=false
UNRAID_HOST=""

for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=true ;;
    *)         UNRAID_HOST="$arg" ;;
  esac
done

if [[ -n "$UNRAID_HOST" ]]; then
  REMOTE_DIR="/boot/config/plugins/${PLUGIN}"
  echo "==> Copying files to ${UNRAID_HOST}:${REMOTE_DIR}"
  ssh "$UNRAID_HOST" "mkdir -p ${REMOTE_DIR}"
  scp "${PKG}" "${PLUGIN}.plg" "${UNRAID_HOST}:${REMOTE_DIR}/"

  if [[ "$INSTALL" == true ]]; then
    echo "==> Installing on ${UNRAID_HOST}"
    ssh "$UNRAID_HOST" "installpkg ${REMOTE_DIR}/${PKG} 2>&1"
    echo "==> Done. Reload the VMs page in your browser."
  fi
fi

echo "==> All done."
