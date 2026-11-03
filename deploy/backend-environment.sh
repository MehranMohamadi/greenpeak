#!/usr/bin/env bash

# Sourced by deploy-production.sh; importing this file does not deploy anything.
prepare_backend_environment() {
  local previous_target="$1"
  # The deployment caller declares release_root readonly; do not shadow it.
  local target_release_root="$2"
  local previous_venv=""
  local destination="$target_release_root/backend2/.venv"

  if [[ -e "$destination" || -L "$destination" ]]; then
    echo "New release backend environment already exists" >&2
    return 73
  fi

  if [[ -n "$previous_target" ]]; then
    previous_venv="$(readlink -e -- "$previous_target/backend2/.venv" 2>/dev/null || true)"
  fi

  if [[ -n "$previous_venv" && -d "$previous_venv" \
    && -f "$previous_target/backend2/requirements.txt" ]] \
    && cmp -s "$previous_target/backend2/requirements.txt" "$target_release_root/backend2/requirements.txt" \
    && "$previous_venv/bin/python" -c 'import sys' >/dev/null 2>&1; then
    echo "Reusing the resolved backend environment"
    # Pin the physical directory, never another release's .venv symlink. This
    # keeps the link depth constant across deployments and active-link switches.
    ln -s -- "$previous_venv" "$destination"
  else
    echo "Creating isolated backend environment"
    python3 -m venv "$destination"
    "$destination/bin/python" -m pip install --upgrade pip
    "$destination/bin/python" -m pip install -r "$target_release_root/backend2/requirements.txt"
  fi
  "$destination/bin/python" -m compileall -q "$target_release_root/backend2/src"
}
