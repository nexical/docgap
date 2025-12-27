
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
});
