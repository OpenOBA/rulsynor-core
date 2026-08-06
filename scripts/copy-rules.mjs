import { rmSync, cpSync, readdirSync, copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Clean old dist/rules
rmSync('dist/rules', { recursive: true, force: true });
mkdirSync('dist/rules', { recursive: true });

// Copy only .yaml files (not .ts source files)
const srcDir = 'src/rules';
const files = readdirSync(srcDir).filter(f => f.endsWith('.erdl.yaml'));
for (const f of files) {
  copyFileSync(join(srcDir, f), join('dist/rules', f));
}
