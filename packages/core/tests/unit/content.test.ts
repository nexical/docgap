
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFileContent, getFileContentAtCommit } from '../../src/git/content.js';
import fs from 'node:fs/promises';

const { mockShow } = vi.hoisted(() => {
    return { mockShow: vi.fn() };
});

vi.mock('simple-git', () => ({
    simpleGit: () => ({
        show: mockShow,
    }),
}));

vi.mock('node:fs/promises');

describe('Git Content', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getFileContent reads from fs', async () => {
        vi.mocked(fs.readFile).mockResolvedValue('content');
        const result = await getFileContent('file.ts');
        expect(result).toBe('content');
        expect(fs.readFile).toHaveBeenCalledWith('file.ts', 'utf8');
    });

    it('getFileContentAtCommit calls git show', async () => {
        mockShow.mockResolvedValue('content');
        const result = await getFileContentAtCommit('file.ts', 'abc');
        expect(result).toBe('content');
        expect(mockShow).toHaveBeenCalledWith(['abc:file.ts']);
    });

    it('getFileContentAtCommit returns empty string on error', async () => {
        mockShow.mockRejectedValue(new Error('pathspec error'));
        const result = await getFileContentAtCommit('file.ts', 'abc');
        expect(result).toBe('');
    });
});
