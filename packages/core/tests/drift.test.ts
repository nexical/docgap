import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkDrift } from '../src/drift.js';
import { DocDriftConfig } from '../src/config.js';

// Mocks
const { mockLog, mockShow, mockCheckIsRepo, mockReadFile } = vi.hoisted(() => ({
    mockLog: vi.fn(),
    mockShow: vi.fn(),
    mockCheckIsRepo: vi.fn(),
    mockReadFile: vi.fn(),
}));

vi.mock('simple-git', () => ({
    simpleGit: () => ({
        checkIsRepo: mockCheckIsRepo,
        log: mockLog,
        show: mockShow,
    }),
    // Default export might be needed depending on how simple-git is imported
    default: () => ({
        checkIsRepo: mockCheckIsRepo,
        log: mockLog,
        show: mockShow,
    }),
}));

vi.mock('node:fs/promises', () => ({
    default: {
        readFile: mockReadFile,
    },
}));

const createCommit = (msg: string, dateStr: string, hash: string = 'abc') => ({
    hash,
    date: dateStr,
    message: msg,
    author_name: 'Tester',
    author_email: 'test@test.com',
    refs: '',
    body: '',
});

describe('Core Drift Check', () => {
    // Basic mock config
    const config = {
        rules: [],
        ignore: [],
        semantic: { enabled: true, strict: false },
        // satisfy zod types roughly (cast as any if needed or partial)
    } as unknown as DocDriftConfig;

    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckIsRepo.mockResolvedValue(true);
    });

    it('Status is FRESH if code is older than doc', async () => {
        // Doc updated at T2
        mockLog.mockResolvedValueOnce({
            all: [createCommit('doc update', '2023-02-01T00:00:00Z')],
        });
        // Code updated at T1
        mockLog.mockResolvedValueOnce({
            all: [createCommit('code update', '2023-01-01T00:00:00Z')],
        });

        const result = await checkDrift('doc.md', ['code.ts'], config);
        expect(result.status).toBe('FRESH');
    });

    it('Status is FRESH if code is newer but semantically same', async () => {
        // Doc updated at T1
        mockLog.mockResolvedValueOnce({
            all: [createCommit('doc update', '2023-01-01T00:00:00Z', 'hash_doc_t1')],
        });
        // Code updated at T2 (Newer)
        mockLog.mockResolvedValueOnce({
            all: [createCommit('code update', '2023-02-01T00:00:00Z', 'hash_code_t2')],
        });

        // Content at T1 (Doc time) - Git Show
        mockShow.mockResolvedValue('function foo() { return 1; }');

        // Content at T2 (Current FS)
        mockReadFile.mockResolvedValue('function foo() {   return 1;   }'); // formatting change only

        const result = await checkDrift('doc.md', ['code.ts'], config);

        expect(result.status).toBe('FRESH');
        // Verify we checked content at the DOC's commit hash
        expect(mockShow).toHaveBeenCalledWith(['hash_doc_t1:code.ts']);
    });

    it('Status is STALE_SEMANTIC if content differs', async () => {
        // Doc updated at T1
        mockLog.mockResolvedValueOnce({
            all: [createCommit('doc update', '2023-01-01T00:00:00Z', 'hash_doc_t1')],
        });
        // Code updated at T2
        mockLog.mockResolvedValueOnce({
            all: [createCommit('code update', '2023-02-01T00:00:00Z', 'hash_code_t2')],
        });

        // Content at T1
        mockShow.mockResolvedValue('function foo() { return 1; }');

        // Content at T2 (Logic change)
        mockReadFile.mockResolvedValue('function foo() { return 2; }');

        const result = await checkDrift('doc.md', ['code.ts'], config);

        expect(result.status).toBe('STALE_SEMANTIC');
        expect(result.driftReason).toContain('Semantic change detected');
    });

    it('Status is STALE_TIMESTAMP if semantic check disabled', async () => {
        const noSemanticConfig = { ...config, semantic: { enabled: false } } as DocDriftConfig;

        // Doc updated at T1
        mockLog.mockResolvedValueOnce({
            all: [createCommit('doc update', '2023-01-01T00:00:00Z')],
        });
        // Code updated at T2
        mockLog.mockResolvedValueOnce({
            all: [createCommit('code update', '2023-02-01T00:00:00Z')],
        });

        const result = await checkDrift('doc.md', ['code.ts'], noSemanticConfig);

        expect(result.status).toBe('STALE_TIMESTAMP');
    });

    it('Status is STALE_TIMESTAMP if strict mode is ON', async () => {
        const strictConfig = { ...config, semantic: { enabled: true, strict: true } } as DocDriftConfig;

        // Doc updated at T1
        mockLog.mockResolvedValueOnce({
            all: [createCommit('doc update', '2023-01-01T00:00:00Z')],
        });
        // Code updated at T2
        mockLog.mockResolvedValueOnce({
            all: [createCommit('code update', '2023-02-01T00:00:00Z')],
        });

        // Should NOT call git show or readFile
        const result = await checkDrift('doc.md', ['code.ts'], strictConfig);

        expect(result.status).toBe('STALE_TIMESTAMP');
        expect(mockShow).not.toHaveBeenCalled();
        expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('Status is FRESH if only comments changed (Phase 2)', async () => {
        // Doc updated at T1
        mockLog.mockResolvedValueOnce({
            all: [createCommit('doc update', '2023-01-01T00:00:00Z', 'hash_doc_t1')],
        });
        // Code updated at T2 (Newer)
        mockLog.mockResolvedValueOnce({
            all: [createCommit('comment update', '2023-02-01T00:00:00Z', 'hash_code_t2')],
        });

        // Content at T1 (Doc time) - Git Show
        mockShow.mockResolvedValue(`
            function foo() {
                // Return 1
                return 1;
            }
        `);

        // Content at T2 (Current FS) - Changed comments, added block comment
        mockReadFile.mockResolvedValue(`
            /**
             * returns one
             */
            function foo() {
                // Just returning 1 here
                return 1; 
            }
        `);

        // Expectation: Semantically the code is: function foo() { return 1; }
        // So statuses should match.

        const result = await checkDrift('doc.md', ['code.ts'], config);

        expect(result.status).toBe('FRESH');
        // Verify we checked content at the DOC's commit hash
        expect(mockShow).toHaveBeenCalledWith(['hash_doc_t1:code.ts']);
    });
});
