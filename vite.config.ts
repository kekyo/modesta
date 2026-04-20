// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import dts from 'unplugin-dts/vite';
import screwUp from 'screw-up';
import prettierMax from 'prettier-max';

export default defineConfig({
  plugins: [
    prettierMax(),
    dts({
      insertTypesEntry: true,
      tsconfigPath: resolve(
        fileURLToPath(new URL('.', import.meta.url)),
        'tsconfig.build.json'
      ),
    }),
    screwUp({
      outputMetadataFile: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'src/index.ts'
        ),
        vite: resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'src/vite/index.ts'
        ),
        cli: resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'src/cli.ts'
        ),
      },
      fileName: (format, entryName) =>
        `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    rolldownOptions: {
      external: [
        'fs/promises',
        'fs',
        'http',
        'https',
        'path',
        'url',
        'vite',
        'util',
        'child_process',
        'event',
        'net',
        'os',
        'typescript',
        'yaml',
      ],
    },
    target: 'es2022',
    sourcemap: true,
    minify: false,
  },
});
