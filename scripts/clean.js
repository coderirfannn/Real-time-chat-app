#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targets = ['dist', 'build', 'coverage', '.turbo', '.expo', 'tsconfig.tsbuildinfo'];

function deleteInDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (targets.includes(entry.name)) {
        // eslint-disable-next-line no-console
        console.log(`Removing directory: ${path.relative(rootDir, fullPath)}`);
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else if (entry.name !== 'node_modules' && entry.name !== '.git') {
        deleteInDir(fullPath);
      }
    } else if (entry.isFile() && targets.includes(entry.name)) {
      // eslint-disable-next-line no-console
      console.log(`Removing file: ${path.relative(rootDir, fullPath)}`);
      fs.rmSync(fullPath, { force: true });
    }
  }
}

// eslint-disable-next-line no-console
console.log('Cleaning build artifacts across monorepo...');
deleteInDir(rootDir);
// eslint-disable-next-line no-console
console.log('Cleanup complete.');
