import { createHash } from 'node:crypto';
import { pack } from 'repomix';
import path from 'path';
import fs from 'node:fs/promises';
import os from 'node:os';

/**
 * Normalizes code content using Repomix's compression logic.
 * This strips comments and whitespace structurally.
 */
export async function normalizeViaRepomix(content: string, extension: string): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docgap-drift-'));
    // Use a consistent filename base to avoid noise in repomix output, 
    // though we extract content anyway.
    const tempFile = path.join(tempDir, `temp${extension}`);

    try {
        await fs.writeFile(tempFile, content);

        const config = {
            output: {
                compress: true,
                style: 'xml',
                filePath: 'repomix-output.xml',
                fileSummary: false,
                directoryStructure: false,
                removeComments: true,
                removeEmptyLines: true,
            },
            input: {
                maxFileSize: 10 * 1024 * 1024,
            },
            include: ['**/*'],
            ignore: {
                useGitignore: false,
                useDotIgnore: true,
                useDefaultPatterns: true,
                customPatterns: [],
            },
            security: {
                enableSecurityCheck: false,
            },
            tokenCount: {
                encoding: 'o200k_base',
            },
            cwd: tempDir,
        };

        // @ts-ignore - Repomix types might be slightly off in some versions or bindings
        const result = await pack([tempDir], config, undefined, undefined, [path.relative(tempDir, tempFile)]);

        // Output is XML. <file path="...">content</file>
        // Since we only have one file, we can just extract the content.
        // Or strictly parse it.
        // The compress format usually looks like:
        // temp.ts
        // code...
        // But with style: xml it wraps it.
        // Let's stick to the raw output analysis or regex match on the wrapper if needed.
        // Actually, repomix --compress without style=xml produces a text dump.
        // But the library usage above with style: 'xml' produces XML.

        // Let's check what CoverageAnalyzer did. It used style: 'xml' and parsed it.
        // But here we want the "compressed" code. 
        // If we set style: 'plain', repomix should just output the content.

        // Let's adjust config to be minimal and extract content.
        // For now, let's assume we get the whole output and we want to hash THAT 
        // because it represents the structural content. 
        // However, repomix output includes file path headers which might vary if temp paths vary.
        // We used relative path '.' so it should be 'temp.ts'.

        let output = '';
        // @ts-ignore
        if (result && result.output) {
            // @ts-ignore
            output = result.output;
        } else {
            // fallback if written to disk (shouldn't happen with our usage pattern but good for safety)
            // ...
            output = '';
        }

        // We want to strip the file header if present to be purely content based
        // XML output: <file path="temp.ts">...</file>
        // We can just regex extract the content.
        const match = /<file path="[^"]+">([\s\S]*?)<\/file>/.exec(output);
        if (match) {
            return match[1].trim();
        }

        return output.trim();

    } finally {
        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

/**
 * Generates a SHA-256 signature for the content after semantic normalization.
 */
export async function getSemanticHash(content: string, extension: string): Promise<string> {
    const cleaned = await normalizeViaRepomix(content, extension);
    return createHash('sha256').update(cleaned).digest('hex');
}
