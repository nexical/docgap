
import { describe, it, expect } from 'vitest';
import { filterMeaningfulCommits } from '../../src/git/filter.js';
import { GitCommit } from '../../src/git/types.js';

const createCommit = (message: string): GitCommit => ({
    hash: 'abc',
    date: new Date(),
    message,
    author_name: 'Tester',
    author_email: 'test@test.com',
    refs: '',
    body: '',
});

describe('filterMeaningfulCommits', () => {
    it('filters standard noise commits', () => {
        const commits = [
            createCommit('chore: update deps'),
            createCommit('style: format'),
            createCommit('test: add tests'),
            createCommit('ci: config'),
            createCommit('build: script'),
            createCommit('chore(deps): update'),
            createCommit('feat: real change'),
        ];

        const result = filterMeaningfulCommits(commits);
        expect(result).toHaveLength(1);
        expect(result[0].message).toBe('feat: real change');
    });

    it('is case insensitive for standard noise', () => {
        const commits = [
            createCommit('CHORE: update'),
            createCommit('Style: format'),
            createCommit('feat: real'),
        ];
        const result = filterMeaningfulCommits(commits);
        expect(result).toHaveLength(1);
        expect(result[0].message).toBe('feat: real');
    });

    it('respects user defined ignore patterns', () => {
        const commits = [
            createCommit('wip: work in progress'),
            createCommit('ignore-me: specific ignore'),
            createCommit('feat: real'),
        ];
        const ignore = ['^wip:', 'ignore-me'];

        const result = filterMeaningfulCommits(commits, ignore);
        expect(result).toHaveLength(1);
        expect(result[0].message).toBe('feat: real');
    });

    it('handles regex characters in user patterns', () => {
        const commits = [
            createCommit('[skip-ci] update'),
            createCommit('feat: real'),
        ];
        // Regex escaping might be needed if user provides string that looks like regex
        // The implementation does new RegExp(pattern), so user must provide valid regex strings.
        // If user provides '\[skip-ci\]', it works as regex.
        const ignore = ['^\\[skip-ci\\]'];

        const result = filterMeaningfulCommits(commits, ignore);
        expect(result).toHaveLength(1);
        expect(result[0].message).toBe('feat: real');
    });

    it('returns all commits if no patterns match', () => {
        const commits = [
            createCommit('feat: one'),
            createCommit('fix: two'),
        ];
        const result = filterMeaningfulCommits(commits);
        expect(result).toHaveLength(2);
    });

    it('returns empty array if all filtered', () => {
        const commits = [createCommit('chore: 1')];
        const result = filterMeaningfulCommits(commits);
        expect(result).toHaveLength(0);
    });
});
