import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import pLimit from 'p-limit'; // @ts-ignore
import { ConfigSchema, DocGapConfig } from './config.js';
import { checkDrift } from './drift.js';
import { FileCheckResult, VerificationStatus } from './types.js';

export * from './drift.js';
export * from './config.js';
export * from './types.js';
export * from './git/filter.js';
export * from './analysis/hasher.js';
export * from './coverage/analyzer.js';
export * from './coverage/types.js';
// Export core logic for direct usage

// Limit concurrency to 10
const limit = pLimit(10);

/**
 * Loads configuration from docgap.config.json in the current working directory.
 */
import { parse } from 'yaml';

/**
 * Loads configuration from .docgap.yaml in the current working directory.
 */
export async function loadConfigFromPath(configPath: string): Promise<DocGapConfig> {
    try {
        const content = await fs.readFile(configPath, 'utf8');
        if (configPath.endsWith('.json')) {
            const json = JSON.parse(content);
            return ConfigSchema.parse(json);
        } else {
            const json = parse(content);
            return ConfigSchema.parse(json);
        }
    } catch (error) {
        throw new Error(`Failed to load config from ${configPath}: ${error}`);
    }
}

/**
 * Loads configuration from .docgap.yaml in the current working directory.
 */
async function loadConfig(cwd: string): Promise<DocGapConfig> {
    const configPath = path.join(cwd, '.docgap.yaml');
    try {
        return await loadConfigFromPath(configPath);
    } catch (error) {
        throw new Error(`Failed to load config from ${configPath}: ${error}`);
    }
}

/**
 * Runs the drift analysis for the project in the given directory.
 */
/**
 * Runs the drift analysis for the project in the given directory.
 * @param cwd Current working directory
 * @param config Optional configuration object. If not provided, loads from default path.
 */
export async function runAnalysis(cwd: string, config?: DocGapConfig): Promise<FileCheckResult[]> {
    if (!config) {
        config = await loadConfig(cwd);
    }

    // Collect all tasks
    const tasks: Promise<FileCheckResult>[] = [];

    // The validation phase usually expands globs from the config.
    // Config rules are: doc -> source(s).
    // The doc can be a glob, and source can be globs.

    for (const rule of config.rules) {
        // Expand doc glob
        // We use fast-glob to find all doc files matching the rule.doc pattern
        const docFiles = await fg(rule.doc, { cwd, absolute: true });

        for (const docFile of docFiles) {
            // Determine source files for this doc
            // If source is string, wrap in array
            const sourcePatterns = Array.isArray(rule.source) ? rule.source : [rule.source];

            // Expand source globs
            // Note: Source files might be relative to config or CWD? Usually CWD.
            // But we might want to support relative to doc?
            // "Repomix" style usually implies from root.
            // Dictionary of global ignores to apply
            const globalIgnore = config.ignore ?? [];

            // Expand source globs, applying both rule-level and global ignores
            const sourceFiles = await fg(sourcePatterns, {
                cwd,
                absolute: true,
                ignore: [...(rule.ignore || []), ...globalIgnore]
            });

            tasks.push(
                limit(() => checkDrift(docFile, sourceFiles, config!))
            );
        }
    }

    return Promise.all(tasks);
}
