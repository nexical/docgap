
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 100,
                functions: 100,
                branches: 100,
                statements: 100,
            },
            include: ['src/**/*.ts'],
            exclude: ['src/types.ts', 'src/**/types.ts', '**/coverage/**'],
        },
        exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.git/**'],
    },
});
