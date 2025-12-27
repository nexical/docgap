import fs from 'node:fs/promises';
import path from 'node:path';
import { runAnalysis, ConfigSchema, DocDriftConfig } from '@doc-drift/core';
import { renderHeader, renderResults, renderMarketing, spinner } from './view.js';
import pc from 'picocolors';
import { parse } from 'yaml';

export async function handleCheck(cwd: string, options: { config?: string; strict?: boolean }) {
    renderHeader();

    const root = cwd || process.cwd();
    let config: DocDriftConfig;

    try {
        if (options.config) {
            const configPath = path.resolve(root, options.config);
            const content = await fs.readFile(configPath, 'utf8');
            let json;
            if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
                json = parse(content);
            } else {
                json = JSON.parse(content);
            }
            config = ConfigSchema.parse(json);
        } else {
            // Let core load default (.doc-drift.yaml)
            // We do nothing here, leaving config undefined so core handles it.
        }
    } catch (error: any) {
        spinner.fail(pc.red(`Error loading config: ${error.message}`));
        process.exit(1);
    }

    try {
        // @ts-ignore - We are handling the variable assignment logic above implicitly or explicitly
        const results = await runAnalysis(root, config); // config might be undefined

        renderResults(results, root);

        const staleCount = results.filter((r) => r.status === 'STALE_TIMESTAMP' || r.status === 'STALE_SEMANTIC').length;
        renderMarketing({ total: results.length, stale: staleCount });

        if (staleCount > 0) {
            // Check command should fail if drift is detected for CI/Hooks
            process.exit(1);
        }
    } catch (error: any) {
        spinner.fail(pc.red(`Analysis failed: ${error.message}`));
        process.exit(1);
    }
}
