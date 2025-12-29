const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');
const files = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));

let patchedCount = 0;

console.log(`Scanning ${files.length} files in ${distDir}...`);

files.forEach(file => {
    const filePath = path.join(distDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Patch 1: Switch runtime to child_process
    content = content.replace(/runtime:\s*['"]worker_threads['"]/g, "runtime: 'child_process'");

    // Patch 2: Fix process.js path
    // Match: __nccwpck_require__.ab + "process.js" (with optional spaces)
    // Replacement: require('url').pathToFileURL(require('path').join(__dirname, 'tinypool-dist', 'entry', 'process.js')).href
    const processJsRegex = /__nccwpck_require__\.ab\s*\+\s*['"]process\.js['"]/g;

    if (processJsRegex.test(content)) {
        console.log(`Patching process.js path in ${file}`);
        content = content.replace(processJsRegex, "require('url').pathToFileURL(require('path').join(__dirname, 'tinypool-dist', 'entry', 'process.js')).href");
    } else if (content.includes("process.js")) {
        console.warn(`WARNING: Found 'process.js' in ${file} but regex did not match!`);
        // Print context around the match for debugging
        const match = content.match(/.{0,50}process\.js.{0,50}/);
        if (match) {
            console.warn(`Context: ${match[0]}`);

            // Fallback: If the simple regex fails, maybe it's just 'process.js' string without concat?
            // Try a broader match for .ab + "..."
            const broadRegex = /\.ab\s*\+\s*['"]process\.js['"]/g;
            if (broadRegex.test(content)) {
                console.log(`Putting fallback patch for ${file} using broad regex`);
                // If we find this pattern, it means the variable name is likely different or something else is concatenated
                // We can try to replace just the string part if we are careful, or replace the whole logic if capture groups allow.
                // But 'broadRegex' matches .ab + "process.js". The variable name is BEFORE .ab.
                // We should replace whatever matched with our URL logic.
                // HOWEVER, we need to know the variable name if we want to use __dirname? No, we use require('path').join(__dirname...)
                // so we DON'T need the original variable. We REPLACE the whole expression: (VAR.ab + "process.js") -> (URL_LOGIC)

                // To do this safely, we need to replace exactly what matched.
                content = content.replace(broadRegex, "require('url').pathToFileURL(require('path').join(__dirname, 'tinypool-dist', 'entry', 'process.js')).href");
                console.log("Applied fallback patch.");
            }
        }
    }

    // Patch 3: Circular dependency in repomix (loadLanguage_require)
    if (file === 'index.js') {
        content = content.replace(/loadLanguage_require\(['"]url['"]\)/g, "require('url')");
    }

    if (content !== originalContent) {
        console.log(`Patched ${file}`);
        fs.writeFileSync(filePath, content);
        patchedCount++;
    }
});

if (patchedCount === 0) {
    console.error("No files were patched! This suggests the build output structure has changed.");
    process.exit(1);
}

console.log(`Successfully patched ${patchedCount} files.`);
