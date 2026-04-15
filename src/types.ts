// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

/**
 * Generic JSON object shape used for parsed OpenAPI documents and schemas.
 */
export type JsonRecord = Record<string, unknown>;

/**
 * Options for loading an OpenAPI document from a file path or URL and generating
 * TypeScript accessor source code.
 */
export interface GenerateAccessorSourceFromFileOptions {
  /**
   * File path or `http/https` URL for the input Swagger/OpenAPI document.
   * JSON and YAML documents are both supported.
   */
  inputPath: string;
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
  sourcePath?: string | undefined;
}
