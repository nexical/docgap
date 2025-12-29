
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@actions/core';
import { run } from '../../src/index';
// @ts-ignore
import { runAnalysis, loadConfigFromPath } from '@docgap/core';
import path from 'path';

// Mock @actions/core
vi.mock('@actions/core', () => ({
    getInput: vi.fn(),
    setFailed: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    startGroup: vi.fn(),
    endGroup: vi.fn(),
}));

// Mock @doc-drift/core
vi.mock('@docgap/core', () => ({
    runAnalysis: vi.fn(),
    loadConfigFromPath: vi.fn(),
}));

describe('Action Integration', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Default mock implementations
        (core.getInput as any).mockReturnValue('');
        (loadConfigFromPath as any).mockResolvedValue({ rules: [] });
    });

    it('should verify config loading', async () => {
        const mockConfigPath = 'custom-config.yaml';
        const mockWorkspace = process.cwd();
        vi.stubEnv('GITHUB_WORKSPACE', mockWorkspace);

        (core.getInput as any).mockImplementation((name: string) => {
            if (name === 'config') return mockConfigPath;
            return '';
        });

        await run();

        const expectedPath = path.resolve(mockWorkspace, mockConfigPath);
        expect(loadConfigFromPath).toHaveBeenCalledWith(expectedPath);
    });

    it('should propagate failure when drift is detected (STALE)', async () => {
        // Mock checkDrift returning STALE result (via runAnalysis)
        const mockResults = [{
            docPath: '/abs/path/to/doc.md',
            status: 'STALE',
            driftReason: 'Hash mismatch',
            lastCheck: 'timestamp'
        }];
        (runAnalysis as any).mockResolvedValue(mockResults);

        // Ensure strictly failing on drift
        (core.getInput as any).mockImplementation((name: string) => {
            if (name === 'strict') return 'true';
            return '';
        });

        await run();

        expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining('Drift detected'));
        expect(core.error).toHaveBeenCalledWith(
            expect.stringContaining('Documentation is stale'),
            expect.objectContaining({
                file: expect.stringContaining('doc.md')
            })
        );
    });

    it('should NOT propagate failure when no drift is detected (FRESH)', async () => {
        const mockResults = [{
            docPath: '/abs/path/to/doc.md',
            status: 'FRESH',
            driftReason: null,
            lastCheck: 'timestamp'
        }];
        (runAnalysis as any).mockResolvedValue(mockResults);

        await run();

        expect(core.setFailed).not.toHaveBeenCalled();
        expect(core.error).not.toHaveBeenCalled();
    });
});
