
import { describe, it, expect, vi } from 'vitest';
import { CoverageAnalyzer } from '../../../src/coverage/analyzer.js';
import { getProfile } from '../../../src/coverage/languages.js';

import fs from 'node:fs/promises';

const { mockReadFile } = vi.hoisted(() => ({
    mockReadFile: vi.fn().mockImplementation(async (path: string) => {
        if (path.endsWith('.py')) {
            return `
class User
    def getName
    def setName
class Auth
    def login
`;
        }
        return '';
    }),
}));

// Mock fs to return file content
vi.mock('node:fs/promises', () => ({
    default: {
        readFile: mockReadFile,
    },
    readFile: mockReadFile,
}));

describe('CoverageAnalyzer', () => {
    describe('extractEntities', () => {
        it('should extract entities based on profile', () => {
            const profile = getProfile('.py')!;
            const compressedCode = `
class User
    def getName
    def setName
`;
            const entities = CoverageAnalyzer.extractEntities(compressedCode, profile);

            expect(entities).toHaveLength(3);
            expect(entities[0]).toEqual({ name: 'User', kind: 'class', line: 2 });
            expect(entities[1]).toEqual({ name: 'getName', kind: 'function', line: 3 });
            expect(entities[2]).toEqual({ name: 'setName', kind: 'function', line: 4 });
        });
    });

    describe('analyze', () => {
        it('should return 1 score if no entities found in source file', async () => {
            // Mock empty file content for a valid extension
            mockReadFile.mockResolvedValueOnce('');

            const report = await CoverageAnalyzer.analyze('test.py', '');
            // No entities -> score 1 (compliant by default as nothing to verify)
            expect(report.score).toBe(1);
            expect(report.missing).toHaveLength(0);
        });

        it('should calculate coverage score correctly', async () => {
            const docContent = "The User class has a getName method.";
            const report = await CoverageAnalyzer.analyze('test.py', docContent);

            expect(report.file).toBe('test.py');
            // User and getName are present. Auth, setName, login are missing.
            // Total entities from mock: User, getName, setName, Auth, login (5)
            // Present: User, getName (2)
            // Invalid verification: mock return assumes simple pack.

            // Wait, my mock above returns 5 items?
            // class User (1), def getName (2), def setName (3), class Auth (4), def login (5).
            // Doc has "User", "getName".
            // So present: 2. Missing: 3.
            // Score: 0.4

            expect(report.present.map(e => e.name).sort()).toEqual(['User', 'getName'].sort());
            expect(report.missing.map(e => e.name).sort()).toEqual(['Auth', 'login', 'setName'].sort());
            expect(report.score).toBeCloseTo(0.4);
        });

        it('should return 0 score if no profile found', async () => {
            const report = await CoverageAnalyzer.analyze('test.unknown', '');
            expect(report.score).toBe(0);
            expect(report.present).toHaveLength(0);
        });


    });
});
