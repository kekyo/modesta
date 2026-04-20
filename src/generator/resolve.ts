// modesta - Simplest zero-dependency swagger proxy generator
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
  ResponseHeaderDefinition,
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
      description:
        getString(parameter, 'description') ?? getString(schema, 'description'),
      deprecated:
        getBoolean(parameter, 'deprecated') ??
        getBoolean(schema, 'deprecated') ??
        false,
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
  requestBodyTypeName: string,
  envelopeTypeName: string | undefined = undefined
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
  const schemaDescription = resolveSchemaDescription(
    context.document,
    mediaType.schema
  );

  return {
    contentType: mediaType.mediaType,
    envelopeTypeName,
    parameterDescription:
      getString(rawRequestBody, 'description') ?? schemaDescription,
    required: getBoolean(rawRequestBody, 'required') ?? false,
    schema: mediaType.schema,
    schemaDescription,
    typeName: requestBodyTypeName,
  };
};

export const resolveResponse = (
  context: OpenApiContext,
  operation: JsonRecord,
  responseTypeName: string,
  headersTypeName: string | undefined = undefined,
  bodyEnvelopeTypeName: string | undefined = undefined
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

  const headers = resolveResponseHeaders(context, response);

  const content = getRecord(response, 'content');
  if (content == null || Object.keys(content).length === 0) {
    return {
      accept: undefined,
      bodyEnvelopeTypeName,
      description: getString(response, 'description'),
      headers,
      headersTypeName,
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
    bodyEnvelopeTypeName,
    description: getString(response, 'description'),
    headers,
    headersTypeName,
    schema: mediaType.schema,
    statusCode,
    typeName: responseTypeName,
  };
};

export const resolveResponseHeaders = (
  context: OpenApiContext,
  response: JsonRecord
): readonly ResponseHeaderDefinition[] => {
  const rawHeaders = getRecord(response, 'headers');
  if (rawHeaders == null) {
    return [];
  }

  return Object.entries(rawHeaders)
    .filter(([name]) => name.toLowerCase() !== 'content-type')
    .map(([name, rawHeader]) => {
      const header = resolveReferenceObject(
        context.document,
        asRecord(rawHeader)
      );
      if (header == null) {
        throw new Error(`Could not resolve response header '${name}'.`);
      }

      const content = getRecord(header, 'content');
      const schema =
        content != null
          ? resolveMediaTypeSchema(
              context.document,
              content,
              `responseHeader:${name}`
            ).schema
          : getRequiredRecord(
              header,
              'schema',
              `response header '${name}' schema`
            );
      const propertyName = normalizeParameterName(name, 'header');
      return {
        description:
          getString(header, 'description') ?? getString(schema, 'description'),
        deprecated:
          getBoolean(header, 'deprecated') ??
          getBoolean(schema, 'deprecated') ??
          false,
        duplicatedPropertyName: undefined,
        name,
        originalPropertyName: propertyName,
        propertyName,
        required: getBoolean(header, 'required') ?? false,
        schema,
      } satisfies ResponseHeaderDefinition;
    });
};

export const isSchemaObjectLike = (
  document: JsonRecord,
  schema: JsonRecord,
  visitedReferences: Set<string> = new Set<string>()
): boolean => {
  const reference = getDirectReference(schema);
  if (reference != null) {
    if (visitedReferences.has(reference)) {
      return false;
    }
    visitedReferences.add(reference);
    const resolved = resolveReferenceObject(document, schema);
    return resolved != null
      ? isSchemaObjectLike(document, resolved, visitedReferences)
      : false;
  }

  if (
    getString(schema, 'type') === 'object' ||
    getRecord(schema, 'properties') != null ||
    schema.additionalProperties != null
  ) {
    return true;
  }

  const allOf = asArray(schema.allOf);
  if (allOf != null) {
    return allOf.some((entry) => {
      const entryRecord = asRecord(entry);
      return (
        entryRecord != null &&
        isSchemaObjectLike(document, entryRecord, visitedReferences)
      );
    });
  }

  return false;
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

export const resolveSchemaDeprecated = (
  document: JsonRecord,
  schema: JsonRecord
) => {
  const directDeprecated = getBoolean(schema, 'deprecated');
  if (directDeprecated != null) {
    return directDeprecated;
  }

  const directReference = getDirectReference(schema);
  if (directReference != null) {
    return (
      getBoolean(
        resolveReferenceObject(document, { $ref: directReference }),
        'deprecated'
      ) ?? false
    );
  }

  const allOfReference = getSingleReferenceFromAllOf(schema);
  if (allOfReference != null) {
    return (
      getBoolean(
        resolveReferenceObject(document, { $ref: allOfReference }),
        'deprecated'
      ) ?? false
    );
  }

  return false;
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
