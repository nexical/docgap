#!/usr/bin/env node
import { cac } from 'cac';
import { handleCheck } from './commands.js';
// @ts-ignore
import packageJson from '../package.json';

const cli = cac('doc-drift');

cli
    .command('check [cwd]', 'Check documentation drift in the specified directory')
    .option('--config <path>', 'Path to config file (default: doc-drift.config.json)')
    .option('--strict', 'Exit with code 1 if any drift is detected (useful for CI/CD)')
    .option('--coverage', 'Enable coverage reporting for documented entities')
    .example('  doc-drift check')
    .example('  doc-drift check packages/core')
    .example('  doc-drift check --config ./my-config.json')
    .example('  doc-drift check --strict')
    .example('  doc-drift check --coverage')
    .action(async (cwd, options) => {
        await handleCheck(cwd, options);
    });

// Default command alias to check for convenience (optional, but good DX)
cli
    .command('[cwd]', 'Check documentation drift (default)')
    .option('--config <path>', 'Path to config file (default: doc-drift.config.json)')
    .option('--strict', 'Exit with code 1 if any drift is detected (useful for CI/CD)')
    .option('--coverage', 'Enable coverage reporting for documented entities')
    .action(async (cwd, options) => {
        // If cwd matches a command name (like 'check' if we didn't define it before), it would be an issue,
        // but cac should handle explicit commands first.
        // However, having two commands claiming to handle [cwd] might be tricky in cac.
        // Let's just stick to the requested `check` command and maybe `*` usage or just rely on `check`.
        // To be safe and strictly follow "Usage: ... npx doc-drift check", I will prioritize `check`.
        // But for backward compat/laziness `doc-drift` is nice.
        // Let's try to just change the main command to `check` and maybe add a fallback if I can, 
        // but for now let's just implement `check` as the primary way.

        // Actually, looking at the user request "Usage: Add snippets for CLI (npx doc-drift check)",
        // changing the command definition is the right move.
        await handleCheck(cwd, options);
    });

cli.help();
cli.version(packageJson.version);

export { cli };

export function bootstrap() {
    try {
        cli.parse();
    } catch (error: any) {
        console.error(error.message);
        process.exit(1);
    }
}

// Only run if called directly
import { fileURLToPath } from 'url';
// Export for testing
export const _isMain = (argv1: string, metaUrl: string) => argv1 === fileURLToPath(metaUrl);

// istanbul ignore next
/* v8 ignore next 3 */
if (_isMain(process.argv[1], import.meta.url)) {
    bootstrap();
}
