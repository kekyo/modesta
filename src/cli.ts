#!/usr/bin/env node
// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { mkdir, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { parseArgs } from 'util';
import {
  generateAccessorSource,
  generateAccessorSourceFromFile,
} from './generator';
import { createConsoleLogger } from './logger';
import {
  flattenVitePluginOptions,
  getModestaPluginOptions,
  resolveModestaPluginOptions,
} from './vite-util';
import {
  author,
  description,
  git_commit_hash,
  license,
  repository_url,
  version,
} from './generated/packageMetadata';
import { syncModestaOutput } from './sync';

//////////////////////////////////////////////////////////////////////////

const usage = [
  `modesta [${version}-${git_commit_hash}]`,
  description,
  author,
  `License: Under ${license}.`,
  repository_url,
  '',
  'Usage: modesta [--sync]',
  '       modesta [--insecure] [<swagger.json|swagger.yaml|https://...>] [<generated.ts>]',
  '',
  'Options:',
  '  --insecure    Disable TLS certificate verification for remote https inputs.',
  '  --sync    Read modesta Vite options from vite.config.* and synchronize once.',
  '  --help    Show this help.',
].join('\n');

const httpUrlPattern = /^https?:\/\//iu;

//////////////////////////////////////////////////////////////////////////

const readTextFromStdin = async () => {
  process.stdin.setEncoding('utf8');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
};

const syncFromViteConfig = async () => {
  const logger = createConsoleLogger('modesta');
  const { loadConfigFromFile } = await import('vite');
  const loaded = await loadConfigFromFile(
    {
      command: 'serve',
      mode: 'development',
      isPreview: false,
      isSsrBuild: false,
    },
    undefined,
    process.cwd(),
    'silent'
  );
  if (loaded == null) {
    throw new Error('Could not find vite.config.* in the current directory.');
  }

  const plugins = await flattenVitePluginOptions(loaded.config.plugins);
  const modestaPlugins = plugins
    .map((plugin) => getModestaPluginOptions(plugin))
    .filter(
      (pluginOptions): pluginOptions is NonNullable<typeof pluginOptions> =>
        pluginOptions != null
    );

  if (modestaPlugins.length === 0) {
    throw new Error('Could not find modesta() in vite.config.*.');
  }
  if (modestaPlugins.length > 1) {
    throw new Error(
      'Multiple modesta() plugin definitions were found in vite.config.*.'
    );
  }

  const resolvedRootDirectory =
    typeof loaded.config.root === 'string'
      ? resolve(process.cwd(), loaded.config.root)
      : process.cwd();
  const resolvedOptions = resolveModestaPluginOptions(
    resolvedRootDirectory,
    modestaPlugins[0]
  );
  await syncModestaOutput(resolvedOptions, logger);
};

//////////////////////////////////////////////////////////////////////////

const main = async () => {
  const logger = createConsoleLogger('modesta');
  const parsed = parseArgs({
    options: {
      help: {
        type: 'boolean',
      },
      insecure: {
        type: 'boolean',
      },
      sync: {
        type: 'boolean',
      },
    },
    allowPositionals: true,
  });

  if (parsed.values.help && parsed.values.sync !== true) {
    process.stdout.write(`${usage}\n`);
    return;
  }

  const insecure = parsed.values.insecure === true;

  if (parsed.values.sync) {
    if (parsed.values.help || insecure || parsed.positionals.length > 0) {
      throw new Error(
        `--sync does not accept any additional options or positional arguments.\n\n${usage}`
      );
    }

    await syncFromViteConfig();
    return;
  }

  if (parsed.positionals.length > 2) {
    throw new Error(`Too many positional arguments.\n\n${usage}`);
  }

  const [inputPath, outputPath] = parsed.positionals;
  const generated =
    inputPath != null
      ? await generateAccessorSourceFromFile({
          insecure,
          source: httpUrlPattern.test(inputPath)
            ? inputPath
            : resolve(process.cwd(), inputPath),
          warningSink: logger.warn,
        })
      : generateAccessorSource({
          document: await readTextFromStdin(),
          warningSink: logger.warn,
        });

  if (outputPath == null) {
    process.stdout.write(generated);
    return;
  }

  const resolvedOutputPath = resolve(process.cwd(), outputPath);
  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, generated, 'utf8');
};

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
