#!/usr/bin/env node
import { cac } from 'cac';
import { handleCheck } from './commands.js';
// @ts-ignore
import packageJson from '../package.json';

const cli = cac('doc-drift');

cli
    .command('[cwd]', 'Check documentation drift in the specified directory')
    .option('--config <path>', 'Path to config file (default: doc-drift.config.json)')
    .option('--strict', 'Exit with code 1 if any drift is detected (useful for CI/CD)')
    .example('  doc-drift')
    .example('  doc-drift packages/core')
    .example('  doc-drift --config ./my-config.json')
    .example('  doc-drift --strict')
    .action(async (cwd, options) => {
        await handleCheck(cwd, options);
    });

cli.help();
cli.version(packageJson.version);

try {
    cli.parse();
} catch (error: any) {
    console.error(error.message);
    process.exit(1);
}
