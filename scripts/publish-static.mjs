import { copyFile, cp, mkdir } from 'node:fs/promises';

// Keep the existing GitHub Pages branch deployment working without changing settings.
await mkdir('assets', { recursive: true });
await cp('dist/assets', 'assets', { recursive: true });
await copyFile('dist/index.html', 'index.html');
