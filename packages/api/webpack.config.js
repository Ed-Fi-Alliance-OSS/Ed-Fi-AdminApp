const { join } = require('path');
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');

// Builds the API bundle (dist/packages/api/main.js). Run it through `nx run api:build`,
// which sets NX_TASK_TARGET_CONFIGURATION (production by default, or development).
const isProduction = (process.env.NX_TASK_TARGET_CONFIGURATION || 'production') === 'production';

module.exports = {
  output: {
    path: join(__dirname, '../../dist/packages/api'),
    // NxAppWebpackPlugin only sets the deprecated output.libraryTarget, after webpack has
    // already normalized the config, so declare the CommonJS library type here.
    library: { type: 'commonjs' },
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: join(__dirname, 'src/main.ts'),
      tsConfig: join(__dirname, 'tsconfig.app.json'),
      outputPath: join(__dirname, '../../dist/packages/api'),
      // Keep the output the removed @nx/webpack:webpack executor produced:
      // a readable, unhashed main.js.
      optimization: false,
      outputHashing: 'none',
      // Generates the Swagger metadata for DTOs and entities.
      transformers: [
        {
          name: '@nestjs/swagger/plugin',
          options: {
            dtoFileNameSuffix: ['.entity.ts', '.dto.ts'],
            introspectComments: true,
          },
        },
      ],
      assets: ['./src/assets'],
      fileReplacements: isProduction
        ? [
            {
              replace: join(__dirname, 'src/modes/dev.ts'),
              with: join(__dirname, 'src/modes/prod.ts'),
            },
          ]
        : [],
    }),
  ],
};
