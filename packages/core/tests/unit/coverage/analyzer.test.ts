
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoverageAnalyzer } from '../../../src/coverage/analyzer.js';
import path from 'path';

// Hoist mock for repomix
const { mockPack } = vi.hoisted(() => ({
    mockPack: vi.fn(),
}));

const { mockReadFile } = vi.hoisted(() => ({
    mockReadFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
    readFile: mockReadFile
}));

vi.mock('repomix', () => ({
    pack: mockPack,
    defaultConfig: {},
}));

describe('CoverageAnalyzer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('analyze', () => {
        it('should return empty array if no source files provided', async () => {
            const reports = await CoverageAnalyzer.analyze([], 'content');
            expect(reports).toEqual([]);
        });

        it('should analyze coverage for multiple files', async () => {
            const xmlOutput = `
<file path="test.py">
class User
    def getName
    def setName
</file>
<file path="auth.py">
class Auth
    def login
</file>
`;
            mockPack.mockResolvedValue({ output: xmlOutput });

            const sourceFiles = [
                path.resolve('test.py'),
                path.resolve('auth.py')
            ];
            const docContent = "The User class has a getName method.";

            const reports = await CoverageAnalyzer.analyze(sourceFiles, docContent);

            expect(reports).toHaveLength(2);

            // Check test.py report
            // Names: User (class), getName (function), setName (function)
            // Doc has: User, getName. Missing: setName.
            const userReport = reports.find(r => r.file.endsWith('test.py'));
            expect(userReport).toBeDefined();
            expect(userReport!.present.map(e => e.name).sort()).toEqual(['User', 'getName'].sort());
            expect(userReport!.missing.map(e => e.name).sort()).toEqual(['setName']);
            expect(userReport!.score).toBeCloseTo(2 / 3);

            // Check auth.py report
            // Names: Auth (class), login (function)
            // Doc has coverage for User/getName, but checking if it has anything for Auth/login? 
            // Doc content is "The User class has a getName method." -> Auth/login missing.
            const authReport = reports.find(r => r.file.endsWith('auth.py'));
            expect(authReport).toBeDefined();
            expect(authReport!.present).toHaveLength(0);
            expect(authReport!.missing.map(e => e.name).sort()).toEqual(['Auth', 'login'].sort());
            expect(authReport!.score).toBe(0);
        });

        it('should handle files with no entities', async () => {
            const xmlOutput = `
<file path="empty.ts">
</file>
`;
            mockPack.mockResolvedValue({ output: xmlOutput });

            const reports = await CoverageAnalyzer.analyze([path.resolve('empty.ts')], 'content');

            expect(reports).toHaveLength(1);
            expect(reports[0].score).toBe(1); // Nothing to document -> 100% compliant
        });

        it('should handle repomix returning empty output', async () => {
            mockPack.mockResolvedValue({ output: '<repomix><files></files></repomix>' });

            // Should fill in gaps
            const report = await CoverageAnalyzer.analyze([path.resolve('missing.ts')], 'content');
            expect(report).toHaveLength(1);
            expect(report[0].file).toContain('missing.ts');
            expect(report[0].score).toBe(1);
        });

        it('should fallback to reading file if repomix output is undefined', async () => {
            // Mock repomix returning undefined output (written to disk)
            mockPack.mockResolvedValue({ output: undefined });
            // Mock file read returning XML
            const xmlOutput = `<file path="fallback.ts">class Fallback</file>`;
            mockReadFile.mockResolvedValue(xmlOutput);

            const reports = await CoverageAnalyzer.analyze([path.resolve('fallback.ts')], 'The Fallback class');
            expect(reports).toHaveLength(1);
            expect(mockReadFile).toHaveBeenCalled();
            expect(reports[0].present.map(e => e.name)).toContain('Fallback');
        });

        it('should throw error if fallback file read fails', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            mockPack.mockResolvedValue({ output: undefined });
            mockReadFile.mockRejectedValue(new Error('File not found'));

            await expect(CoverageAnalyzer.analyze([path.resolve('missing.ts')], 'content'))
                .rejects.toThrow('File not found');

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should extract entities with modifiers', async () => {
            const xmlOutput = `
<file path="modifiers.ts">
export default async class MyClass
private static myMethod()
public abstract run()
</file>`;
            mockPack.mockResolvedValue({ output: xmlOutput });

            const reports = await CoverageAnalyzer.analyze([path.resolve('modifiers.ts')], 'content');
            const entities = reports[0].missing.concat(reports[0].present); // All entities

            const names = entities.map(e => e.name).sort();
            expect(names).toEqual(['MyClass', 'myMethod', 'run'].sort());
        });

        it('should extract methods without keywords', async () => {
            const xmlOutput = `
<file path="methods.ts">
  constructor()
  ngOnInit()
  render()
  if (true)
  for (let i=0)
</file>`;
            mockPack.mockResolvedValue({ output: xmlOutput });

            const reports = await CoverageAnalyzer.analyze([path.resolve('methods.ts')], 'content');
            const entities = reports[0].missing.concat(reports[0].present);

            const names = entities.map(e => e.name).sort();
            // Should exclude if/for
            expect(names).toEqual(['constructor', 'ngOnInit', 'render'].sort());
        });
    });
});
