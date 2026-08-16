import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const distDir = join(rootDir, 'dist');

const srcIndex = join(rootDir, 'src', 'popup', 'index.html');
const popupHtml = readFileSync(srcIndex, 'utf8');
const popupJs = join(distDir, 'popup.js');

mkdirSync(distDir, { recursive: true });

const outputHtml = popupHtml.replace(/<script type="module" src="\.\/main.tsx"><\/script>/, '<script type="module" src="./popup.js"></script>');
writeFileSync(join(distDir, 'popup.html'), outputHtml);

if (popupJs) {
  console.log('Prepared popup.html for extension root.');
}
