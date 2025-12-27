
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAnalysis, loadConfigFromPath, DocGapConfig } from '../../src/index.js';
import { checkDrift } from '../../src/drift.js';
import fg from 'fast-glob';
import fs from 'node:fs/promises';
import path from 'node:path';

vi.mock('fast-glob');
vi.mock('node:fs/promises');
vi.mock('../../src/drift.js');

describe('index.ts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('loadConfigFromPath', () => {
        it('loads and parses .yaml config', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(`
rules:
  - doc: docs/*.md
    source: src/*.ts
git:
  shallow: true
`);
            const config = await loadConfigFromPath('/path/to/.docgap.yaml');
            expect(config.rules).toHaveLength(1);
            expect(config.git?.shallow).toBe(true);
        });

        it('loads and parses .json config', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
                rules: [{ doc: 'a', source: 'b' }]
            }));
            const config = await loadConfigFromPath('/path/to/docgap.config.json');
            expect(config.rules).toHaveLength(1);
        });

        it('throws on invalid file', async () => {
            vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
            await expect(loadConfigFromPath('bad')).rejects.toThrow('Failed to load config');
        });

        // Note: loadConfig logic (fallback) is internal to runAnalysis or exported?
        // runAnalysis calls loadConfig if config not provided.
        // But loadConfig is not exported. However runAnalysis behavior covers it.
    });

    describe('runAnalysis', () => {
        it('runs analysis for each doc file found', async () => {
            const config = {
                rules: [
                    { doc: 'docs/*.md', source: 'src/*.ts', maxStaleness: 0 }
                ],
                ignore: ['node_modules'],
            } as DocGapConfig;

            vi.mocked(fg).mockResolvedValueOnce(['/abs/docs/1.md', '/abs/docs/2.md']); // doc files
            vi.mocked(fg).mockResolvedValue(['/abs/src/1.ts']); // source files (called twice)

            vi.mocked(checkDrift).mockResolvedValue({
                docPath: 'doc', sourceFiles: [], status: 'FRESH'
            });

            const results = await runAnalysis('/cwd', config);

            expect(fg).toHaveBeenCalledTimes(3); // 1 for doc glob, 2 for source globs (once per doc)
            expect(checkDrift).toHaveBeenCalledTimes(2);
            expect(results).toHaveLength(2);
        });

        it('loads config if not provided', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(`
rules: []
`);
            vi.mocked(fg).mockResolvedValue([]);

            await runAnalysis('/cwd');

            expect(fs.readFile).toHaveBeenCalled();
        });

        it('handles source defined as array in config', async () => {
            const config = {
                rules: [
                    { doc: 'doc', source: ['s1', 's2'] }
                ],
            } as any;
            vi.mocked(fg).mockResolvedValueOnce(['/doc']);
            vi.mocked(fg).mockResolvedValueOnce(['/s1']);

            await runAnalysis('/cwd', config);
            // Verify fg was called with array
            expect(fg).toHaveBeenLastCalledWith(['s1', 's2'], expect.anything());
        });

        it('throws if yaml fails', async () => {
            vi.mocked(fs.readFile).mockRejectedValue(new Error('no file'));

            await expect(runAnalysis('/cwd')).rejects.toThrow('Failed to load config');
        });
    });
});
