import { copyFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const distDir = join(rootDir, 'dist');
const publicDir = join(rootDir, 'public');

mkdirSync(distDir, { recursive: true });
copyFileSync(join(rootDir, 'manifest.json'), join(distDir, 'manifest.json'));

if (existsSync(publicDir)) {
  cpSync(publicDir, distDir, { recursive: true });
}

console.log('Copied manifest.json and public assets to dist/');
