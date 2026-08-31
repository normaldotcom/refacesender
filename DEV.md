# Development notes — reface DX patch sender

## What this is

A single-page Web MIDI app that lists thousands of Yamaha reface DX voices and
sends the selected one to the synth over SysEx. Zero dependencies. The only
build step is regenerating the patch manifest when the shipped `.syx` set
changes. Deployed by copying the folder to any static host.

**Status: working.** The user has confirmed it sends patches successfully to a
real reface DX from Chrome on Linux. Do not treat this as untested scaffolding.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire app — markup, CSS, and logic in one file |
| `sw.js` | Service worker: offline caching, versioned via `VERSION` at the top |
| `manifest.json` | PWA manifest |
| `icon-*.png` | App icons (DX wordmark), incl. a maskable variant |
| `assets/DX/SYX/*.syx` | The shipped patch library (flat directory, ~9,300 files) |
| `assets/DX/manifest.json` | Generated index: `[{n, f}, …]` used by the app on load |
| `build-manifest.mjs` | Node script: walks `assets/DX/SYX/`, writes `manifest.json` |
| `test/test-ports.mjs` | Port ranking + identity probe suite (13 assertions) |
| `run-tests.sh` | Runs the test suite (from repo root — tests read `./index.html`) |
| `serve.sh` | Local dev server on localhost (Web MIDI needs a secure context) |
| `README.md` | End-user facing instructions |


## Patch library

Single load path:

1. On boot, `tryManifest()` fetches `assets/DX/manifest.json` and builds the
   in-memory `patches` array from `{n, f}` entries. No bytes are loaded yet.
2. On send, `bytesFor(p)` fetches `assets/DX/SYX/<encodeURIComponent(p.file)>`,
   stashes the `Uint8Array` on `p.bytes`, and returns it. Subsequent sends of
   the same patch are instant. The service worker caches each fetch, so an
   installed PWA warms its own offline library as the user auditions patches.

A patch object is `{ name, file, folder, key, hay }` with `bytes` filled in
lazily by `bytesFor`. Filenames may contain `+ ( )` — always URL-encode.

`hay` is a precomputed lowercase search string. Rebuilding it per keystroke was
measurably slow at 9000 patches; don't reintroduce that.

Favourites are a `Set` of `key` (folder + filename, not voice name — names are
heavily duplicated across the collection), persisted as JSON in localStorage
through a `store` wrapper that falls back to memory when storage throws.

`sendPatch` is `async` because `bytesFor` is; the row-highlight and status
updates run after the fetch resolves. Callers (click handler, keyboard, send
button) don't await it — fire-and-forget is fine.

