/**
 * Builds the extension and packages dist/ into the zip the Chrome Web Store expects:
 * an archive whose root holds manifest.json. The archive is named after the version
 * declared in the manifest, so the file on disk always matches what gets uploaded.
 *
 *   npm run package
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const IGNORED_FILES = ['.DS_Store', 'Thumbs.db'];

function buildExtension() {
    console.log('Building the extension...');
    execFileSync('npx', ['webpack'], { cwd: ROOT_DIR, stdio: 'inherit' });
}

function readManifestVersion() {
    const manifestPath = path.join(DIST_DIR, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
        throw new Error('dist/manifest.json is missing, the build did not produce a package.');
    }

    const { version } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    if (!version) {
        throw new Error('The manifest has no version, add one before packaging.');
    }

    return version;
}

function addFolderToZip(zip, folderPath) {
    for (const entry of fs.readdirSync(folderPath, { withFileTypes: true })) {
        if (IGNORED_FILES.includes(entry.name)) {
            continue;
        }

        const entryPath = path.join(folderPath, entry.name);

        if (entry.isDirectory()) {
            addFolderToZip(zip.folder(entry.name), entryPath);
        } else {
            zip.file(entry.name, fs.readFileSync(entryPath));
        }
    }
}

async function packageExtension() {
    buildExtension();

    const version = readManifestVersion();
    const zipPath = path.join(ROOT_DIR, `sfdl-${version}.zip`);

    const zip = new JSZip();
    addFolderToZip(zip, DIST_DIR);

    const content = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
    });

    fs.writeFileSync(zipPath, content);

    const megaBytes = (content.length / 1024 / 1024).toFixed(1);
    console.log(`\nPackaged version ${version}: ${path.relative(ROOT_DIR, zipPath)} (${megaBytes} MB)`);
    console.log('Upload it at https://chrome.google.com/webstore/devconsole -> your item -> Package.');
}

packageExtension().catch((error) => {
    console.error(`\nPackaging failed: ${error.message}`);
    process.exit(1);
});
