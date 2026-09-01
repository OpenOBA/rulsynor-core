import { rmSync, cpSync, readdirSync, copyFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

// Clean old YAML files in dist/rules (preserve tsc-compiled .js/.d.ts)
if (existsSync('dist/rules')) {
  const distFiles = readdirSync('dist/rules');
  for (const f of distFiles) {
    if (f.endsWith('.erdl.yaml')) {
      unlinkSync(join('dist/rules', f));
    }
  }
} else {
  mkdirSync('dist/rules', { recursive: true });
}

// Copy only .yaml files (not .ts source files)
const srcDir = 'src/rules';
const files = readdirSync(srcDir).filter(f => f.endsWith('.erdl.yaml'));
for (const f of files) {
  copyFileSync(join(srcDir, f), join('dist/rules', f));
}
