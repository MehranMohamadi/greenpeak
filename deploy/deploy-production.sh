#!/usr/bin/env bash

set -Eeuo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <release-id> <frontend-archive> <backend-archive>" >&2
  exit 64
fi

release_id="$1"
frontend_archive="$2"
backend_archive="$3"

if [[ ! "$release_id" =~ ^[a-zA-Z0-9._-]+$ ]]; then
  echo "Invalid release id: $release_id" >&2
  exit 64
fi

for archive in "$frontend_archive" "$backend_archive"; do
  if [[ ! -f "$archive" ]]; then
    echo "Missing release archive: $archive" >&2
    exit 66
  fi
done

readonly legacy_root="/root/sp500-dashboard"
readonly releases_root="/root/greenpeak-releases"
readonly current_link="/root/greenpeak-current"
readonly release_root="${releases_root}/${release_id}"

if [[ -e "$release_root" ]]; then
  echo "Release already exists: $release_root" >&2
  exit 73
fi

mkdir -p "$releases_root" "$release_root"
tar -xzf "$frontend_archive" -C "$release_root"
tar -xzf "$backend_archive" -C "$release_root"

test -f "$release_root/front2/package.json"
test -d "$release_root/front2/.next"
test -f "$release_root/backend2/main.py"
test -f "$release_root/backend2/requirements.txt"

# Market source files are production data and are deliberately not shipped in
# release archives. Keep using the existing server-owned dataset.
if [[ -d "$legacy_root/backend2/src/data/raw" ]]; then
  mkdir -p "$release_root/backend2/src/data"
  rm -rf "$release_root/backend2/src/data/raw"
  ln -s "$legacy_root/backend2/src/data/raw" "$release_root/backend2/src/data/raw"
fi

# Preserve an environment file if production has one. Its contents never enter
# GitHub Actions or the release archive.
if [[ -f "$legacy_root/.env" ]]; then
  ln -s "$legacy_root/.env" "$release_root/.env"
fi

echo "Installing frontend runtime dependencies"
npm ci --omit=dev --prefix "$release_root/front2"

echo "Creating isolated backend environment"
python3 -m venv "$release_root/backend2/.venv"
"$release_root/backend2/.venv/bin/python" -m pip install --upgrade pip
"$release_root/backend2/.venv/bin/python" -m pip install -r "$release_root/backend2/requirements.txt"
"$release_root/backend2/.venv/bin/python" -m compileall -q "$release_root/backend2/src"

previous_target=""
if [[ -L "$current_link" ]]; then
  previous_target="$(readlink -f "$current_link")"
elif [[ -d "$legacy_root" ]]; then
  previous_target="$legacy_root"
fi

switched=0

start_apps() {
  local app_root="$1"
  local backend_interpreter="python3"

  if [[ -x "$app_root/backend2/.venv/bin/python" ]]; then
    backend_interpreter="$app_root/backend2/.venv/bin/python"
  fi

  pm2 delete sp500-frontend >/dev/null 2>&1 || true
  pm2 delete sp500-backend >/dev/null 2>&1 || true

  pm2 start npm \
    --name sp500-frontend \
    --cwd "$app_root/front2" \
    -- start

  pm2 start "$app_root/backend2/main.py" \
    --name sp500-backend \
    --cwd "$app_root/backend2" \
    --interpreter "$backend_interpreter"
}

rollback() {
  local exit_code=$?

  if [[ $exit_code -ne 0 && $switched -eq 1 && -n "$previous_target" ]]; then
    echo "Deployment failed; restoring $previous_target" >&2
    ln -sfn "$previous_target" "${current_link}.rollback"
    mv -Tf "${current_link}.rollback" "$current_link"
    start_apps "$previous_target" || true
    pm2 save --force >/dev/null 2>&1 || true
  fi

  exit "$exit_code"
}

trap rollback EXIT

ln -sfn "$release_root" "${current_link}.next"
mv -Tf "${current_link}.next" "$current_link"
switched=1

start_apps "$current_link"

echo "Waiting for application health checks"
backend_healthy=0
frontend_healthy=0
for _ in {1..30}; do
  if curl -fsS --max-time 5 http://127.0.0.1:8000/health >/dev/null; then
    backend_healthy=1
  fi
  if curl -fsS --max-time 5 http://127.0.0.1:3000/ >/dev/null; then
    frontend_healthy=1
  fi
  if [[ $backend_healthy -eq 1 && $frontend_healthy -eq 1 ]]; then
    break
  fi
  sleep 2
done

if [[ $backend_healthy -ne 1 || $frontend_healthy -ne 1 ]]; then
  echo "Application health checks failed" >&2
  pm2 logs --lines 80 --nostream >&2 || true
  exit 1
fi

pm2 save --force
switched=0
trap - EXIT

echo "Release $release_id deployed successfully"
