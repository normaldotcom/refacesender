#!/bin/sh
set -e
echo "== port selection =="       && node test/test-ports.mjs  | tail -3
echo "All suites passed."
