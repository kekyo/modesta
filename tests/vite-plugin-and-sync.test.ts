// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { createServer } from 'http';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { describe, expect, it, vi } from 'vitest';
import type { Logger as ViteLogger } from 'vite';
import { modesta } from '../src/vite';
import { runCommandAllowFailure, saveArtifactText } from './support/harness';

const createSwaggerDocument = (title: string) => {
  return JSON.stringify(
    {
      openapi: '3.0.1',
      info: {
        title,
      },
      paths: {
        '/ping': {
          get: {
            operationId: 'Ping',
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      properties: {
                        message: {
                          type: 'string',
                        },
                      },
                      required: ['message'],
                      type: 'object',
                    },
                  },
                },
                description: 'OK',
              },
            },
          },
        },
      },
    },
    null,
    2
  );
};

const createCapturingLogger = () => {
  const entries: string[] = [];
  const logger: ViteLogger = {
    clearScreen: () => {},
    error: (message: string) => {
      entries.push(`error:${message}`);
    },
    hasErrorLogged: () => false,
    hasWarned: false,
    info: (message: string) => {
      entries.push(`info:${message}`);
    },
    warn: (message: string) => {
      entries.push(`warn:${message}`);
    },
    warnOnce: (message: string) => {
      entries.push(`warn:${message}`);
    },
  };

  return {
    entries,
    logger,
  };
};

const createPluginConfig = (rootDirectory: string, logger: ViteLogger) => {
  return {
    customLogger: logger,
    logLevel: 'info',
    logger,
    root: rootDirectory,
  } as const;
};

const writeSyncConfig = async (rootDirectory: string, body: string) => {
  const vitePluginUrl = pathToFileURL(
    resolve(process.cwd(), 'dist/vite.mjs')
  ).href;
  await writeFile(
    join(rootDirectory, 'vite.config.mjs'),
    body.replaceAll('__MODESTA_VITE_URL__', vitePluginUrl),
    'utf8'
  );
};

describe('Vite plugin and sync CLI', () => {
  it('updates generated output for local Swagger input changes and ignores output self-triggers', async () => {
    const workingDirectory = await mkdtemp(
      join(tmpdir(), 'modesta-vite-local-')
    );
    try {
      const inputPath = join(workingDirectory, 'swagger.json');
      const outputPath = join(workingDirectory, 'src/generated/api.ts');
      await mkdir(join(workingDirectory, 'src/generated'), { recursive: true });
      await writeFile(inputPath, createSwaggerDocument('Local Alpha'), 'utf8');

      const plugin = modesta({
        inputPath: './swagger.json',
        outputPath: './src/generated/api.ts',
      });
      const { entries, logger } = createCapturingLogger();
      const config = createPluginConfig(workingDirectory, logger);
      const watcherAdd = vi.fn();
      const configResolved = plugin.configResolved;
      const configureServer = plugin.configureServer;
      const handleHotUpdate = plugin.handleHotUpdate;
      const pluginContext = {} as any;

      if (typeof configResolved === 'function') {
        await configResolved.call(pluginContext, config as any);
      }
      if (typeof configureServer === 'function') {
        configureServer.call(pluginContext, {
          config,
          watcher: {
            add: watcherAdd,
          },
        } as any);
      }

      const initialOutput = await readFile(outputPath, 'utf8');
      expect(initialOutput).toContain('// Source title: Local Alpha');
      expect(watcherAdd).toHaveBeenCalledWith(inputPath);

      await writeFile(inputPath, createSwaggerDocument('Local Beta'), 'utf8');
      if (typeof handleHotUpdate === 'function') {
        await handleHotUpdate.call(pluginContext, {
          file: inputPath,
          modules: [],
          server: {
            config,
            watcher: {
              add: watcherAdd,
            },
          },
        } as any);
      }

      const updatedOutput = await readFile(outputPath, 'utf8');
      expect(updatedOutput).toContain('// Source title: Local Beta');

      const logCountBeforeOutputTrigger = entries.length;
      await writeFile(outputPath, '// mutated by test\n', 'utf8');
      const outputStatsBefore = await stat(outputPath);

      if (typeof handleHotUpdate === 'function') {
        await handleHotUpdate.call(pluginContext, {
          file: outputPath,
          modules: [],
          server: {
            config,
            watcher: {
              add: watcherAdd,
            },
          },
        } as any);
      }

      const outputStatsAfter = await stat(outputPath);
      const outputAfterSelfTrigger = await readFile(outputPath, 'utf8');
      expect(outputAfterSelfTrigger).toBe('// mutated by test\n');
      expect(outputStatsAfter.mtimeMs).toBe(outputStatsBefore.mtimeMs);
      expect(entries.length).toBe(logCountBeforeOutputTrigger);
    } finally {
      await rm(workingDirectory, { force: true, recursive: true });
    }
  });

  it('does nothing automatically when the plugin input is a remote URL', async () => {
    const workingDirectory = await mkdtemp(
      join(tmpdir(), 'modesta-vite-remote-')
    );
    try {
      const plugin = modesta({
        inputPath: 'https://example.invalid/swagger/v1/swagger.json',
      });
      const { logger } = createCapturingLogger();
      const config = createPluginConfig(workingDirectory, logger);
      const watcherAdd = vi.fn();
      const configResolved = plugin.configResolved;
      const configureServer = plugin.configureServer;
      const pluginContext = {} as any;

      if (typeof configResolved === 'function') {
        await configResolved.call(pluginContext, config as any);
      }
      if (typeof configureServer === 'function') {
        configureServer.call(pluginContext, {
          config,
          watcher: {
            add: watcherAdd,
          },
        } as any);
      }

      await expect(
        stat(join(workingDirectory, 'src/generated/modesta_proxy.ts'))
      ).rejects.toThrow();
      expect(watcherAdd).not.toHaveBeenCalled();
    } finally {
      await rm(workingDirectory, { force: true, recursive: true });
    }
  });

  it('synchronizes a remote Swagger URL from vite.config.* with --sync and uses the default output path', async () => {
    const swaggerJson = createSwaggerDocument('Synced Remote');
    const workingDirectory = await mkdtemp(join(tmpdir(), 'modesta-sync-url-'));
    const server = createServer((request, response) => {
      if (request.url !== '/swagger.json') {
        response.statusCode = 404;
        response.end();
        return;
      }

      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
      });
      response.end(swaggerJson);
    });

    await new Promise<void>((resolveListen, rejectListen) => {
      server.once('error', rejectListen);
      server.listen(0, '127.0.0.1', () => resolveListen());
    });

    const address = server.address();
    if (address == null || typeof address === 'string') {
      await new Promise<void>((resolveClose) =>
        server.close(() => resolveClose())
      );
      throw new Error('Could not determine HTTP server address.');
    }

    const inputUrl = `http://127.0.0.1:${address.port}/swagger.json`;
    try {
      await writeSyncConfig(
        workingDirectory,
        [
          'import { modesta } from "__MODESTA_VITE_URL__";',
          '',
          'export default {',
          '  plugins: [',
          `    modesta({ inputPath: ${JSON.stringify(inputUrl)} }),`,
          '  ],',
          '};',
          '',
        ].join('\n')
      );

      const result = await runCommandAllowFailure(
        'node',
        [resolve(process.cwd(), 'dist/cli.mjs'), '--sync'],
        workingDirectory
      );
      const outputPath = join(
        workingDirectory,
        'src/generated/modesta_proxy.ts'
      );
      const generatedSource = await readFile(outputPath, 'utf8');

      await saveArtifactText(
        'vite-plugin-and-sync',
        'generated/sync-url-output.ts',
        generatedSource
      );

      expect(result.exitCode).toBe(0);
      expect(generatedSource).toContain('// Source title: Synced Remote');
      expect(generatedSource).toContain(`// Source file: ${inputUrl}`);
    } finally {
      await new Promise<void>((resolveClose) =>
        server.close(() => resolveClose())
      );
      await rm(workingDirectory, { force: true, recursive: true });
    }
  });

  it('fails with exit code 1 when --sync cannot find modesta() in vite.config.*', async () => {
    const workingDirectory = await mkdtemp(
      join(tmpdir(), 'modesta-sync-missing-')
    );
    try {
      await writeSyncConfig(
        workingDirectory,
        [
          'const foobar = () => ({ name: "foobar" });',
          '',
          'export default {',
          '  plugins: [foobar()],',
          '};',
          '',
        ].join('\n')
      );

      const result = await runCommandAllowFailure(
        'node',
        [resolve(process.cwd(), 'dist/cli.mjs'), '--sync'],
        workingDirectory
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        'Could not find modesta() in vite.config.*.'
      );
    } finally {
      await rm(workingDirectory, { force: true, recursive: true });
    }
  });

  it('fails with exit code 1 when vite.config.* contains multiple modesta() plugins', async () => {
    const workingDirectory = await mkdtemp(
      join(tmpdir(), 'modesta-sync-multi-')
    );
    try {
      await writeSyncConfig(
        workingDirectory,
        [
          'import { modesta } from "__MODESTA_VITE_URL__";',
          '',
          'export default {',
          '  plugins: [',
          '    modesta({ inputPath: "./swagger-a.json" }),',
          '    modesta({ inputPath: "./swagger-b.json" }),',
          '  ],',
          '};',
          '',
        ].join('\n')
      );

      const result = await runCommandAllowFailure(
        'node',
        [resolve(process.cwd(), 'dist/cli.mjs'), '--sync'],
        workingDirectory
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        'Multiple modesta() plugin definitions were found in vite.config.*.'
      );
    } finally {
      await rm(workingDirectory, { force: true, recursive: true });
    }
  });

  it('fails with exit code 1 when --sync is combined with additional arguments', async () => {
    const workingDirectory = await mkdtemp(
      join(tmpdir(), 'modesta-sync-args-')
    );
    try {
      const result = await runCommandAllowFailure(
        'node',
        [resolve(process.cwd(), 'dist/cli.mjs'), '--sync', 'swagger.json'],
        workingDirectory
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        '--sync does not accept any additional options or positional arguments.'
      );
    } finally {
      await rm(workingDirectory, { force: true, recursive: true });
    }
  });

  it('fails with exit code 1 when a remote sync request cannot fetch the Swagger document', async () => {
    const workingDirectory = await mkdtemp(
      join(tmpdir(), 'modesta-sync-fail-')
    );
    const server = createServer((_request, response) => {
      response.statusCode = 500;
      response.end('broken');
    });

    await new Promise<void>((resolveListen, rejectListen) => {
      server.once('error', rejectListen);
      server.listen(0, '127.0.0.1', () => resolveListen());
    });

    const address = server.address();
    if (address == null || typeof address === 'string') {
      await new Promise<void>((resolveClose) =>
        server.close(() => resolveClose())
      );
      throw new Error('Could not determine HTTP server address.');
    }

    try {
      await writeSyncConfig(
        workingDirectory,
        [
          'import { modesta } from "__MODESTA_VITE_URL__";',
          '',
          'export default {',
          '  plugins: [',
          `    modesta({ inputPath: ${JSON.stringify(`http://127.0.0.1:${address.port}/swagger.json`)} }),`,
          '  ],',
          '};',
          '',
        ].join('\n')
      );

      const result = await runCommandAllowFailure(
        'node',
        [resolve(process.cwd(), 'dist/cli.mjs'), '--sync'],
        workingDirectory
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Could not fetch OpenAPI document: 500');
    } finally {
      await new Promise<void>((resolveClose) =>
        server.close(() => resolveClose())
      );
      await rm(workingDirectory, { force: true, recursive: true });
    }
  });
});
