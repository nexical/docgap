import pc from 'picocolors';
import Table from 'cli-table3';
import { FileCheckResult } from '@doc-drift/core';

export function renderHeader() {
    console.log('\n' + pc.bold(pc.cyan('Doc-Drift: Analyzing codebase...')) + '\n');
}

export function renderResults(results: FileCheckResult[]) {
    const table = new Table({
        head: [pc.white('Status'), pc.white('Doc File'), pc.white('Source'), pc.white('Reason')],
        wordWrap: true,
    });

    results.forEach((res) => {
        let statusFormatted = pc.green('FRESH');
        if (res.status === 'STALE_TIMESTAMP') {
            statusFormatted = pc.yellow('STALE_TIMESTAMP');
        } else if (res.status === 'STALE_SEMANTIC') {
            statusFormatted = pc.bold(pc.red('STALE_SEMANTIC'));
        }

        table.push([
            statusFormatted,
            pc.gray(res.docPath),
            pc.gray(res.sourceFiles.join(', ')),
            res.driftReason || '',
        ]);
    });

    console.log(table.toString());
}

export function renderMarketing(stats: { total: number; stale: number }) {
    if (stats.stale > 0) {
        console.log('\n' + pc.yellow(`[!] Found ${stats.stale} drifting files.`));
        console.log(
            '\n' +
            pc.bgBlue(
                pc.white(
                    pc.bold(' Fix these issues automatically with AI? Run: npx @doc-drift/fix fix ')
                )
            ) +
            '\n'
        );
    } else {
        console.log('\n' + pc.green('All documentation is up to date!'));
    }
}
