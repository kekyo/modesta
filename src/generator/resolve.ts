// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { extname } from 'path';
import YAML from 'yaml';
import { JsonRecord } from '../types';
import {
  OpenApiContext,
  ParameterDefinition,
  RequestBodyDefinition,
  ResponseDefinition,
} from './types';
import {
  asArray,
  asRecord,
  getBoolean,
  getDirectReference,
  getRecord,
  getRequiredRecord,
  getRequiredString,
  getSingleReferenceFromAllOf,
  getString,
  isPureReference,
  isRecord,
  normalizeParameterName,
  selectSuccessStatusCode,
} from '../util';

//////////////////////////////////////////////////////////////////////////

const getSourceLocationForFormatDetection = (source: string | undefined) => {
  if (source == null) {
    return '';
  }

  try {
    return new URL(source).pathname;
  } catch {
    return source;
  }
};

export const resolveParameters = (
  context: OpenApiContext,
  parameters: unknown[] | undefined
): ParameterDefinition[] => {
  if (parameters == null) {
    return [];
  }

  return parameters.map((rawParameter) => {
    const parameter = resolveReferenceObject(
      context.document,
      asRecord(rawParameter)
    );
    if (parameter == null) {
      throw new Error('Could not resolve parameter definition.');
    }
    const location = getString(parameter, 'in');
    if (location !== 'path' && location !== 'query' && location !== 'header') {
      throw new Error(
        `Unsupported parameter location: ${location ?? '<unknown>'}`
      );
    }

    const content = getRecord(parameter, 'content');
    const schema =
      content != null
        ? resolveMediaTypeSchema(
            context.document,
            content,
            `parameter:${getString(parameter, 'name') ?? '<unknown>'}`
          ).schema
        : getRequiredRecord(parameter, 'schema', 'parameter schema');

    const name = getRequiredString(parameter, 'name', 'parameter name');
    const propertyName = normalizeParameterName(name, 'value');
    return {
      description: getString(parameter, 'description'),
      duplicatedPropertyName: undefined,
      location,
      name,
      originalPropertyName: propertyName,
      propertyName,
      required: getBoolean(parameter, 'required') ?? location === 'path',
      schema,
    } satisfies ParameterDefinition;
  });
};

export const mergeParameters = (
  left: ParameterDefinition[],
  right: ParameterDefinition[]
) => {
  const merged = new Map<string, ParameterDefinition>();

  for (const parameter of left) {
    merged.set(`${parameter.location}:${parameter.name}`, parameter);
  }
  for (const parameter of right) {
    merged.set(`${parameter.location}:${parameter.name}`, parameter);
  }

  return Array.from(merged.values());
};

export const resolveRequestBody = (
  context: OpenApiContext,
  operation: JsonRecord,
  requestBodyTypeName: string
): RequestBodyDefinition | undefined => {
  const rawRequestBody = resolveReferenceObject(
    context.document,
    getRecord(operation, 'requestBody')
  );
  if (rawRequestBody == null) {
    return undefined;
  }

  const mediaType = resolveMediaTypeSchema(
    context.document,
    getRequiredRecord(rawRequestBody, 'content', 'requestBody content'),
    `requestBody:${requestBodyTypeName}`
  );

  return {
    contentType: mediaType.mediaType,
    parameterDescription: getString(rawRequestBody, 'description'),
    required: getBoolean(rawRequestBody, 'required') ?? false,
    schema: mediaType.schema,
    schemaDescription: resolveSchemaDescription(
      context.document,
      mediaType.schema
    ),
    typeName: requestBodyTypeName,
  };
};

export const resolveResponse = (
  context: OpenApiContext,
  operation: JsonRecord,
  responseTypeName: string
): ResponseDefinition => {
  const responses = getRequiredRecord(operation, 'responses', 'responses');
  const statusCode = selectSuccessStatusCode(responses);
  const response = resolveReferenceObject(
    context.document,
    asRecord(responses[statusCode])
  );
  if (response == null) {
    throw new Error(
      `Could not resolve response for status code '${statusCode}'.`
    );
  }

  const content = getRecord(response, 'content');
  if (content == null || Object.keys(content).length === 0) {
    return {
      accept: undefined,
      description: getString(response, 'description'),
      schema: undefined,
      statusCode,
      typeName: responseTypeName,
    };
  }

  const mediaType = resolveMediaTypeSchema(
    context.document,
    content,
    `response:${statusCode}`
  );

  return {
    accept: mediaType.mediaType,
    description: getString(response, 'description'),
    schema: mediaType.schema,
    statusCode,
    typeName: responseTypeName,
  };
};

export const resolveMediaTypeSchema = (
  document: JsonRecord,
  content: JsonRecord,
  contextLabel: string
) => {
  const entries = Object.entries(content).filter(
    ([, value]) => asRecord(value) != null
  );
  if (entries.length === 0) {
    throw new Error(`Could not resolve content schema for ${contextLabel}.`);
  }

  const prioritized = [
    entries.find(([mediaType]) => mediaType === 'application/json'),
    entries.find(([mediaType]) => mediaType.endsWith('+json')),
    entries[0],
  ].find((entry) => entry != null);

  const [mediaType, mediaTypeObject] = prioritized!;
  const mediaTypeRecord = asRecord(mediaTypeObject);
  if (mediaTypeRecord == null) {
    throw new Error(`Could not resolve media type object for ${contextLabel}.`);
  }
  const schema = getRequiredRecord(
    mediaTypeRecord,
    'schema',
    `${contextLabel} schema`
  );

  return {
    mediaType,
    schema,
  };
};

export const resolveSchemaObject = (
  document: JsonRecord,
  value: JsonRecord | undefined
) => {
  const resolved = resolveReferenceObject(document, value);
  if (resolved == null) {
    throw new Error('Could not resolve schema object.');
  }
  return resolved;
};

export const resolveReferenceObject = (
  document: JsonRecord,
  value: JsonRecord | undefined
): JsonRecord | undefined => {
  if (value == null) {
    return undefined;
  }

  if (isPureReference(value) === false) {
    return value;
  }

  const reference = getRequiredString(value, '$ref', '$ref');
  if (reference.startsWith('#/') === false) {
    throw new Error(`Only local references are supported: ${reference}`);
  }

  const tokens = reference
    .slice(2)
    .split('/')
    .map((token) => token.replaceAll('~1', '/').replaceAll('~0', '~'));
  let current: unknown = document;
  for (const token of tokens) {
    if (isRecord(current) === false) {
      throw new Error(`Could not resolve reference '${reference}'.`);
    }
    current = current[token];
  }
  if (isRecord(current) === false) {
    throw new Error(`Could not resolve reference '${reference}'.`);
  }
  return current;
};

export const resolveSchemaDescription = (
  document: JsonRecord,
  schema: JsonRecord
) => {
  const directDescription = getString(schema, 'description');
  if (directDescription != null) {
    return directDescription;
  }

  const directReference = getDirectReference(schema);
  if (directReference != null) {
    return getString(
      resolveReferenceObject(document, { $ref: directReference }),
      'description'
    );
  }

  const allOfReference = getSingleReferenceFromAllOf(schema);
  if (allOfReference != null) {
    return getString(
      resolveReferenceObject(document, { $ref: allOfReference }),
      'description'
    );
  }

  return undefined;
};

export const parseOpenApiDocument = (
  text: string,
  source: string | undefined
) => {
  const extension = extname(
    getSourceLocationForFormatDetection(source)
  ).toLowerCase();
  let parsed: unknown;
  if (extension === '.yaml' || extension === '.yml') {
    parsed = YAML.parse(text);
  } else if (extension === '.json') {
    parsed = JSON.parse(text);
  } else {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = YAML.parse(text);
    }
  }

  if (isRecord(parsed) === false) {
    throw new Error('OpenAPI document must be a JSON object.');
  }

  if (
    typeof parsed.openapi !== 'string' &&
    typeof parsed.swagger !== 'string'
  ) {
    throw new Error('Input document does not look like Swagger/OpenAPI.');
  }

  return parsed;
};
