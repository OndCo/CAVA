import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scannedRoots = [
  path.join(root, 'packages/cava-core/src'),
  path.join(root, 'examples'),
];

const forbidden = [
  '../../../app/lib',
  '../../app/lib',
  'app/lib/cava',
  'Decision Score v2.1',
  'Bounded Action Firewall implementation',
  'Agent Runtime Exposure Graph implementation',
  'runtime-security',
  'customer-specific runtime enrichment',
];

const files = [];
for (const scannedRoot of scannedRoots) {
  if (!fs.existsSync(scannedRoot)) continue;
  const stack = [scannedRoot];
  while (stack.length) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(current)) stack.push(path.join(current, child));
    } else if (current.endsWith('.js') || current.endsWith('.md')) {
      files.push(current);
    }
  }
}

const violations = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const needle of forbidden) {
    if (source.includes(needle)) {
      violations.push(`${path.relative(root, file)} contains forbidden boundary text: ${needle}`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log(`Open-core boundary check passed for ${files.length} files.`);
