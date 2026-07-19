// onnxruntime-web ships its wasm/webgpu runtime as static assets that must be
// served from the same origin (no CDN dependency, so it works offline once
// cached by the PWA service worker). This copies just the wasm + webgpu/wasm
// backend loaders out of node_modules into public/ort/ on every install, so
// public/ort/ never needs to be committed — it's derived, like node_modules.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'node_modules', 'onnxruntime-web', 'dist');
const DEST = path.join(__dirname, '..', 'public', 'ort');

// The webgl and node-specific bundles aren't used (we target wasm + webgpu
// execution providers only), so they're skipped to avoid shipping dead weight.
const WANTED = /^(ort-wasm.*\.(wasm|mjs)|ort\.(wasm|webgpu|min)[^/]*\.mjs)$/;

if (!fs.existsSync(SRC)) {
  console.error(`copy-onnx-runtime: ${SRC} not found — is onnxruntime-web installed?`);
  process.exit(1);
}

fs.mkdirSync(DEST, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => WANTED.test(f) && !f.endsWith('.map'));
for (const f of files) {
  fs.copyFileSync(path.join(SRC, f), path.join(DEST, f));
}

console.log(`copy-onnx-runtime: copied ${files.length} files to public/ort/`);
