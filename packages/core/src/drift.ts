import { DocDriftConfig } from './config.js';
import { FileCheckResult } from './types.js';
import { getEffectiveFileUpdate } from './analysis/timestamp.js';
import { getFileContent, getFileContentAtCommit } from './git/content.js';
import { getSemanticHash } from './analysis/hasher.js';

export async function checkDrift(
    docPath: string,
    sourceFiles: string[],
    config: DocDriftConfig
): Promise<FileCheckResult> {
    // 1. Find Last Doc Update
    const t_doc = await getEffectiveFileUpdate(docPath, config);

    const result: FileCheckResult = {
        docPath,
        sourceFiles,
        status: 'FRESH',
        lastDocCommit: t_doc ? { hash: t_doc.hash, date: t_doc.date } : undefined,
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
        if (t_code.date > t_doc.date) {

            // Phase 2 (Semantic Verification)
            const strict = config.semantic?.strict ?? false;
            const semanticEnabled = config.semantic?.enabled ?? true;

            if (!strict && semanticEnabled) {
                // Fetch Source_Current (content at HEAD/FS)
                const sourceCurrent = await getFileContent(sourceFile);

                // Fetch Source_Old (content at t_doc commit hash)
                // We compare against the state of the code when the doc was last updated.
                const sourceOld = await getFileContentAtCommit(sourceFile, t_doc.hash);

                const sigCurrent = getSemanticHash(sourceCurrent);
                const sigOld = getSemanticHash(sourceOld);

                if (sigCurrent === sigOld) {
                    // Match -> FRESH (False alarm, only formatting changed)
                    continue;
                } else {
                    // Mismatch -> STALE_SEMANTIC (Real drift)
                    result.status = 'STALE_SEMANTIC';
                    result.lastSourceCommit = {
                        hash: t_code.hash,
                        date: t_code.date,
                        message: t_code.message
                    };
                    result.driftReason = `Semantic change detected in ${sourceFile} since ${t_doc.hash}`;
                    return result;
                }
            }

            // If strict mode is ON or semantic check failed (meaning disabled), report timestamp drift.
            result.status = 'STALE_TIMESTAMP';
            result.lastSourceCommit = {
                hash: t_code.hash,
                date: t_code.date,
                message: t_code.message
            };
            result.driftReason = `Source file ${sourceFile} updated after documentation`;
            return result;
        }
    }

    return result;
}
