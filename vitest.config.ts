
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            exclude: [
                '**/coverage/**',
                '**/dist/**',
                '**/node_modules/**',
                '**/*.d.ts',
                '**/*.test.ts',
                '**/*.spec.ts',
                'vitest.workspace.ts',
            ],
        },
        exclude: [
            '**/coverage/**',
            '**/dist/**',
            '**/node_modules/**'
        ],
    },
});
