import { GitCommit } from './types.js';

const NORMALIZED_COMMIT_NOISE = /^(chore|style|test|ci|build)(\(.*\))?:/i;

export function filterMeaningfulCommits(
    commits: GitCommit[],
    ignorePatterns: string[] = []
): GitCommit[] {
    const userRegexes = ignorePatterns.map((pattern) => new RegExp(pattern));

    return commits.filter((commit) => {
        // 1. Check standard noise (Conventional Commits)
        if (NORMALIZED_COMMIT_NOISE.test(commit.message)) {
            return false;
        }

        // 2. Check user-defined ignore patterns (config)
        // If ANY regex matches the message, we exclude (filter out) the commit.
        const isIgnored = userRegexes.some((regex) => regex.test(commit.message));
        return !isIgnored;
    });
}
