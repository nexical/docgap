# Coverage Analysis

DocGap ensures your documentation is not just fresh, but *complete*. The `CoverageAnalyzer` class handles this by verifying that entities exported in your code are mentioned in your documentation.

## Algorithm Overview

Coverage analysis determines how well your documentation covers the entities (classes, functions, interfaces, etc.) exported by your source code.

## Step-by-Step Logic

### 1. Code Normalization (Repomix)
To analyze the source code, we first convert it into a structured format using the `repomix` library.

1.  **Repomix Execution**:
    We run `repomix` on the target source files with a specific configuration designed for parsing:
    *   `style: 'xml'`: Wraps file content in `<file path="...">...</file>` tags, making it easy to separate multiple files in a single output stream.
    *   `removeComments: false`: We keep comments to ensure the context of the code remains intact, although we primarily analyze signatures.
    *   `removeEmptyLines: true`: Reduces noise.

2.  **Output**:
    The result is a single XML string containing the content of all source files.

### 2. Entity Extraction
We parse the XML output to identify "significant" entities.

1.  **File Separation**:
    We use a regex to split the XML by file: `/<file path="([^"]+)">([\s\S]*?)<\/file>/g`.

2.  **Line Scanning**:
    For each file, we browse line-by-line using a robust "modifier stripper" loop.
    *   **Strip Modifiers**: We recursively remove keywords like `export`, `default`, `async`, `static`, `public`, etc., until we get to the core declaration.
    *   **Keyword Match**: We check if the line starts with definition keywords:
        *   `class`, `interface`, `type`, `enum`, `function`, `const`, `let`, `var`, etc.
    *   **Method Detection**: If no keyword matches, we look for method signatures `name(` or `name<T>(`, excluding control flow keywords (`if`, `for`, `while`).

3.  **Result**:
    This produces a list of `Entity` objects, each having a `name`, `kind` (e.g., 'class'), and `line` number.

### 3. Documentation Verification
For each identified entity, we check if it is mentioned in the documentation.

1.  **Doc Normalization**:
    The entire documentation content is converted to lowercase to perform case-insensitive matching.

2.  **Entity Matching**:
    For each entity `name`:
    *   We create a Regular Expression: `/\b{name}\b/i`.
    *   `\b`: Enforces word boundaries. `MyClass` matches "MyClass" but not "MyClassHelper".
    *   `i`: Case insensitive.

3.  **Classification**:
    *   **Present**: The regex finds a match in the doc.
    *   **Missing**: No match is found.

### 4. Scoring
A coverage score is calculated for each file.

$$ Score = \frac{Count_{Present}}{Count_{Present} + Count_{Missing}} $$

*   **1.0 (100%)**: All entities are mentioned.
*   **0.0 (0%)**: No entities are mentioned.
*   **Results**: The system outputs a `CoverageReport` containing the lists of missing and present entities, allowing users to see exactly what to document.

## Internal Helpers

The analyzer implementation in `packages/core/src/coverage/analyzer.ts` uses several helper functions:

- `runRepomix`: Executes the repomix tool with the specific XML configuration.
- `parseRepomixOutput`: Handles the extraction of file content from the raw XML string.
- `methodRegex`: The specific regex pattern used to detect method signatures.
- `escapeRegExp`: Utility to safely create regex patterns from entity names.

