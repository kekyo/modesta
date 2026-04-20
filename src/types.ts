// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

//////////////////////////////////////////////////////////////////////////

/**
 * Generic JSON object shape used for parsed OpenAPI documents and schemas.
 */
export type JsonRecord = Record<string, unknown>;

/**
 * Source reference for an OpenAPI document.
 * Accepts a local file path string, a `file:` URL, or an `http/https` URL.
 */
export type OpenApiSource = string | URL;

/**
 * Callback used to receive non-fatal generation warnings.
 */
export type GenerateAccessorWarningSink = (message: string) => void;

/**
 * Options for loading an OpenAPI document from a file path or URL and generating
 * TypeScript accessor source code.
 */
export interface GenerateAccessorSourceFromFileOptions {
  /**
   * File path, `file:` URL, or `http/https` URL for the input Swagger/OpenAPI
   * document.
   * JSON and YAML documents are both supported.
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
   * Callback invoked for non-fatal generation warnings such as renamed
   * argument members.
   */
  warningSink?: GenerateAccessorWarningSink | undefined;
}

/**
 * Options for generating TypeScript accessor source code from an
 * OpenAPI document value.
 */
export interface GenerateAccessorSourceOptions {
  /**
   * OpenAPI document object or raw document text.
   * When a string is provided, the generator parses it as JSON or YAML.
   */
  document: string | JsonRecord;
  /**
   * Original source path or URL for the document.
   * Used to improve format detection when `document` is a string and to
   * include source metadata in generated output comments.
   */
  source?: OpenApiSource | undefined;
  /**
   * Callback invoked for non-fatal generation warnings such as renamed
   * argument members.
   */
  warningSink?: GenerateAccessorWarningSink | undefined;
}
