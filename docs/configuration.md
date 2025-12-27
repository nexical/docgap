# Configuration

`doc-drift` is configured via a `.doc-drift.yaml` file in the root of your project. This file defines which documentation files correspond to which source files and sets global analysis rules.

## Example

```yaml
# Global ignores (affect all rules)
ignore:
  - "node_modules"
  - "dist"
  - ".git"

# Mapping rules between docs and code
rules:
  # Rule 1: Architecture doc tracks all core source files
  - doc: "docs/architecture.md"
    source: "packages/core/src/**/*.ts"

  # Rule 2: README tracks the CLI entry point and package manifest
  - doc: "README.md"
    source:
      - "apps/cli/src/index.ts"
      - "package.json"

# Git history analysis configuration
git:
  # Regex patterns for commit messages to ignore
  ignoreCommitPatterns: 
    - "^chore:"
    - "^style:"
    - "^ci:"

# Semantic analysis settings
semantic:
  enabled: true
```

## Schema Reference

### `ignore`
*   **Type**: `string[]`
*   **Description**: A list of glob patterns to exclude from all file watchers. Useful for ignoring build artifacts, dependencies, or system files.

### `rules`
*   **Type**: `Rule[]`
*   **Description**: The core mapping logic. Each rule links a documentation file to one or more source files.

#### Rule Object
*   `doc`: (Required) Path to the documentation file (markdown).
*   `source`: (Required) A glob string or array of glob strings defining the source code that the documentation describes.

### `git`
*   **Type**: `Object`
*   **Description**: Settings for the Temporal Analysis phase.
*   `ignoreCommitPatterns`: An array of Regex patterns (as strings). Commits with messages matching these patterns are considered "noise" and will not trigger a drift update.

### `semantic`
*   **Type**: `Object`
*   **Description**: Settings for the Semantic Analysis phase.
*   `enabled`: (Boolean) If `true`, enables AST hashing to verify if changes are effectively meaningful (ignoring whitespace/comments). Defaults to `false`.
