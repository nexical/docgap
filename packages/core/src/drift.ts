import { DocGapConfig } from './config.js';
import { FileCheckResult } from './types.js';
import { getEffectiveFileUpdate } from './analysis/timestamp.js';
import { getFileContent, getFileContentAtCommit } from './git/content.js';
import { getSemanticHash } from './analysis/hasher.js';

export async function checkDrift(
    docPath: string,
    sourceFiles: string[],
    config: DocGapConfig
): Promise<FileCheckResult> {
    // 1. Find Last Doc Update
    const t_doc = await getEffectiveFileUpdate(docPath, config);

    const result: FileCheckResult = {
        docPath,
        sourceFiles,
        status: 'FRESH',
        lastDocCommit: t_doc ? { hash: t_doc.hash, date: t_doc.date } : undefined,
        driftingSources: [],
    };

    if (!t_doc) {
        // If doc has no history, we assume it's untracked or new. 
        // We cannot determine drift without a baseline.
        result.status = 'UNKNOWN';
        result.driftReason = 'No git history found for documentation file';
        return result;
    }

    // 2. Check Source Files
    for (const sourceFile of sourceFiles) {
        // 3. Phase 1 (Timestamp)
        const t_code = await getEffectiveFileUpdate(sourceFile, config);

        // If no history for source file, assume it predates the doc or is irrelevant until committed.
        if (!t_code) continue;

        // 4. Comparison
        // If t_code is newer than t_doc -> POTENTIAL DRIFT
        console.log(`[DEBUG] Check drift for ${sourceFile}: doc=${t_doc.date}, code=${t_code.date} (${t_code.date > t_doc.date})`);
        if (t_code.date > t_doc.date) {

            // Phase 2 (Semantic Verification)

            const strict = config.semantic?.strict ?? false;
            const semanticEnabled = config.semantic?.enabled ?? true;

            console.log(`[DEBUG] Config: strict=${strict}, semantic=${semanticEnabled}`);

            if (!strict && semanticEnabled) {
                // Fetch Source_Current (content at HEAD/FS)
                const sourceCurrent = await getFileContent(sourceFile);

                // Fetch Source_Old (content at t_doc commit hash)
                const sourceOld = await getFileContentAtCommit(sourceFile, t_doc.hash);

                const sigCurrent = await getSemanticHash(sourceCurrent, '.' + (sourceFile.split('.').pop() || 'ts'));
                const sigOld = await getSemanticHash(sourceOld, '.' + (sourceFile.split('.').pop() || 'ts'));

                if (sigCurrent === sigOld) {
                    // Match -> FRESH (False alarm, only formatting changed)
                    continue;
                } else {
                    // Mismatch -> STALE_SEMANTIC (Real drift)
                    result.driftingSources.push({
                        sourceFile,
                        reason: 'Semantic mismatch',
                        lastCommit: {
                            hash: t_code.hash,
                            date: t_code.date,
                            message: t_code.message
                        }
                    });
                }
            } else {
                // If strict mode is ON or semantic check failed (meaning disabled), report timestamp drift.
                result.driftingSources.push({
                    sourceFile,
                    reason: 'Timestamp mismatch',
                    lastCommit: {
                        hash: t_code.hash,
                        date: t_code.date,
                        message: t_code.message
                    }
                });
            }
        }
    }

    // Determine Final Status
    if (result.driftingSources.length > 0) {
        // If any file has semantic drift, the whole doc is semantically stale.
        // Otherwise, if any file has timestamp drift (and no semantic drift logic cleared it or strict mode is on), it's timestamp stale.
        const hasSemantic = result.driftingSources.some(d => d.reason === 'Semantic mismatch');
        result.status = hasSemantic ? 'STALE_SEMANTIC' : 'STALE_TIMESTAMP';

        // For backward compatibility (if needed)
        const first = result.driftingSources[0];
        result.lastSourceCommit = first.lastCommit;
        result.driftReason = `${result.driftingSources.length} source file(s) drifting.`;
    }

    return result;
}
