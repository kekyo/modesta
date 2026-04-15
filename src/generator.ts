// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { readFile } from 'fs/promises';
import type {
  GenerateAccessorSourceFromFileOptions,
  GenerateAccessorSourceOptions,
  OpenApiSource,
} from './types';
import { buildApiDefinition, createOpenApiContext } from './generator/build';
import { parseOpenApiDocument } from './generator/resolve';
import { renderApiDefinition } from './generator/render';

//////////////////////////////////////////////////////////////////////////

const httpUrlPattern = /^https?:\/\//iu;

const getSourceDisplay = (source: OpenApiSource) => {
  return source instanceof URL ? source.href : source;
};

const isRemoteHttpSource = (source: OpenApiSource) => {
  return source instanceof URL
    ? source.protocol === 'http:' || source.protocol === 'https:'
    : httpUrlPattern.test(source);
};

/**
 * Loads and parses an OpenAPI document from a file path or URL.
 * @param options Options that specify which OpenAPI document source to read.
 * @returns Parsed OpenAPI document object.
 */
export const loadOpenApiDocumentFromFile = async (
  options: GenerateAccessorSourceFromFileOptions
) => {
  const sourceDisplay = getSourceDisplay(options.source);

  if (isRemoteHttpSource(options.source)) {
    const response = await fetch(options.source);
    if (response.ok === false) {
      throw new Error(
        `Could not fetch OpenAPI document: ${response.status} ${response.statusText}`
      );
    }

    const text = await response.text();
    return parseOpenApiDocument(text, response.url || sourceDisplay);
  }

  const text = await readFile(options.source, 'utf8');
  return parseOpenApiDocument(text, sourceDisplay);
};

/**
 * Loads an OpenAPI document from a file path or URL and generates
 * TypeScript accessor source code from it.
 * @param options Options that specify the input source and generation hints.
 * @returns Generated TypeScript source code.
 */
export const generateAccessorSourceFromFile = async (
  options: GenerateAccessorSourceFromFileOptions
) => {
  const document = await loadOpenApiDocumentFromFile(options);
  return generateAccessorSource({
    document,
    source: options.source,
  });
};

/**
 * Generates TypeScript accessor source code from an OpenAPI document.
 * @param options Options that provide the OpenAPI document and source
 * metadata used during generation.
 * @returns Generated TypeScript source code.
 * @remarks When `options.document` is a string, it is parsed as JSON or YAML
 * before code generation starts.
 */
export const generateAccessorSource = (
  options: GenerateAccessorSourceOptions
) => {
  const source =
    options.source != null ? getSourceDisplay(options.source) : undefined;
  const document =
    typeof options.document === 'string'
      ? parseOpenApiDocument(options.document, source)
      : options.document;

  const context = createOpenApiContext(document);
  const api = buildApiDefinition(context, source);

  return renderApiDefinition(api, context);
};
