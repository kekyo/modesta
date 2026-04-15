// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { relative } from 'path';
import { normalizePath, type Plugin } from 'vite';
import { createConsoleLogger, createViteLoggerAdapter } from './logger';
import {
  attachModestaPluginOptions,
  resolveModestaPluginOptions,
  syncModestaOutput,
  type ResolvedModestaPluginOptions,
  type ModestaPluginOptions,
} from './sync';

//////////////////////////////////////////////////////////////////////////

/**
 * Creates a Vite plugin that generates TypeScript accessors from a Swagger/OpenAPI input.
 * Local input files are synchronized automatically. Remote URL inputs are ignored by the
 * plugin and must be synchronized explicitly through `modesta --sync`.
 * @param options Plugin options.
 * @returns Vite plugin instance.
 */
export const modesta = (options: ModestaPluginOptions): Plugin => {
  let logger = createConsoleLogger('modesta');
  let resolvedOptions: ResolvedModestaPluginOptions | undefined;
  let isSyncing = false;
  let needsResync = false;

  const runSync = async () => {
    const currentOptions = resolvedOptions;
    if (currentOptions == null || currentOptions.inputKind !== 'file') {
      return;
    }

    if (isSyncing) {
      needsResync = true;
      return;
    }

    isSyncing = true;
    try {
      do {
        needsResync = false;
        await syncModestaOutput(currentOptions, logger);
      } while (needsResync);
    } finally {
      isSyncing = false;
    }
  };

  const plugin: Plugin = {
    name: 'modesta',

    configResolved: async (config) => {
      const viteLogger = config.customLogger ?? config.logger;
      if (viteLogger != null) {
        logger = createViteLoggerAdapter(
          viteLogger,
          config.logLevel ?? 'info',
          'modesta'
        );
      }

      resolvedOptions = resolveModestaPluginOptions(config.root, options);
      if (resolvedOptions.inputKind === 'url') {
        const outputDisplayPath =
          relative(config.root, resolvedOptions.outputPath) ||
          resolvedOptions.outputPath;
        logger.info(
          `Remote Swagger input is not synchronized automatically. Run \`modesta --sync\` to update ${outputDisplayPath}.`
        );
        return;
      }

      await runSync();
    },

    configureServer: (server) => {
      const viteLogger = server.config.logger;
      if (viteLogger != null) {
        logger = createViteLoggerAdapter(
          viteLogger,
          server.config.logLevel ?? 'info',
          'modesta'
        );
      }

      if (resolvedOptions?.inputKind !== 'file') {
        return;
      }

      server.watcher.add(resolvedOptions.inputPath);
      const inputDisplayPath =
        relative(server.config.root, resolvedOptions.inputPath) ||
        resolvedOptions.inputPath;
      logger.debug(`Watching ${inputDisplayPath}`);
    },

    handleHotUpdate: async (context) => {
      const currentOptions = resolvedOptions;
      if (currentOptions == null || currentOptions.inputKind !== 'file') {
        return;
      }

      if (
        normalizePath(context.file) !== normalizePath(currentOptions.inputPath)
      ) {
        return;
      }

      await runSync();
      return context.modules;
    },
  };

  return attachModestaPluginOptions(plugin, options);
};

export type { ModestaPluginOptions } from './sync';
