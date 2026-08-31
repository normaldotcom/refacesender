# reface DX patch sender

A single-page Web MIDI app that lists thousands of Yamaha reface DX voices and
sends the selected one to the synth over SysEx. No backend, no build step, no
dependencies.

## Installing it on Android

Deploy the folder to any HTTPS static host, open it in Chrome for Android, then
use the menu's **Install app** / **Add to home screen**. You get a launcher
icon and a full-screen window with no browser chrome.

This is not a WebView wrapper — an installed PWA runs in Chrome itself, so Web
MIDI works exactly as it does in the browser tab, and the SysEx permission you
granted carries over.

The service worker caches the app shell on install, caches
`assets/DX/manifest.json` on first load, and caches each `.syx` file the
first time it's sent. After that it works with no signal. To push an update
to an installed copy, bump `VERSION` at the top of `sw.js`.

Navigations are network-first (so a redeploy appears next time you're online)
and everything else is cache-first (so it's fast and works offline).

## Running it

Web MIDI needs a secure context, so opening `index.html` from the filesystem
won't work. Serve it:

```
cd refacedx-sender
python3 -m http.server 8000
```

Then visit `http://localhost:8000` in Chrome or Edge. Allow the MIDI prompt —
it asks specifically for System Exclusive access, which is what patch dumps
travel over.

For phone use, deploy the folder to any static host with HTTPS (GitHub Pages,
Netlify, Cloudflare Pages) and open it in Chrome for Android with the DX
connected by USB OTG. Safari and everything on iOS have no Web MIDI at all.

## Loading patches

Patches ship with the app under `assets/DX/SYX/`. On load the browser fetches
`assets/DX/manifest.json` (a ~460 KB index of names + filenames) and populates
the list. Each `.syx` is fetched on demand the first time it's sent, then
cached by the service worker.

To regenerate the manifest after adding or removing patches:

```
node build-manifest.mjs
```

That walks `assets/DX/SYX/`, extracts each patch's embedded voice name from
its voice-common SysEx block (falling back to the filename), and writes
`assets/DX/manifest.json`.

## Using it

- Tap or click a patch, then hit **Send patch**.
- **auto** sends immediately on selection, for arrowing through and auditioning.
- Star patches to build a shortlist; the ★ button in the search bar filters to it.
- Arrow keys move, Enter sends.
- Settings has the inter-message gap, a panic button, and a one-shot SysEx that
  disables the DX's auto power-off.

## Things worth knowing about the hardware

- Sent voices land in the **edit buffer**, not memory. Any unsaved edit on the
  DX is overwritten, and you must press Store on the synth to keep the incoming
  patch.
- A voice is ~7 consecutive SysEx messages, sent individually with a gap. The
  default 20 ms is comfortable; if patches arrive garbled, raise it in settings.
- Port names differ per OS. The app auto-selects anything matching `/reface/i`
  but you can override it in the dropdown.

## Credits

Patches were created by the Soundmondo community and converted to SysEx,
de-duplicated, and published by Martin Tarenskeen at
<https://soundmondo.martintarenskeen.nl/>. He accepts donations for the work.
