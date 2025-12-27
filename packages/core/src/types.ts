export type VerificationStatus =
    | 'FRESH'
    | 'STALE_TIMESTAMP'
    | 'STALE_SEMANTIC'
    | 'UNKNOWN';

export interface FileCheckResult {
    docPath: string;
    sourceFiles: string[];
    status: VerificationStatus;
    lastDocCommit?: { hash: string; date: Date };
    lastSourceCommit?: { hash: string; date: Date; message: string };
    driftReason?: string;
}
