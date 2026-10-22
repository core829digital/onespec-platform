#!/usr/bin/env sh
# Vercel "Ignored Build Step": exit 0 skips the deployment, exit 1 builds it.
# Dependabot branches are tested by GitHub CI (types, lint, tests, build, e2e) before they can reach main; a Vercel
# preview of them only produced failed-deployment alerts for dependency bumps that were never going to ship as-is.
case "$VERCEL_GIT_COMMIT_REF" in
  dependabot/*)
    echo "[vercel-ignore] dependabot branch ($VERCEL_GIT_COMMIT_REF): skipped, GitHub CI checks it"
    exit 0
    ;;
esac
exit 1
