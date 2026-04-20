// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { OpenApiSource } from './types';

//////////////////////////////////////////////////////////////////////////

/**
 * Metadata symbol used to recover `modesta()` plugin options from `vite.config.*`.
 */
export const modestaPluginOptionsSymbol = Symbol.for('modesta.plugin.options');

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
   * Disables TLS certificate verification when loading a remote `https` URL.
   * This should only be enabled for local development or other controlled
   * environments.
   * @default false
   */
  insecure?: boolean | undefined;
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
  /**
   * Whether TLS certificate verification is disabled for remote `https` URLs.
   */
  insecure: boolean;
}
