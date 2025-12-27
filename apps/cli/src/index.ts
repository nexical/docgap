import { cac } from 'cac';
import { handleCheck } from './commands.js';
// @ts-ignore
import packageJson from '../package.json';

const cli = cac('doc-drift');

cli
    .command('[cwd]', 'Check documentation drift in the specified directory (default: current)')
    .option('--config <path>', 'Path to config file')
    .option('--strict', 'Fail with exit code 1 if drift detected')
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
