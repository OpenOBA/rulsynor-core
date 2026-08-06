import { rmSync, cpSync } from 'node:fs';
rmSync('dist/rules', { recursive: true, force: true });
cpSync('src/rules', 'dist/rules', { recursive: true });
