import fs from 'fs';

try {
  // Read the UTF-16LE file
  const content = fs.readFileSync('README.md', 'utf16le');
  // Write it as UTF-8
  fs.writeFileSync('README_utf8.md', content, 'utf8');
  console.log('Successfully converted README.md to UTF-8!');
} catch (e) {
  console.error('Failed to convert file:', e);
}
