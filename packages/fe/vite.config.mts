/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// Matches modules from the given node_modules packages (a regex alternation of package names).
const nodeModules = (packages: string) =>
  new RegExp(`[\\\\/]node_modules[\\\\/](${packages})[\\\\/]`);

export default defineConfig(({ mode }) => {
  // Load VITE_* envs from .env files and process.env
  const env = loadEnv(mode, process.cwd());

  // Base path for the app
  const base = env.VITE_BASE_PATH;
  return {
    base,
    root: fileURLToPath(new URL('.', import.meta.url)),
    resolve: {
      alias: {
        '@edanalytics/common-ui': fileURLToPath(
          new URL('../common-ui/src/index.ts', import.meta.url),
        ),
        '@edanalytics/models': fileURLToPath(new URL('../models/src/index.ts', import.meta.url)),
        '@edanalytics/models-server': fileURLToPath(
          new URL('../models-server/src/index.ts', import.meta.url),
        ),
        '@edanalytics/utils': fileURLToPath(new URL('../utils/src/index.ts', import.meta.url)),
      },
    },
    build: {
      outDir: '../../dist/packages/fe',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rolldownOptions: {
        output: {
          // Split third-party code into a few cacheable chunks so no chunk exceeds Vite's
          // 500 kB warning limit. Pages keep their existing lazy loading: openpgp and url-join
          // stay out of `vendor` so they still load only with the secret page.
          codeSplitting: {
            groups: [
              { name: 'react', test: nodeModules('react|react-dom|scheduler'), priority: 50 },
              {
                name: 'chakra',
                test: nodeModules(
                  '@chakra-ui|@emotion|@popperjs|focus-lock|react-focus-lock|react-remove-scroll[^\\\\/]*|@zag-js',
                ),
                priority: 40,
              },
              // Higher priority than `chakra`, which would otherwise pull these in as its dependencies.
              {
                name: 'motion',
                test: nodeModules('framer-motion|motion-dom|motion-utils'),
                priority: 45,
              },
              {
                name: 'router',
                test: nodeModules('react-router|react-router-dom|@remix-run'),
                priority: 40,
              },
              { name: 'tanstack', test: nodeModules('@tanstack'), priority: 40 },
              {
                name: 'vendor',
                test: (id) =>
                  /[\\/]node_modules[\\/]/.test(id) && !nodeModules('openpgp|url-join').test(id),
                priority: 10,
              },
            ],
          },
        },
      },
    },
    cacheDir: '../../node_modules/.vite/fe',

    server: {
      port: 4200,
      host: true,
      fs: {
        // Allow serving files from the app dir and repo root
        allow: [
          fileURLToPath(new URL('.', import.meta.url)),
          '../../',
          '../../node_modules/@fontsource',
        ],
      },
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'deny',
        //Content Security Policy cannot be set locally, but should be in production
      },
    },

    preview: {
      port: 4300,
      host: 'localhost',
    },

    plugins: [react(), visualizer()],

    // Uncomment this if you are using workers.
    // worker: {
    //  plugins: [
    //    viteTsConfigPaths({
    //      root: '../../',
    //    }),
    //  ],
    // },
  };
});
