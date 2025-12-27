import pc from 'picocolors';
import Table from 'cli-table3';
import { FileCheckResult } from '@doc-drift/core';
import path from 'node:path';
import ora from 'ora';

export const spinner = ora();

export function renderHeader() {
    console.log(); // Spacing
    spinner.start(pc.cyan('Doc-Drift: Analyzing codebase...'));
}

export function renderResults(results: FileCheckResult[], root: string, options?: { width?: number }) {
    spinner.stop(); // Stop spinner before printing

    const width = options?.width || process.stdout.columns || 80;
    const isNarrow = width < 100;

    if (isNarrow) {
        renderListView(results, root);
    } else {
        renderTableView(results, root);
    }
}

function renderListView(results: FileCheckResult[], root: string) {
    console.log(pc.dim('─'.repeat(50)));
    results.forEach(res => {
        const relativeDoc = path.relative(root, res.docPath);

        // Format sources with indentation for new lines
        const sourcesList = res.sourceFiles.map(s => path.relative(root, s));
        const relativeSources = sourcesList.length > 0
            ? sourcesList.join('\n           ') // Align with "Source: " (8 chars + 3 spaces)
            : pc.italic('None');

        let statusIcon = '✅';
        let statusText = pc.green('FRESH');

        if (res.status === 'STALE_TIMESTAMP') {
            statusIcon = '⚠️ ';
            statusText = pc.yellow('STALE');
        } else if (res.status === 'STALE_SEMANTIC') {
            statusIcon = '❌';
            statusText = pc.red('DRIFT');
        } else if (res.status === 'UNKNOWN') {
            statusIcon = '❓';
            statusText = pc.gray('UNKNOWN');
        }

        console.log(`${statusIcon} ${pc.bold(statusText)}  ${pc.bold(pc.cyan(relativeDoc))}`);
        console.log(`   ${pc.dim('Source:')} ${relativeSources}`);
        if (res.driftReason) {
            console.log(`   ${pc.dim('Reason:')} ${pc.yellow(res.driftReason)}`);
        }
        console.log(pc.dim('─'.repeat(50)));
    });
}

function renderTableView(results: FileCheckResult[], root: string) {
    const table = new Table({
        head: [pc.white(pc.bold('Status')), pc.white(pc.bold('Doc File')), pc.white(pc.bold('Source')), pc.white(pc.bold('Reason'))],
        wordWrap: true,
        wrapOnWordBoundary: false
    });

    results.forEach((res) => {
        let statusFormatted = pc.green('✅ FRESH');
        if (res.status === 'STALE_TIMESTAMP') {
            statusFormatted = pc.yellow('⚠️  STALE');
        } else if (res.status === 'STALE_SEMANTIC') {
            statusFormatted = pc.bold(pc.red('❌ DRIFT'));
        } else if (res.status === 'UNKNOWN') {
            statusFormatted = pc.gray('❓ UNKNOWN');
        }

        const relativeDoc = path.relative(root, res.docPath);
        const relativeSources = res.sourceFiles.map(s => path.relative(root, s)).join('\n');

        table.push([
            statusFormatted,
            pc.bold(pc.cyan(relativeDoc)),
            pc.gray(relativeSources || '-'),
            res.driftReason ? pc.yellow(res.driftReason) : '',
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
        console.log('\n' + pc.green('✨ All documentation is up to date!'));
    }
}
