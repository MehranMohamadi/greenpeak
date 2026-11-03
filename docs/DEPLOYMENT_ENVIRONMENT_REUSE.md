# Backend environment reuse during releases

`deploy/deploy-production.sh` sources `deploy/backend-environment.sh`. The CD
workflow uploads both files into the same temporary directory on the server.

The helper uses `target_release_root` for its destination argument because the
deployment caller declares `release_root` readonly. Bash rejects a local variable
with that same name. Regression checks cover fresh and reused environments with
the caller's readonly variable present.

When requirements are identical, the helper resolves the prior `.venv` with
`readlink -e`, verifies that its Python interpreter actually runs, and links the
new release directly to that physical environment directory. Linking to the
previous release's `.venv` instead would add another symlink on every release,
eventually failing with `Too many levels of symbolic links` and exit code 126.

If the old link is cyclic or broken, the interpreter fails, or requirements
change, the helper creates and installs an isolated environment inside the new
release. It does not modify the old release's environment. All preparation and
compilation finish before the active release link changes. Keep any physical
environment referenced by an active release when cleaning old releases.

Run `bash deploy/tests/test-backend-environment.sh` for isolated regression
checks. The test mocks Python installation and uses temporary directories; it
does not run nginx, PM2, migrations, or production deployment commands. CI runs
it on Linux before deployment is eligible to start.
