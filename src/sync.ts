// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, relative, resolve } from 'path';
import { generateAccessorSourceFromFile } from './generator';
import type { Logger } from './logger';

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
   * Local Swagger/OpenAPI file path or remote `http/https` URL.
   */
  inputPath: string;
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
   * Normalized absolute local file path or remote URL.
   */
  inputPath: string;
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

const isModestaPluginOptions = (
  value: unknown
): value is ModestaPluginOptions => {
  return (
    isRecord(value) &&
    typeof value.inputPath === 'string' &&
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
  const inputPath = options.inputPath.trim();
  if (inputPath.length === 0) {
    throw new Error('modesta inputPath must not be empty.');
  }

  const normalizedRootDirectory = resolve(rootDirectory);
  const inputKind = httpUrlPattern.test(inputPath) ? 'url' : 'file';
  const resolvedInputPath =
    inputKind === 'url'
      ? inputPath
      : resolve(normalizedRootDirectory, inputPath);
  const resolvedOutputPath = resolve(
    normalizedRootDirectory,
    options.outputPath ?? defaultModestaOutputPath
  );

  if (inputKind === 'file' && resolvedInputPath === resolvedOutputPath) {
    throw new Error(
      'modesta inputPath and outputPath must not resolve to the same file.'
    );
  }

  return {
    inputKind,
    inputPath: resolvedInputPath,
    outputPath: resolvedOutputPath,
    rootDirectory: normalizedRootDirectory,
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
 * Generates and writes the TypeScript output for the provided modesta options.
 * The output file is only rewritten when the generated content changes.
 * @param options Resolved modesta options.
 * @param logger Logger used for diagnostics.
 * @returns Synchronization result.
 */
export const syncModestaOutput = async (
  options: ResolvedModestaPluginOptions,
  logger: Logger
) => {
  const generatedSource = await generateAccessorSourceFromFile({
    inputPath: options.inputPath,
  });

  let previousSource: string | undefined;
  try {
    previousSource = await readFile(options.outputPath, 'utf8');
  } catch (error: unknown) {
    const code =
      typeof error === 'object' &&
      error != null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : undefined;
    if (code !== 'ENOENT') {
      throw error;
    }
  }

  const outputDisplayPath =
    relative(options.rootDirectory, options.outputPath) || options.outputPath;
  if (previousSource === generatedSource) {
    logger.debug(
      `Generated output is already up-to-date: ${outputDisplayPath}`
    );
    return {
      changed: false,
      generatedSource,
      outputPath: options.outputPath,
    };
  }

  await mkdir(dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, generatedSource, 'utf8');
  logger.info(`Generated ${outputDisplayPath}`);

  return {
    changed: true,
    generatedSource,
    outputPath: options.outputPath,
  };
};
