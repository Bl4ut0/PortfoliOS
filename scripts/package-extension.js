const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const extDir = path.join(repoRoot, 'services', 'native-relay', 'extension');
const distDir = path.join(repoRoot, 'dist');
const zipPath = path.join(distDir, 'portfolios-native-relay.zip');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

if (process.platform === 'win32') {
  const escapedZip = zipPath.replace(/\\/g, '\\\\');
  const escapedExt = extDir.replace(/\\/g, '\\\\');
  const psScript = `
Add-Type -AssemblyName System.IO.Compression;
Add-Type -AssemblyName System.IO.Compression.FileSystem;
$zip = [System.IO.Compression.ZipFile]::Open('${escapedZip}', [System.IO.Compression.ZipArchiveMode]::Create);
Get-ChildItem -Path '${escapedExt}' -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring(${extDir.length} + 1).Replace('\\', '/');
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel) | Out-Null
};
$zip.Dispose();
`;
  execSync(`powershell -NoProfile -Command "${psScript.replace(/\r?\n/g, ' ')}"`, { stdio: 'inherit' });
} else {
  execSync(`cd "${extDir}" && zip -r "${zipPath}" . -x "*.DS_Store" "*Thumbs.db"`, { stdio: 'inherit' });
}

const stats = fs.statSync(zipPath);
console.log(`Extension packaged successfully: ${zipPath} (${stats.size} bytes)`);
