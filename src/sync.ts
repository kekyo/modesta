// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, relative } from 'path';

import { generateAccessorSourceFromFile } from './generator';
import { ResolvedModestaPluginOptions } from './internal';
import { Logger } from './logger';

//////////////////////////////////////////////////////////////////////////

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
    formatTypeMappings: options.formatTypeMappings,
    insecure: options.insecure,
    source: options.source,
    warningSink: logger.warn,
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
