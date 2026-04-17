// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { fileURLToPath } from 'url';
import { resolve } from 'path';

import { OpenApiSource } from './types';
import {
  defaultModestaOutputPath,
  ModestaPluginOptions,
  modestaPluginOptionsSymbol,
  ResolvedModestaPluginOptions,
} from './internal';

//////////////////////////////////////////////////////////////////////////

const httpUrlPattern = /^https?:\/\//iu;

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
    insecure: options.insecure === true,
    outputPath: resolvedOutputPath,
    rootDirectory: normalizedRootDirectory,
    source: resolvedSource,
  };
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
    (typeof value.source === 'string' || value.source instanceof URL) &&
    (value.insecure == null || typeof value.insecure === 'boolean') &&
    (value.outputPath == null || typeof value.outputPath === 'string')
  );
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
