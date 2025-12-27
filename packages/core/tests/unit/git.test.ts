import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEffectiveFileUpdate } from '../../src/analysis/timestamp.js';
import { DocDriftConfig } from '../../src/config.js';

// 1. Setup Mocks
const { mockLog, mockCheckIsRepo } = vi.hoisted(() => {
    return {
        mockLog: vi.fn(),
        mockCheckIsRepo: vi.fn(),
    };
});

vi.mock('simple-git', () => {
    const factory = () => ({
        checkIsRepo: mockCheckIsRepo,
        log: mockLog,
    });
    return {
        simpleGit: factory,
        default: factory,
    };
});

// Helper to create mock commit
const createCommit = (msg: string, dateStr: string) => ({
    hash: 'abc',
    date: dateStr, // simple-git returns strings in 'all', but we map to Date in client. Wait, client maps it.
    // The mock returns what simple-git returns.
    message: msg,
    author_name: 'Tester',
    author_email: 'test@test.com',
    refs: '',
    body: '',
});

describe('Git Analysis Layer', () => {
    const defaultConfig = {
        git: {
            ignoreCommitPatterns: ['^chore:', '^style:'],
        },
    } as DocDriftConfig;

    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckIsRepo.mockResolvedValue(true);
    });

    it('Returns latest commit when no patterns match', async () => {
        mockLog.mockResolvedValue({
            all: [
                createCommit('feat: feature A', '2023-01-02T00:00:00Z'),
                createCommit('chore: setup', '2023-01-01T00:00:00Z'),
            ],
        });

        const result = await getEffectiveFileUpdate('test.ts', defaultConfig);

        expect(result).not.toBeNull();
        expect(result?.message).toBe('feat: feature A');
        expect(result?.date).toEqual(new Date('2023-01-02T00:00:00Z'));
    });

    it('Skips noise commits and finds the first meaningful one', async () => {
        mockLog.mockResolvedValue({
            all: [
                createCommit('chore: update readme', '2023-01-05T00:00:00Z'), // Latest
                createCommit('style: fix lint', '2023-01-04T00:00:00Z'),
                createCommit('feat: real logic', '2023-01-03T00:00:00Z'), // Target
                createCommit('feat: old logic', '2023-01-01T00:00:00Z'),
            ],
        });

        const result = await getEffectiveFileUpdate('test.ts', defaultConfig);

        expect(result).not.toBeNull();
        expect(result?.message).toBe('feat: real logic');
        expect(result?.date).toEqual(new Date('2023-01-03T00:00:00Z'));
    });

    it('Handles empty history (file effectively new or all filtered)', async () => {
        // Case 1: Empty history (new file not committed)
        mockLog.mockResolvedValue({ all: [] });
        let result = await getEffectiveFileUpdate('new.ts', defaultConfig);
        expect(result).toBeNull();

        // Case 2: All filtered
        mockLog.mockResolvedValue({
            all: [createCommit('chore: ignored', '2023-01-01T00:00:00Z')],
        });
        result = await getEffectiveFileUpdate('ignored.ts', defaultConfig);
        expect(result).toBeNull();
    });

    it('Throws error if git is not initialized', async () => {
        mockCheckIsRepo.mockResolvedValue(false);
        await expect(getEffectiveFileUpdate('test.ts', defaultConfig))
            .rejects.toThrow('Current directory is not a git repository');
    });

    it('Wraps generic git errors', async () => {
        // Mock checkIsRepo true
        mockCheckIsRepo.mockResolvedValue(true);
        // Mock log throwing generic error
        mockLog.mockRejectedValue(new Error('Unknown git error'));

        await expect(getEffectiveFileUpdate('test.ts', defaultConfig))
            .rejects.toThrow('Failed to fetch commit history');
    });
});
