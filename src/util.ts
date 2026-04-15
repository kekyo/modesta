// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { JsonRecord } from './types';

//////////////////////////////////////////////////////////////////////////

const reservedWords = new Set([
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

//////////////////////////////////////////////////////////////////////////

export const indent = (value: string, indentLevel: number) => {
  const padding = '  '.repeat(indentLevel);
  return value
    .split('\n')
    .map((line) => `${padding}${line}`)
    .join('\n');
};

export const isPureReference = (value: JsonRecord) => {
  return typeof value.$ref === 'string' && Object.keys(value).length === 1;
};

export const isRecord = (value: unknown): value is JsonRecord => {
  return (
    typeof value === 'object' && value != null && Array.isArray(value) === false
  );
};

export const asRecord = (value: unknown): JsonRecord | undefined => {
  return isRecord(value) ? value : undefined;
};

export const asArray = (value: unknown): unknown[] | undefined => {
  return Array.isArray(value) ? value : undefined;
};

export const getRecord = (value: JsonRecord | undefined, key: string) => {
  return asRecord(value?.[key]);
};

export const getRequiredRecord = (
  value: JsonRecord,
  key: string,
  label: string
) => {
  const record = getRecord(value, key);
  if (record == null) {
    throw new Error(`Missing ${label}.`);
  }
  return record;
};

export const getString = (value: JsonRecord | undefined, key: string) => {
  const rawValue = value?.[key];
  return typeof rawValue === 'string' ? rawValue : undefined;
};

export const getRequiredString = (
  value: JsonRecord,
  key: string,
  label: string
) => {
  const text = getString(value, key);
  if (text == null) {
    throw new Error(`Missing ${label}.`);
  }
  return text;
};

export const getBoolean = (value: JsonRecord | undefined, key: string) => {
  const rawValue = value?.[key];
  return typeof rawValue === 'boolean' ? rawValue : undefined;
};

export const getRequiredMapEntry = <TValue>(
  map: Map<string, TValue>,
  key: string,
  label: string
) => {
  const value = map.get(key);
  if (value == null) {
    throw new Error(`Missing ${label}.`);
  }
  return value;
};

export const fail = (message: string): never => {
  throw new Error(message);
};

export const renderStringLiteral = (value: string) => {
  const escaped = value.replace(
    /['\\\u0000-\u001f\u2028\u2029]/gu,
    (character) => {
      switch (character) {
        case "'":
          return "\\'";
        case '\\':
          return '\\\\';
        case '\b':
          return '\\b';
        case '\f':
          return '\\f';
        case '\n':
          return '\\n';
        case '\r':
          return '\\r';
        case '\t':
          return '\\t';
        case '\u2028':
          return '\\u2028';
        case '\u2029':
          return '\\u2029';
        default: {
          const codePoint = character.codePointAt(0);
          if (codePoint == null) {
            throw new Error('Could not read string literal code point.');
          }
          return `\\x${codePoint.toString(16).padStart(2, '0')}`;
        }
      }
    }
  );
  return `'${escaped}'`;
};

export const renderLiteral = (value: unknown) => {
  if (typeof value === 'string') {
    return renderStringLiteral(value);
  }

  const rendered = JSON.stringify(value);
  if (rendered == null) {
    throw new Error('Could not render literal value.');
  }
  return rendered;
};

export const normalizeTypeName = (value: string, fallback: string) =>
  normalizeIdentifier(value, fallback);

export const normalizeValueName = (value: string, fallback: string) =>
  normalizeIdentifier(value, fallback);

export const normalizeIdentifier = (value: string, fallback: string) => {
  const normalized = value
    .replace(/[^A-Za-z0-9_$]+/gu, '_')
    .replace(/^_+/u, '')
    .replace(/_+$/u, '')
    .replace(/_{2,}/gu, '_');

  return sanitizeIdentifier(normalized.length > 0 ? normalized : fallback);
};

export const sanitizeIdentifier = (value: string) => {
  const normalized = value
    .replace(/^[^A-Za-z_$]+/u, '_$&')
    .replace(/[^A-Za-z0-9_$]/gu, '_');
  return reservedWords.has(normalized) ? `_${normalized}` : normalized;
};

export const renderPropertyName = (name: string) => {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name) &&
    reservedWords.has(name) === false
    ? name
    : renderStringLiteral(name);
};

export const splitPathSegments = (path: string) => {
  return path
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
};

export const isPathPlaceholderSegment = (segment: string) =>
  /^\{.+\}$/u.test(segment);

export const extractPathPlaceholderName = (segment: string) => {
  const match = /^\{(.+)\}$/u.exec(segment);
  return match?.[1];
};

export const selectSuccessStatusCode = (responses: JsonRecord) => {
  const candidates = Object.keys(responses)
    .filter((statusCode) => /^2\d\d$/u.test(statusCode))
    .sort((left, right) => Number(left) - Number(right));
  if (candidates.length === 0) {
    throw new Error('No success response (2xx) was found.');
  }

  for (const preferred of ['200', '201', '202', '204']) {
    if (candidates.includes(preferred)) {
      return preferred;
    }
  }

  return candidates[0];
};

export const getDirectReference = (value: JsonRecord) => {
  return typeof value.$ref === 'string' ? value.$ref : undefined;
};

export const isReferenceWrapperSchema = (schema: JsonRecord) => {
  return (
    getDirectReference(schema) != null &&
    asArray(schema.allOf) == null &&
    asArray(schema.anyOf) == null &&
    asArray(schema.oneOf) == null &&
    asArray(schema.enum) == null &&
    getString(schema, 'type') == null &&
    getRecord(schema, 'properties') == null &&
    schema.items == null &&
    schema.additionalProperties == null &&
    getRecord(schema, 'discriminator') == null
  );
};

export const getSingleReferenceFromAllOf = (schema: JsonRecord) => {
  const allOf = asArray(schema.allOf);
  if (allOf?.length !== 1) {
    return undefined;
  }

  const entry = asRecord(allOf[0]);
  if (entry == null || isReferenceWrapperSchema(entry) === false) {
    return undefined;
  }

  return getDirectReference(entry);
};

export const isAllOfReferenceWrapperSchema = (schema: JsonRecord) => {
  return (
    getSingleReferenceFromAllOf(schema) != null &&
    asArray(schema.anyOf) == null &&
    asArray(schema.oneOf) == null &&
    getString(schema, 'type') == null &&
    getRecord(schema, 'properties') == null &&
    asArray(schema.enum) == null &&
    schema.items == null &&
    schema.additionalProperties == null &&
    getRecord(schema, 'discriminator') == null
  );
};
