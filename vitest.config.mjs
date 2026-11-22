// Vitest: unit tests for the engine and learning code (tests/*.test.js). `npm test` runs them once.
// The exercise library imports app/data/exercises.csv as a string (next.config.mjs does that with csvRawLoader.cjs);
// the plugin below does the same here.
import { defineConfig } from 'vitest/config';

const csvAsString = {
  name: 'csv-as-string',
  transform(code, id) {
    if (id.endsWith('.csv')) return { code: `export default ${JSON.stringify(code)};`, map: null };
    return null;
  }
};

export default defineConfig({
  plugins: [csvAsString],
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node'
  }
});
