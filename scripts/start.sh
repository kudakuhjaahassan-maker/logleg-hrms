#!/bin/sh
# Container entrypoint.
#
# The server must always start. Schema sync is best effort: it runs with a hard
# timeout, logs a warning if it fails, and then the Node process is exec'd either
# way. Raw SQL files are never executed here — one-time data fixes live in
# src/lib/dataMigrations.ts and run inside the app after listen, where a failure
# is logged and swallowed.
set -u

if command -v timeout >/dev/null 2>&1; then
  timeout 90 npx prisma db push --skip-generate \
    || echo "WARN: prisma db push failed or timed out; starting server anyway"
else
  npx prisma db push --skip-generate \
    || echo "WARN: prisma db push failed; starting server anyway"
fi

exec node dist/src/server.js
