#!/usr/bin/env bash

set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/../backend-environment.sh"

test_parent="$(cd "${TMPDIR:-/tmp}" && pwd -P)"
fixture="$(mktemp -d "$test_parent/greenpeak-backend-env-test.XXXXXXXX")"
cleanup() {
  # Only delete this test's verified, absolute temporary directory.
  case "$(readlink -e -- "$fixture")" in
    "$test_parent"/greenpeak-backend-env-test.*) rm -rf -- "$fixture" ;;
    *) echo "Refusing to remove an unexpected test directory" >&2 ;;
  esac
}
trap cleanup EXIT

export GP_ENV_TEST_LOG="$fixture/python.log"
export GP_ENV_TEST_TEMPLATE="$fixture/python-template"
cat > "$GP_ENV_TEST_TEMPLATE" <<'PYTHON'
#!/usr/bin/env bash
set -eu
if [[ -f "$(dirname "$0")/../broken" ]]; then exit 126; fi
printf '%s %s\n' "$0" "$*" >> "$GP_ENV_TEST_LOG"
PYTHON
chmod +x "$GP_ENV_TEST_TEMPLATE"
mkdir -p "$fixture/commands"
cat > "$fixture/commands/python3" <<'PYTHON3'
#!/usr/bin/env bash
set -eu
[[ "$1" == "-m" && "$2" == "venv" ]]
mkdir -p "$3/bin"
cp "$GP_ENV_TEST_TEMPLATE" "$3/bin/python"
chmod +x "$3/bin/python"
PYTHON3
chmod +x "$fixture/commands/python3"
export PATH="$fixture/commands:$PATH"

make_release() {
  mkdir -p "$1/backend2/src"
  printf '%s\n' 'fixture==1' > "$1/backend2/requirements.txt"
}

original="$fixture/original"
make_release "$original"
python3 -m venv "$original/backend2/.venv"
physical_venv="$(readlink -e -- "$original/backend2/.venv")"

# Match the caller's readonly globals before exercising either preparation path.
(
  readonly release_root="$fixture/readonly-release"
  readonly_release_reuse="$fixture/readonly-release-reuse"
  make_release "$release_root"
  make_release "$readonly_release_reuse"
  prepare_backend_environment "" "$release_root" >/dev/null
  [[ -d "$release_root/backend2/.venv" && ! -L "$release_root/backend2/.venv" ]]
  prepare_backend_environment "$original" "$readonly_release_reuse" >/dev/null
  [[ -L "$readonly_release_reuse/backend2/.venv" ]]
  [[ "$(readlink -- "$readonly_release_reuse/backend2/.venv")" == "$physical_venv" ]]
  [[ "$release_root" == "$fixture/readonly-release" ]]
)
echo "PASS: readonly release_root in the deployment caller supports new and reused environments"

previous="$original"
for number in {1..50}; do
  release="$fixture/release-$number"
  make_release "$release"
  prepare_backend_environment "$previous" "$release" >/dev/null
  [[ -L "$release/backend2/.venv" ]]
  [[ "$(readlink -- "$release/backend2/.venv")" == "$physical_venv" ]]
  "$release/backend2/.venv/bin/python" -c 'import sys'
  previous="$release"
done
echo "PASS: 50 consecutive releases pin the physical environment without growing a symlink chain"

cycle="$fixture/cycle"
make_release "$cycle"
ln -s .venv "$cycle/backend2/.venv"
replacement="$fixture/cycle-replacement"
make_release "$replacement"
prepare_backend_environment "$cycle" "$replacement" >/dev/null
[[ -d "$replacement/backend2/.venv" && ! -L "$replacement/backend2/.venv" ]]
[[ -L "$cycle/backend2/.venv" ]]
echo "PASS: cyclic environments create an isolated replacement without modifying the old link"

changed="$fixture/changed-requirements"
make_release "$changed"
printf '%s\n' 'fixture==2' > "$changed/backend2/requirements.txt"
prepare_backend_environment "$original" "$changed" >/dev/null
[[ ! -L "$changed/backend2/.venv" ]]
grep -F -- "$changed/backend2/.venv/bin/python -m pip install -r $changed/backend2/requirements.txt" "$GP_ENV_TEST_LOG" >/dev/null
echo "PASS: changed requirements install into the new environment"

touch "$original/backend2/.venv/broken"
replacement="$fixture/broken-interpreter-replacement"
make_release "$replacement"
prepare_backend_environment "$original" "$replacement" >/dev/null
[[ ! -L "$replacement/backend2/.venv" ]]
echo "PASS: an executable but failing interpreter is not reused"

fresh="$fixture/fresh"
make_release "$fresh"
prepare_backend_environment "" "$fresh" >/dev/null
[[ ! -L "$fresh/backend2/.venv" ]]
echo "PASS: first deployment creates an isolated environment"
