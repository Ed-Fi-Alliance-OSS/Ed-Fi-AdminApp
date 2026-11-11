const { join } = require('path');
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');

// Bundles the TypeORM data source used by the migrations:* and schema:drop targets
// (dist/packages/migration/main.js). Must be run through `nx run api:build-migration-config`
// (not webpack-cli directly): NxAppWebpackPlugin reads the project from NX_TASK_TARGET_*.
module.exports = {
  output: {
    path: join(__dirname, '../../dist/packages/migration'),
    // NxAppWebpackPlugin only sets the deprecated output.libraryTarget, after webpack has
    // already normalized the config, so declare the CommonJS library type here.
    library: { type: 'commonjs' },
    // Remove stale files (e.g. a development main.js.map) from earlier builds.
    clean: true,
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: join(__dirname, 'src/database/migrations.datasource.ts'),
      tsConfig: join(__dirname, 'tsconfig.app.json'),
      outputPath: join(__dirname, '../../dist/packages/migration'),
      optimization: false,
      outputHashing: 'none',
    }),
  ],
};
