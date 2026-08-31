#!/bin/sh
# Web MIDI needs a secure context, so open this over localhost, not file://
PORT=${1:-8000}
echo "Serving on http://localhost:$PORT  (Ctrl-C to stop)"
python3 -m http.server "$PORT" --bind 127.0.0.1
