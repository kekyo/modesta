// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { request as httpRequest, type IncomingMessage } from 'http';
import { request as httpsRequest } from 'https';
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
const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);
const maxRedirectCount = 10;

const getSourceDisplay = (source: OpenApiSource) => {
  return source instanceof URL ? source.href : source;
};

const isRemoteHttpSource = (source: OpenApiSource) => {
  return source instanceof URL
    ? source.protocol === 'http:' || source.protocol === 'https:'
    : httpUrlPattern.test(source);
};

const readIncomingMessageText = async (response: IncomingMessage) => {
  return await new Promise<string>((resolve, reject) => {
    let text = '';
    response.setEncoding('utf8');
    response.on('data', (chunk: string) => {
      text += chunk;
    });
    response.once('end', () => {
      resolve(text);
    });
    response.once('error', reject);
  });
};

const getRedirectLocation = (response: IncomingMessage) => {
  const { location } = response.headers;
  return Array.isArray(location) ? location[0] : location;
};

const loadRemoteTextWithRequest = async (
  sourceUrl: URL,
  insecure: boolean,
  redirectCount: number
): Promise<{ sourceUrl: string; text: string }> => {
  return await new Promise((resolve, reject) => {
    const request =
      sourceUrl.protocol === 'https:'
        ? httpsRequest(sourceUrl, {
            method: 'GET',
            rejectUnauthorized: insecure === false,
          })
        : httpRequest(sourceUrl, {
            method: 'GET',
          });

    request.once('response', (response) => {
      void (async () => {
        const statusCode = response.statusCode ?? 0;
        const redirectLocation = getRedirectLocation(response);

        if (
          redirectStatusCodes.has(statusCode) &&
          redirectLocation != null &&
          redirectCount < maxRedirectCount
        ) {
          response.resume();
          resolve(
            await loadRemoteTextWithRequest(
              new URL(redirectLocation, sourceUrl),
              insecure,
              redirectCount + 1
            )
          );
          return;
        }

        if (redirectStatusCodes.has(statusCode) && redirectLocation != null) {
          response.resume();
          throw new Error(
            'Too many redirects while fetching OpenAPI document.'
          );
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          throw new Error(
            `Could not fetch OpenAPI document: ${statusCode} ${response.statusMessage ?? ''}`.trim()
          );
        }

        const text = await readIncomingMessageText(response);
        resolve({
          sourceUrl: sourceUrl.href,
          text,
        });
      })().catch(reject);
    });

    request.once('error', reject);
    request.end();
  });
};

const loadRemoteText = async (
  source: OpenApiSource,
  insecure: boolean
): Promise<{ sourceUrl: string; text: string }> => {
  if (insecure) {
    const sourceUrl =
      source instanceof URL ? source : new URL(getSourceDisplay(source));
    return await loadRemoteTextWithRequest(sourceUrl, insecure, 0);
  }

  const response = await fetch(source);
  if (response.ok === false) {
    throw new Error(
      `Could not fetch OpenAPI document: ${response.status} ${response.statusText}`
    );
  }

  return {
    sourceUrl: response.url || getSourceDisplay(source),
    text: await response.text(),
  };
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
    const remote = await loadRemoteText(
      options.source,
      options.insecure === true
    );
    return parseOpenApiDocument(remote.text, remote.sourceUrl || sourceDisplay);
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
    warningSink: options.warningSink,
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

  const context = createOpenApiContext(document, options.warningSink);
  const api = buildApiDefinition(context, source);

  return renderApiDefinition(api, context);
};
