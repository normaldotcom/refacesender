#!/usr/bin/env node
// Walk assets/DX/SYX/ and emit assets/DX/manifest.json — one entry per patch
// with its embedded voice name and filename. The app fetches each .syx on
// demand rather than pre-bundling.
//
//   node build-manifest.mjs

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SRC = "assets/DX/SYX";
const OUT = "assets/DX/manifest.json";

function splitSysex(bytes) {
  const out = [];
  let i = 0;
  while (i < bytes.length) {
    const start = bytes.indexOf(0xF0, i);
    if (start === -1) break;
    const end = bytes.indexOf(0xF7, start);
    if (end === -1) break;
    out.push(bytes.subarray(start, end + 1));
    i = end + 1;
  }
  return out;
}

function voiceName(bytes) {
  for (const m of splitSysex(bytes)) {
    if (m.length > 21 && m[1] === 0x43 && m[8] === 0x30 && m[9] === 0x00 && m[10] === 0x00) {
      let s = "";
      for (let i = 11; i < 21; i++) {
        const c = m[i];
        s += (c >= 32 && c < 127) ? String.fromCharCode(c) : " ";
      }
      s = s.trim();
      if (s) return s;
    }
  }
  return null;
}

const files = (await readdir(SRC)).filter(f => /\.syx$/i.test(f));
const patches = [];
let skipped = 0;

for (const f of files) {
  const buf = await readFile(join(SRC, f));
  if (buf.length < 12 || buf[0] !== 0xF0 || buf[1] !== 0x43) { skipped++; continue; }
  patches.push({ n: voiceName(buf) || f.replace(/\.syx$/i, ""), f });
}

patches.sort((a, b) => a.n.localeCompare(b.n, undefined, { sensitivity: "base" }));

await writeFile(OUT, JSON.stringify({
  source: "Soundmondo community voices, converted by Martin Tarenskeen (soundmondo.martintarenskeen.nl)",
  built: new Date().toISOString().slice(0, 10),
  patches
}));

console.log(`${patches.length} patches -> ${OUT}` + (skipped ? ` (${skipped} skipped)` : ""));
