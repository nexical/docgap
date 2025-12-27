
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { run } from '../../src/index.js';
import * as core from '@actions/core';
import { runAnalysis, loadConfigFromPath } from '@doc-drift/core';
import path from 'path';

// Mocks
vi.mock('@actions/core');
vi.mock('@actions/github');
vi.mock('@doc-drift/core');
vi.mock('path');

describe('Action Run', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default path resolve
        vi.mocked(path.resolve).mockImplementation((...args) => args.join('/'));
        vi.mocked(path.relative).mockImplementation((from, to) => to.replace(from + '/', ''));
    });

    it('loads config and runs analysis', async () => {
        vi.mocked(core.getInput).mockImplementation((name) => {
            if (name === 'config') return 'config.yaml';
            return '';
        });
        vi.mocked(loadConfigFromPath).mockResolvedValue({ rules: [] } as any);
        vi.mocked(runAnalysis).mockResolvedValue([]);

        await run();

        expect(core.getInput).toHaveBeenCalledWith('config');
        expect(core.getInput).toHaveBeenCalledWith('strict');
        expect(loadConfigFromPath).toHaveBeenCalled();
        expect(runAnalysis).toHaveBeenCalled();
        // Check if ANY call contains fresh (case insensitive or exact match checked)
        const infoCalls = vi.mocked(core.info).mock.calls.map(c => c[0] as string);
        expect(infoCalls.some(msg => msg && msg.includes('fresh'))).toBe(true);
    });

    it('uses default config if not provided', async () => {
        vi.mocked(core.getInput).mockReturnValue('');
        await run();
        expect(path.resolve).toHaveBeenCalledWith(expect.anything(), '.doc-drift.yaml');
    });

    it('fails if config loading fails', async () => {
        vi.mocked(loadConfigFromPath).mockRejectedValue(new Error('Load Error'));
        await run();
        expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining('Could not load config'));
    });

    it('reports failure in strict mode if drift detected', async () => {
        vi.mocked(core.getInput).mockImplementation((name) => {
            if (name === 'strict') return 'true';
            return '';
        });
        vi.mocked(loadConfigFromPath).mockResolvedValue({} as any);
        vi.mocked(runAnalysis).mockResolvedValue([
            { docPath: 'doc.md', sourceFiles: [], status: 'STALE_TIMESTAMP', driftReason: 'drift' }
        ]);

        await run();

        // Should check failure
        expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining('Drift detected'));
        // in strict mode, it emits core.error for annotations
        expect(core.error).toHaveBeenCalledWith(expect.stringContaining('Documentation is stale'), expect.anything());
    });

    it('reports warning in relaxed mode if drift detected', async () => {
        vi.mocked(core.getInput).mockImplementation((name) => {
            if (name === 'strict') return 'false';
            return '';
        });
        vi.mocked(loadConfigFromPath).mockResolvedValue({} as any);
        vi.mocked(runAnalysis).mockResolvedValue([
            { docPath: 'doc.md', sourceFiles: [], status: 'STALE_SEMANTIC', driftReason: 'drift' }
        ]);

        await run();

        expect(core.setFailed).not.toHaveBeenCalled();
        // Should info
        expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Drift detected'));
        // Should warning
        expect(core.warning).toHaveBeenCalled();
    });

    it('catches generic errors', async () => {
        vi.mocked(loadConfigFromPath).mockResolvedValue({} as any);
        vi.mocked(runAnalysis).mockRejectedValue(new Error('Generic Error'));

        await run();
        expect(core.setFailed).toHaveBeenCalledWith('Generic Error');
    });
});
