import fs from 'node:fs/promises';
import path from 'node:path';
import { runAnalysis, ConfigSchema, DocDriftConfig } from '@doc-drift/core';
import { renderHeader, renderResults, renderMarketing } from './view.js';
import pc from 'picocolors';

export async function handleCheck(cwd: string, options: { config?: string; strict?: boolean }) {
    renderHeader();

    const root = cwd || process.cwd();
    let config: DocDriftConfig;

    try {
        if (options.config) {
            const configPath = path.resolve(root, options.config);
            const content = await fs.readFile(configPath, 'utf8');
            // TODO: Add YAML support if needed, currently assumes JSON based on core implementation
            const json = JSON.parse(content);
            config = ConfigSchema.parse(json);
        } else {
            // Let core handle default config loading if no path provided
            // But we want to control it if we want to support yaml later? 
            // For now, if no config is passed, runAnalysis will load from default doc-drift.config.json
            // So we can pass undefined.
            // However, we want to fail gracefully if config is missing.
            // Let's try to load it ourselves if we can, or let runAnalysis fail.
            // runAnalysis throws if default config is missing.
        }
    } catch (error: any) {
        console.error(pc.red(`Error loading config: ${error.message}`));
        process.exit(1);
    }

    try {
        // If config was loaded, pass it. If not (and no options.config), pass undefined to let core look for default.
        // But wait, if we parsed it, we pass it.
        // If we didn't parse it (because no option), we pass undefined.
        // BUT runAnalysis loads doc-drift.config.json by default.

        // NOTE: TypeScript flow logic:
        // If options.config is set, we load it into `config`.
        // If not, `config` is undefined.

        // @ts-ignore - We are handling the variable assignment logic above implicitly or explicitly
        const results = await runAnalysis(root, config); // config might be undefined

        renderResults(results);

        const staleCount = results.filter((r) => r.status !== 'FRESH').length;
        renderMarketing({ total: results.length, stale: staleCount });

        if (options.strict && staleCount > 0) {
            console.log(pc.bold(pc.red('\n[STRICT MODE] Drift detected. Exiting with error.')));
            process.exit(1);
        }
    } catch (error: any) {
        console.error(pc.red(`Analysis failed: ${error.message}`));
        process.exit(1);
    }
}
