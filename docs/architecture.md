# Architecture

This document outlines the internal design and structural decisions of `doc-drift`. The architecture prioritizes speed ("Cold start speed") and monorepo compatibility.

## Monorepo Structure

The codebase is organized as a pnpm workspace with three primary components:

### `packages/core`: The "Brain"
*   **Role**: Contains all business logic, strictly separated from any display or environment-specific code.
*   **Tech**: Pure TypeScript, Zod for configuration validtion.
*   **Responsibilities**:
    *   Git history analysis and filtering.
    *   Semantic Code signatures (AST hashing).
    *   Drift detection algorithms.

### `apps/cli`: The "Voice"
*   **Role**: The user interaction layer for local development.
*   **Tech**: `cac` for CLI argument parsing, `tsup` for bundling.
*   **Responsibilities**:
    *   Reading configuration from the local file system.
    *   Executing the core logic.
    *   Displaying results to the developer.

### `apps/action`: The "Gatekeeper"
*   **Role**: The integration point for CI/CD workflows.
*   **Tech**: `@vercel/ncc` for single-file bundling, GitHub Actions Toolkit.
*   **Responsibilities**:
    *   Interfacing with the GitHub Actions environment.
    *   Reporting checks and annotations to Pull Requests.

## The Algorithm

`doc-drift` determines documentation freshness through a two-phase process:

### Phase 1: Temporal Analysis
The first pass relies on `git log` to establish a timeline.
1.  **Filter**: We filter the commit history for "meaningful" changes based on conventional commit patterns. Commits starting with `chore:`, `style:`, or matching configured ignore patterns are discarded.
2.  **Compare**: We determine the "Effective Last Modified Date" of the **Document** and the **Source**.
    *   If `LastModified(Doc) >= LastModified(Source)`, the documentation is **FRESH**.
    *   If `LastModified(Doc) < LastModified(Source)`, we proceed to Phase 2.

### Phase 2: Semantic Analysis
If the temporal check implies drift, we perform a deeper inspection to avoid false positives (e.g., whitespace changes, comments).
1.  **Normalize**: The source code is read, and we strip away comments, whitespace, and formatting noise.
2.  **Hash**: We generate a cryptographic hash of this normalized AST/code structure.
3.  **Override**: This hash is compared against the state known when the documentation was last updated.
    *   If the semantic hashes match, the status is overridden to **FRESH**.
    *   If they differ, the documentation is confirmed as **DRIFT**.

## Constraints & Design Principles

*   **No Docker**: We avoid Docker to ensure near-instant execution in CI workflows.
*   **Git History Only**: We rely on Git history rather than filesystem stats (`fs.stat`) because local file timestamps are unreliable in CI checkouts and don't reflect the true "authoring" time of code logic.
