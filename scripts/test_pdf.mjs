import { execSync } from 'child_process';
import fs from 'fs';

const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    @page { size: A4 portrait; margin: 0; }
    body { font-family: sans-serif; background: #0f172a; color: white; padding: 40px; margin: 0; }
  </style>
</head>
<body>
  <h1>Test Documentation PDF</h1>
</body>
</html>`;

fs.mkdirSync('d:/carto_platform/scratch', { recursive: true });
fs.writeFileSync('d:/carto_platform/scratch/test_doc.html', html, 'utf-8');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
execSync(`"${chromePath}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="d:\\carto_platform\\scratch\\test_doc.pdf" "d:\\carto_platform\\scratch\\test_doc.html"`);

console.log('PDF generated successfully:', fs.existsSync('d:/carto_platform/scratch/test_doc.pdf'));
