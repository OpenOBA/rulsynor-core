import { cpSync } from 'node:fs';
cpSync('src/rules', 'dist/rules', { recursive: true });
