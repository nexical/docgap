import * as core from '@actions/core';
import * as github from '@actions/github';
import path from 'path';
import { runAnalysis, loadConfigFromPath, FileCheckResult } from '@docgap/core';

export async function run() {
    try {
        const configPathInput = core.getInput('config') || '.docgap.yaml';
        const strict = core.getInput('strict') === 'true';

        const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
        const configPath = path.resolve(workspace, configPathInput);

        core.info(`Configuration: ${configPath}`);
        core.info(`Strict Mode: ${strict}`);

        let config;
        try {
            config = await loadConfigFromPath(configPath);
        } catch (e: any) {
            core.setFailed(`Could not load config: ${e.message}`);
            return;
        }

        core.info('Running drift analysis...');
        const results = await runAnalysis(workspace, config);

        let hasDrift = false;
        let driftCount = 0;

        for (const result of results) {
            if (result.status !== 'FRESH') {
                hasDrift = true;
                driftCount++;

                const message = `Documentation is stale. Reason: ${result.driftReason || 'Unknown'}`;
                const annotationProperties = {
                    title: 'Drift Detected',
                    file: path.relative(workspace, result.docPath)
                };

                if (strict) {
                    core.error(message, annotationProperties);
                } else {
                    core.warning(message, annotationProperties);
                }
            }
        }

        if (hasDrift) {
            core.startGroup('🔧 How to Fix');
            core.info('Run npx docgap fix to update automatically.');
            core.endGroup();

            if (strict) {
                core.setFailed(`Drift detected in ${driftCount} file(s).`);
            } else {
                core.info(`Drift detected in ${driftCount} file(s), but strict mode is off.`);
            }
        } else {
            core.info('✅ Documentation is fresh.');
        }

    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message);
    }
}

// Only run if called directly
// istanbul ignore next
/* v8 ignore next 3 */
if (require.main === module) {
    run();
}
