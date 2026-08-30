import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== '.expo' && f !== 'dist') walk(p);
    } else if (p.endsWith('.ts') || p.endsWith('.tsx')) {
      const content = fs.readFileSync(p, 'utf8');
      const updated = content
        .replace(/from (['"])(\.{1,2}\/[^'"]+?)\.js\1/g, 'from $1$2$1')
        .replace(/import\((['"])(\.{1,2}\/[^'"]+?)\.js\1\)/g, 'import($1$2$1)');
      if (content !== updated) {
        fs.writeFileSync(p, updated, 'utf8');
        console.log('Updated extensions in:', p);
      }
    }
  }
}

const mobileRoot = path.resolve(__dirname, '../apps/mobile');
walk(path.join(mobileRoot, 'app'));
walk(path.join(mobileRoot, 'src'));
console.log('Finished updating mobile imports.');
