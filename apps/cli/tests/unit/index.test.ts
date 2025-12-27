
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cli, bootstrap, _isMain } from '../../src/index.js';
import * as commands from '../../src/commands.js';

vi.mock('../../src/commands.js', () => ({
    handleCheck: vi.fn(),
}));

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`Process.exit(${code})`);
});

// We need to suppress console output
vi.spyOn(console, 'log').mockImplementation(() => { });
vi.spyOn(console, 'error').mockImplementation(() => { });

describe('CLI Entry Point', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Command Registration', () => {
        it('registers check command', () => {
            cli.parse(['node', 'bin', 'check', '.']);
            expect(commands.handleCheck).toHaveBeenCalledWith('.', expect.objectContaining({}));
        });

        it('registers default command', () => {
            cli.parse(['node', 'bin', '.']);
            expect(commands.handleCheck).toHaveBeenCalledWith('.', expect.objectContaining({}));
        });

        it('passes options', () => {
            cli.parse(['node', 'bin', 'check', '.', '--strict', '--config', 'c.json']);
            expect(commands.handleCheck).toHaveBeenCalledWith('.', expect.objectContaining({
                strict: true,
                config: 'c.json'
            }));
        });
    });

    describe('Bootstrap', () => {
        it('calls cli.parse', () => {
            const parseSpy = vi.spyOn(cli, 'parse').mockReturnValue({ args: [], options: {} } as any);
            bootstrap();
            expect(parseSpy).toHaveBeenCalled();
        });

        it('handles parse errors', () => {
            vi.spyOn(cli, 'parse').mockImplementationOnce(() => {
                throw new Error('Parse error');
            });

            expect(() => bootstrap()).toThrow('Process.exit(1)');
            expect(console.error).toHaveBeenCalledWith('Parse error');
        });
    });

    describe('isMain', () => {
        it('detects correct execution context', () => {
            expect(_isMain('/bin/cli', 'file:///bin/cli')).toBe(true);
            expect(_isMain('/bin/cli', 'file:///bin/other')).toBe(false);
        });
    });
});
