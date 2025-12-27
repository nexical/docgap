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
npx doc-drift
```

### CI

Add `doc-drift` to your CI pipeline:

```yaml
steps:
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0 # Important: Required for deep Git history analysis
  - uses: your-org/doc-drift-action@v1
```

## How It Works: Finding "Rot"

Documentation **Rot** (or Drift) is the silent killer of developer productivity. It happens when code evolves but the docs remain static.

`doc-drift` identifies this rot through a sophisticated two-phase process:

1.  **Temporal Analysis**: It scans your Git history to find the last time your documentation was touched versus the last time the source code it references was modified.
2.  **Semantic Filtering**: It doesn't just look at timestamps. It filters out "noise" commits (like `chore:`, `style:`) and uses AST hashing to determine if the *logic* of the code effectively changed.

If the code has moved forward but the docs are stuck in the past, `doc-drift` flags it as **DRIFT** and hinders the build (or warns based on config), prompting you to update the documentation or verify that the changes were indeed trivial.
