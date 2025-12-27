import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../../src/config.js';

describe('ConfigSchema', () => {
    it('parses a valid complete config', () => {
        const validConfig = {
            rules: [
                {
                    doc: 'docs/*.md',
                    source: 'src/**/*.ts',
                    maxStaleness: 5,
                },
            ],
            git: {
                ignoreCommitPatterns: ['^fix:'],
                shallow: false,
            },
            semantic: {
                enabled: false,
                strict: true,
            },
        };

        const result = ConfigSchema.parse(validConfig);
        expect(result).toEqual(expect.objectContaining(validConfig));
    });

    it('applies default values', () => {
        const minimalConfig = {
            rules: [
                {
                    doc: 'docs/*.md',
                    source: 'src/**/*.ts',
                },
            ],
        };

        const result = ConfigSchema.parse(minimalConfig);

        expect(result.ignore).toEqual(['node_modules', 'dist', '.git']);
        expect(result.rules[0].maxStaleness).toBe(0);
    });

    it('throws on missing required fields', () => {
        const invalidConfig = {
            rules: [
                {
                    // Missing doc and source
                    maxStaleness: 5,
                },
            ],
        };

        expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('validates rule structure', () => {
        const invalidRuleConfig = {
            rules: [
                {
                    doc: 'docs/*.md',
                    source: 123, // Invalid type
                },
            ],
        };
        expect(() => ConfigSchema.parse(invalidRuleConfig)).toThrow();
    });
});
