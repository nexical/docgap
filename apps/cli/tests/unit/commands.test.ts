
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCheck } from '../../src/commands.js';
import { runAnalysis, ConfigSchema } from '@doc-drift/core';
import * as view from '../../src/view.js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Mocks
vi.mock('node:fs/promises');
vi.mock('@doc-drift/core');
vi.mock('../../src/view.js');

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`Process.exit(${code})`);
});
// Mock console to keep output clean
vi.spyOn(console, 'log').mockImplementation(() => { });

describe('handleCheck', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default mocks
        (view.spinner as any).fail = vi.fn();
    });

    it('loads config from path if provided', async () => {
        // Mock fs read
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ rules: [] }));
        // Mock Schema parse (pass through)
        vi.mocked(ConfigSchema.parse).mockReturnValue({ rules: [] } as any);
        // Mock runAnalysis
        vi.mocked(runAnalysis).mockResolvedValue([]);

        await handleCheck('/cwd', { config: 'config.json' });

        expect(fs.readFile).toHaveBeenCalled();
        expect(ConfigSchema.parse).toHaveBeenCalled();
        expect(runAnalysis).toHaveBeenCalled();
    });

    it('handles yaml config', async () => {
        vi.mocked(fs.readFile).mockResolvedValue('rules: []');
        vi.mocked(ConfigSchema.parse).mockReturnValue({ rules: [] } as any);
        vi.mocked(runAnalysis).mockResolvedValue([]);

        await handleCheck('/cwd', { config: 'config.yaml' });

        // Success means no throw/exit
        expect(runAnalysis).toHaveBeenCalled();
    });

    it('exits if config loading fails', async () => {
        vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

        await expect(handleCheck('/cwd', { config: 'bad' })).rejects.toThrow('Process.exit(1)');
        expect(view.spinner.fail).toHaveBeenCalledWith(expect.stringContaining('Error loading config'));
    });

    it('runs analysis and renders results', async () => {
        vi.mocked(runAnalysis).mockResolvedValue([]);

        await handleCheck('/cwd', {});

        expect(view.renderHeader).toHaveBeenCalled();
        expect(view.renderResults).toHaveBeenCalled();
        expect(view.renderMarketing).toHaveBeenCalled();
    });

    it('exits with code 1 if strict drift detected', async () => {
        const driftResults = [
            { status: 'STALE_TIMESTAMP' }
        ] as any;
        vi.mocked(runAnalysis).mockResolvedValue(driftResults);

        await expect(handleCheck('/cwd', {})).rejects.toThrow('Process.exit(1)');
    });

    it('does not exit if all fresh', async () => {
        const freshResults = [
            { status: 'FRESH' }
        ] as any;
        vi.mocked(runAnalysis).mockResolvedValue(freshResults);

        await handleCheck('/cwd', {});

        expect(mockExit).not.toHaveBeenCalled();
    });

    it('handles analysis failure', async () => {
        vi.mocked(runAnalysis).mockRejectedValue(new Error('Core error'));

        await expect(handleCheck('/cwd', {})).rejects.toThrow('Process.exit(1)');
        expect(view.spinner.fail).toHaveBeenCalledWith(expect.stringContaining('Analysis failed'));
    });

    it('uses process.cwd() if cwd is undefined', async () => {
        vi.mocked(runAnalysis).mockResolvedValue([]);

        await handleCheck(undefined as any, {}); // types say string, but runtime could be undefined/empty

        expect(runAnalysis).toHaveBeenCalledWith(process.cwd(), undefined);
    });
    it('calculates coverage if enabled', async () => {
        const results = [{
            docPath: 'doc.md', sourceFiles: ['code.ts'], status: 'FRESH'
        }] as any;
        vi.mocked(runAnalysis).mockResolvedValue(results);

        // Mock fs reading the doc content
        vi.mocked(fs.readFile).mockResolvedValue('content');

        // Mock analyzer
        const { CoverageAnalyzer } = await import('@doc-drift/core');

        // Ensure analyze is a mock
        // Since we mocked @doc-drift/core at top level, CoverageAnalyzer should be a mock.
        // Static methods on the mocked class should also be mocks.
        vi.mocked(CoverageAnalyzer.analyze).mockResolvedValue({
            file: 'code.ts',
            score: 0.5,
            missing: [{ name: 'foo', kind: 'function', line: 1 }],
            present: []
        });

        await handleCheck('/cwd', { coverage: true });

        expect(view.spinner.start).toHaveBeenCalledWith(expect.stringContaining('Calculating coverage'));
        expect(CoverageAnalyzer.analyze).toHaveBeenCalled();
        expect(view.renderCoverage).toHaveBeenCalled();
        // Check that report was passed (mock implementation of renderCoverage validation or spy?)
        // Since renderCoverage is a real function (imported), we relying on its side-effects or mock?
        // Wait, view.js is NOT mocked fully? 
        // In this test file:
        // vi.mock('../../src/view.js');
        // So view.renderCoverage IS a mock.
        expect(view.renderCoverage).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ score: 0.5 })]),
            expect.any(String)
        );
    });

    it('skips missing doc files during coverage', async () => {
        vi.mocked(runAnalysis).mockResolvedValue([{
            docPath: 'missing.md', sourceFiles: ['code.ts'], status: 'FRESH'
        }] as any);

        // First call to readFile (config) is handled? No config provided.
        // runAnalysis called.
        // Then loop results.
        // readFile for doc content fails.
        vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('ENOENT'));

        await handleCheck('/cwd', { coverage: true });

        // Should not crash, just skip
        const { CoverageAnalyzer } = await import('@doc-drift/core');
        expect(CoverageAnalyzer.analyze).not.toHaveBeenCalled();
    });

    it('ignores analysis errors during coverage', async () => {
        vi.mocked(runAnalysis).mockResolvedValue([{
            docPath: 'doc.md', sourceFiles: ['code.ts'], status: 'FRESH'
        }] as any);

        vi.mocked(fs.readFile).mockResolvedValue('content');

        const { CoverageAnalyzer } = await import('@doc-drift/core');
        vi.mocked(CoverageAnalyzer.analyze).mockRejectedValue(new Error('Analysis error'));

        await handleCheck('/cwd', { coverage: true });

        // Should finish and render coverage (empty likely)
        expect(view.renderCoverage).toHaveBeenCalledWith([], expect.any(String));
    });

    it('includes reports with only present entities', async () => {
        vi.mocked(runAnalysis).mockResolvedValue([{
            docPath: 'doc.md', sourceFiles: ['code.ts'], status: 'FRESH'
        }] as any);

        vi.mocked(fs.readFile).mockResolvedValue('text');

        const { CoverageAnalyzer } = await import('@doc-drift/core');
        vi.mocked(CoverageAnalyzer.analyze).mockResolvedValue({
            file: 'code.ts',
            score: 0.5,
            missing: [],
            present: [{ name: 'foo', kind: 'function', line: 1 }]
        });

        await handleCheck('/cwd', { coverage: true });

        expect(view.renderCoverage).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ present: expect.any(Array) })]),
            expect.any(String)
        );
    });
});
