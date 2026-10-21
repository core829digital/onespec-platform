#!/usr/bin/env sh
# Vercel build entrypoint.
# With CONVEX_DEPLOY_KEY set (Vercel → Settings → Environment Variables),
# the Convex backend is deployed first and NEXT_PUBLIC_CONVEX_URL is injected
# into the Next.js build, so frontend and backend always ship together and
# point at the same deployment. Without the key it falls back to a plain
# Next.js build (previous behaviour) instead of failing the deploy.
set -e
if [ -n "$CONVEX_DEPLOY_KEY" ]; then
  echo "[vercel-build] CONVEX_DEPLOY_KEY found: deploying Convex, then building Next.js"
  npx convex deploy --cmd 'npm run build'
else
  echo "[vercel-build] WARNING: CONVEX_DEPLOY_KEY not set - Convex backend NOT deployed, building Next.js only"
  npm run build
fi
