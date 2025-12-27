# doc-drift

> **Stop lying to your developers. Detect documentation drift automatically.**

`doc-drift` ensures your documentation stays in sync with your code. It works by detecting when "meaningful" code changes occur without corresponding updates to the documentation, bridging the gap between your Spec and Reality.

## Key Features

- **Hybrid Analysis**: Goes beyond simple file watchers. checks Git history (timestamps) AND uses Semantic Code signatures (AST hashing) to ignore noise like whitespace, formatting, or comments.
- **Zero Config CI**: optimized for speed. Runs in GitHub Actions in seconds. No Docker required.
- **Monorepo Native**: Native support for pnpm workspaces and large, complex codebases.

## Usage

### CLI

To run a drift check locally:

```bash
npx doc-drift check
```

### CI

Add `doc-drift` to your CI pipeline:

```yaml
steps:
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0 # Important: Required for deep Git history analysis
  - uses: nexical/doc-drift@v1
```

## Configuration

`doc-drift` is configured via a `.doc-drift.yaml` file in the root of your project.

```yaml
# Global ignore patterns for file scanning
ignore:
  - "node_modules"
  - "dist"

rules:
  # Map a documentation file to one or more source files
  - doc: "README.md"
    source: "src/**/*.ts" # Supports glob patterns

  - doc: "docs/api.md"
    source:
      - "src/api/client.ts"
      - "src/api/server.ts"

git:
  # Commits matching these regex patterns are ignored during Phase 1
  ignoreCommitPatterns:
    - "^chore:"
    - "^style:"
    - "^test:"
```

## How It Works: Finding "Rot"

Documentation **Rot** (or Drift) is the silent killer of developer productivity. It happens when code evolves but the docs remain static.

`doc-drift` identifies this rot through a sophisticated two-phase process:

1.  **Phase 1 (Git)**: Checks for source commits newer than doc commits. It intelligently ignores noise by filtering out commits that match ignored patterns (e.g., `chore`, `test`, `style`).
2.  **Phase 2 (Semantic)**: If drift is suspected, it performs a deep comparison using AST/Signature hashing.
    *   It computes a hash of the "Old" state (at the time of the last doc update) and the "New" state (current HEAD).
    *   If `Hash(Old) === Hash(New)`, the change is considered **FRESH** (no meaningful change), safely ignoring comments, whitespace, and formatting differences.

If the code has moved forward and the logic has changed, `doc-drift` flags it as **DRIFT** and hinders the build (or warns based on config), prompting you to update the documentation.
