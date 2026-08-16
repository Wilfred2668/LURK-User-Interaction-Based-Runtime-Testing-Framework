import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const distDir = join(rootDir, 'dist');

mkdirSync(distDir, { recursive: true });
copyFileSync(join(rootDir, 'manifest.json'), join(distDir, 'manifest.json'));
console.log('Copied manifest.json to dist/');
