// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { normalizePath, type Plugin } from 'vite';
import type { OpenApiSource } from './types';
import { createConsoleLogger, createViteLoggerAdapter } from './logger';
import { syncModestaOutput } from './sync';

//////////////////////////////////////////////////////////////////////////

const httpUrlPattern = /^https?:\/\//iu;

/**
 * Default output path used by the Vite plugin when no explicit output is provided.
 */
export const defaultModestaOutputPath = 'src/generated/modesta_proxy.ts';

/**
 * Options for the modesta Vite plugin.
 */
export interface ModestaPluginOptions {
  /**
   * Local Swagger/OpenAPI file path, `file:` URL, or remote `http/https` URL.
   */
  source: OpenApiSource;
  /**
   * Destination path for the generated TypeScript file.
   * @default `src/generated/modesta_proxy.ts`
   */
  outputPath?: string | undefined;
}

/**
 * Normalized modesta plugin options.
 */
export interface ResolvedModestaPluginOptions {
  /**
   * Normalized absolute project root.
   */
  rootDirectory: string;
  /**
   * Normalized absolute local file path or remote URL string.
   */
  source: string;
  /**
   * Normalized absolute output file path.
   */
  outputPath: string;
  /**
   * Input source kind.
   */
  inputKind: 'file' | 'url';
}

/**
 * Metadata symbol used to recover `modesta()` plugin options from `vite.config.*`.
 */
export const modestaPluginOptionsSymbol = Symbol.for('modesta.plugin.options');

type ModestaPluginWithOptions = {
  [modestaPluginOptionsSymbol]: ModestaPluginOptions;
};

const isRecord = (
  value: unknown
): value is Record<string | symbol, unknown> => {
  return (
    typeof value === 'object' && value != null && Array.isArray(value) === false
  );
};

const isRemoteHttpSource = (source: OpenApiSource) => {
  return source instanceof URL
    ? source.protocol === 'http:' || source.protocol === 'https:'
    : httpUrlPattern.test(source);
};

const normalizeSourceValue = (source: OpenApiSource) => {
  if (source instanceof URL) {
    if (source.protocol === 'file:') {
      return {
        inputKind: 'file' as const,
        source: fileURLToPath(source),
      };
    }
    if (source.protocol === 'http:' || source.protocol === 'https:') {
      return {
        inputKind: 'url' as const,
        source: source.href,
      };
    }

    throw new Error(
      `modesta source URL protocol must be file, http, or https: ${source.protocol}`
    );
  }

  const normalizedSource = source.trim();
  if (normalizedSource.length === 0) {
    throw new Error('modesta source must not be empty.');
  }

  return isRemoteHttpSource(normalizedSource)
    ? {
        inputKind: 'url' as const,
        source: normalizedSource,
      }
    : {
        inputKind: 'file' as const,
        source: normalizedSource,
      };
};

const isModestaPluginOptions = (
  value: unknown
): value is ModestaPluginOptions => {
  return (
    isRecord(value) &&
    (typeof value.source === 'string' || value.source instanceof URL) &&
    (value.outputPath == null || typeof value.outputPath === 'string')
  );
};

/**
 * Resolves plugin options against a project root.
 * @param rootDirectory Project root directory.
 * @param options Raw plugin options.
 * @returns Resolved plugin options.
 */
export const resolveModestaPluginOptions = (
  rootDirectory: string,
  options: ModestaPluginOptions
): ResolvedModestaPluginOptions => {
  const normalizedRootDirectory = resolve(rootDirectory);
  const normalizedSource = normalizeSourceValue(options.source);
  const resolvedSource =
    normalizedSource.inputKind === 'url'
      ? normalizedSource.source
      : resolve(normalizedRootDirectory, normalizedSource.source);
  const resolvedOutputPath = resolve(
    normalizedRootDirectory,
    options.outputPath ?? defaultModestaOutputPath
  );

  if (
    normalizedSource.inputKind === 'file' &&
    resolvedSource === resolvedOutputPath
  ) {
    throw new Error(
      'modesta source and outputPath must not resolve to the same file.'
    );
  }

  return {
    inputKind: normalizedSource.inputKind,
    outputPath: resolvedOutputPath,
    rootDirectory: normalizedRootDirectory,
    source: resolvedSource,
  };
};

/**
 * Attaches raw modesta plugin options to a plugin instance.
 * @param plugin Plugin object.
 * @param options Raw plugin options.
 * @returns Plugin with attached modesta metadata.
 */
export const attachModestaPluginOptions = <TPlugin extends object>(
  plugin: TPlugin,
  options: ModestaPluginOptions
) => {
  Object.defineProperty(plugin, modestaPluginOptionsSymbol, {
    configurable: false,
    enumerable: false,
    value: { ...options },
    writable: false,
  });

  return plugin as TPlugin & ModestaPluginWithOptions;
};

/**
 * Reads raw modesta plugin options from a plugin instance.
 * @param plugin Candidate plugin object.
 * @returns Attached modesta options, if present.
 */
export const getModestaPluginOptions = (
  plugin: unknown
): ModestaPluginOptions | undefined => {
  if (!isRecord(plugin)) {
    return undefined;
  }

  const options = plugin[modestaPluginOptionsSymbol];
  return isModestaPluginOptions(options) ? options : undefined;
};

/**
 * Resolves any nested Vite plugin option values into a flat list of plugin objects.
 * @param pluginOptions Raw `plugins` field from a Vite config.
 * @returns Flat plugin object list.
 */
export const flattenVitePluginOptions = async (
  pluginOptions: unknown
): Promise<unknown[]> => {
  const resolvedValue = await pluginOptions;
  if (resolvedValue == null || resolvedValue === false) {
    return [];
  }

  if (Array.isArray(resolvedValue)) {
    const nested = await Promise.all(
      resolvedValue.map((entry) => flattenVitePluginOptions(entry))
    );
    return nested.flat();
  }

  return [resolvedValue];
};

/**
 * Creates a Vite plugin that generates TypeScript accessors from a Swagger/OpenAPI input.
 * Local input files are synchronized automatically. Remote URL inputs are ignored by the
 * plugin and must be synchronized explicitly through `modesta --sync`.
 * @param options Plugin options.
 * @returns Vite plugin instance.
 */
const modesta = (options: ModestaPluginOptions): Plugin => {
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

      server.watcher.add(resolvedOptions.source);
      const inputDisplayPath =
        relative(server.config.root, resolvedOptions.source) ||
        resolvedOptions.source;
      logger.debug(`Watching ${inputDisplayPath}`);
    },

    handleHotUpdate: async (context) => {
      const currentOptions = resolvedOptions;
      if (currentOptions == null || currentOptions.inputKind !== 'file') {
        return;
      }

      if (
        normalizePath(context.file) !== normalizePath(currentOptions.source)
      ) {
        return;
      }

      await runSync();
      return context.modules;
    },
  };

  return attachModestaPluginOptions(plugin, options);
};

export default modesta;
