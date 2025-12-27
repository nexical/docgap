import { createHash } from 'node:crypto';

/**
 * Removes C-style comments and normalizes whitespace.
 * Preserves URLs like http://...
 */
export function cleanContent(content: string): string {
    // 1. Remove block comments /* ... */
    let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '');

    // 2. Remove line comments // ...
    // We use a negative lookbehind or careful matching to avoid stripping http://
    // Pattern: // but provided it's not preceded by : (simple heuristic for URLs)
    // Actually, a safer regex for " //" or start of line "//" that handles most cases:
    cleaned = cleaned.replace(/(^|[^:])\/\/.*$/gm, '$1');

    // 3. Normalize whitespace (newlines -> space, multiple spaces -> single space)
    cleaned = cleaned.replace(/\s+/g, ' ');

    // 4. Trim
    return cleaned.trim();
}

/**
 * Generates a SHA-256 signature for the content after semantic normalization.
 */
export function getSemanticHash(content: string): string {
    const cleaned = cleanContent(content);
    return createHash('sha256').update(cleaned).digest('hex');
}
