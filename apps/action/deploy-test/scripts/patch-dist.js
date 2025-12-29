const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');

function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getAllFiles(filePath, fileList);
        } else {
            if (file.endsWith('.js')) {
                fileList.push(filePath);
            }
        }
    });
    return fileList;
}

const files = getAllFiles(distDir);
let patchedCount = 0;

console.log(`Scanning ${files.length} files in ${distDir}...`);

files.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    const fileName = path.basename(filePath);

    // Patch 1: Switch runtime to child_process
    content = content.replace(/runtime:\s*['"]worker_threads['"]/g, "runtime: 'child_process'");

    // Patch 2: Fix fork path in compiled code (index.js, worker.js)
    // Match: __nccwpck_require__.ab + "process.js" (with optional spaces)
    const processJsRegex = /__nccwpck_require__\.ab\s*\+\s*['"]process\.js['"]/g;

    if (processJsRegex.test(content)) {
        console.log(`Patching process.js path in ${fileName}`);
        content = content.replace(processJsRegex, "require('url').pathToFileURL(require('path').join(__dirname, 'tinypool-dist', 'entry', 'process.js')).href");
    }

    // Patch 3: Fix relative path in tinypool-dist/index.js
    // It uses import.meta.url + "/../entry/process.js" which resolves to dist/entry/process.js
    // We want it to resolve to dist/tinypool-dist/entry/process.js, which is ./entry/process.js relative to that file
    if (filePath.includes('tinypool-dist') && content.includes('/../entry/process.js')) {
        console.log(`Patching relative path in ${fileName}`);
        content = content.replace(/\/..\/.entry\/process.js/g, "/./entry/process.js");
    }

    // Patch 4: Circular dependency in repomix (loadLanguage_require)
    if (fileName === 'index.js') {
        content = content.replace(/loadLanguage_require\(['"]url['"]\)/g, "require('url')");
    }

    if (content !== originalContent) {
        console.log(`Patched ${fileName}`);
        fs.writeFileSync(filePath, content);
        patchedCount++;
    }
});

if (patchedCount === 0) {
    console.error("No files were patched! This suggests the build output structure has changed.");
    process.exit(1);
}

console.log(`Successfully patched ${patchedCount} files.`);
