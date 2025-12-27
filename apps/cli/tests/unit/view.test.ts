
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pc from 'picocolors';
import { FileCheckResult } from '@doc-drift/core';

// Mock ora using vi.hoisted to ensure it's available for the mock factory
const { mockSpinner } = vi.hoisted(() => {
    return {
        mockSpinner: {
            start: vi.fn(),
            stop: vi.fn(),
            fail: vi.fn(),
            succeed: vi.fn(),
            isSpinning: false,
            // Add any other properties accessed by view.js if needed
        }
    };
});

vi.mock('ora', () => {
    return {
        default: vi.fn(() => mockSpinner)
    };
});

// Import view AFTER mocking ora
import { renderHeader, renderResults, renderMarketing, renderCoverage, spinner } from '../../src/view.js';

// Mock console.log
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

describe('View Layer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // cleanup
    });

    describe('renderHeader', () => {
        it('starts the spinner', () => {
            renderHeader();
            expect(spinner.start).toHaveBeenCalled();
        });
    });

    describe('renderResults', () => {
        const mockResults: FileCheckResult[] = [
            {
                docPath: '/root/docs/doc.md',
                sourceFiles: ['/root/src/code.ts'],
                status: 'FRESH',
                lastDocCommit: { hash: 'a', date: new Date() }
            },
            {
                docPath: '/root/docs/stale.md',
                sourceFiles: ['/root/src/old.ts'],
                status: 'STALE_TIMESTAMP',
                driftReason: 'Timestamp mismatch'
            },
            {
                docPath: '/root/docs/drift.md',
                sourceFiles: ['/root/src/logic.ts'],
                status: 'STALE_SEMANTIC',
                driftReason: 'Semantic drift'
            },
            {
                docPath: '/root/docs/new.md',
                sourceFiles: [],
                status: 'UNKNOWN',
                driftReason: 'No history'
            }
        ];

        it('renders list view for narrow screens', () => {
            renderResults(mockResults, '/root', { width: 80 });
            expect(spinner.stop).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('FRESH'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('STALE'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('DRIFT'));
        });

        it('renders table view for wide screens', () => {
            renderResults(mockResults, '/root', { width: 120 });
            expect(spinner.stop).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('uses default width (80) if options undefined', () => {
            // Mock stdout columns undefined
            const originalColumns = process.stdout.columns;
            Object.defineProperty(process.stdout, 'columns', { value: undefined, configurable: true });

            renderResults(mockResults, '/root');
            // 80 is narrow (<100), calls list view
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('FRESH'));

            // Restore
            Object.defineProperty(process.stdout, 'columns', { value: originalColumns, configurable: true });
        });

        it('renders list view: handles multiple source files', () => {
            const results = [{
                docPath: 'd', sourceFiles: ['s1', 's2'], status: 'FRESH'
            } as FileCheckResult];
            renderResults(results, '', { width: 50 });
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('s1'));
        });

        it('renders list view: handles no source files', () => {
            const results = [{
                docPath: 'd', sourceFiles: [], status: 'FRESH'
            } as FileCheckResult];
            renderResults(results, '', { width: 50 });
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('None'));
        });
    });



    describe('renderMarketing', () => {
        it('shows success message if no stale files', () => {
            renderMarketing({ total: 5, stale: 0 });
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('All documentation is up to date'));
        });

        it('shows fix command if stale files exist', () => {
            renderMarketing({ total: 5, stale: 2 });
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found 2 drifting files'));
        });
    });

    describe('renderCoverage', () => {
        // renderCoverage is already imported at top level from ../../src/view.js

        it('handles empty reports', () => {
            renderCoverage([], '/root');
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No coverage data available'));
        });

        it('renders coverage table with various scores', () => {
            const reports: any[] = [
                { file: '/root/high.ts', score: 0.9, missing: [] },
                { file: '/root/med.ts', score: 0.6, missing: [] },
                { file: '/root/low.ts', score: 0.4, missing: [{ name: 'A' }] }
            ];

            renderCoverage(reports, '/root');

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Coverage Report'));
            // Check for strings in output (table formatting might contain escape codes)
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('high.ts'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('med.ts'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('low.ts'));

            // Check total coverage
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Total Coverage: 63%'));
            // 90+60+40 = 190 / 3 = 63.33
        });

        it('truncates missing entities list', () => {
            const missing = [
                { name: '1' }, { name: '2' }, { name: '3' },
                { name: '4' }, { name: '5' }, { name: '6' }
            ];
            const reports: any[] = [
                { file: '/root/file.ts', score: 0, missing }
            ];

            renderCoverage(reports, '/root');
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('1, 2, 3, 4, 5...'));
        });
    });
});
