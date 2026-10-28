const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'out');

if (!fs.existsSync(outDir)) {
  console.log('[sync-export] out directory does not exist, skipping.');
  process.exit(0);
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('[sync-export] Copying static export from out/ to project root for Apache...');
fs.readdirSync(outDir).forEach(item => {
  const src = path.join(outDir, item);
  const dest = path.join(rootDir, item);
  copyRecursiveSync(src, dest);
});
console.log('[sync-export] Done! Files ready for Apache.');
