import { z } from 'zod';

const RuleSchema = z.object({
    doc: z.string(),
    source: z.union([z.string(), z.array(z.string())]),
    ignore: z.array(z.string()).optional(),
    maxStaleness: z.number().default(0),
});

export const ConfigSchema = z.object({
    ignore: z.array(z.string()).default(['node_modules', 'dist', '.git']),
    rules: z.array(RuleSchema),
    git: z.object({
        ignoreCommitPatterns: z.array(z.string()).default([
            '^chore:', '^style:', '^test:', '^ci:', '^docs:'
        ]),
        shallow: z.boolean().default(true),
    }).optional(),
    semantic: z.object({
        enabled: z.boolean().default(true),
        strict: z.boolean().default(false),
    }).optional(),
});

export type DocDriftConfig = z.infer<typeof ConfigSchema>;
