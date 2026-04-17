// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { GenerateAccessorWarningSink, JsonRecord } from '../types';
import { asArray, asRecord, getBoolean, getRecord, getString } from '../util';
import {
  ApiDefinition,
  OpenApiContext,
  RawOperationDefinition,
  SchemaDefinition,
} from './types';
import { buildAccessorGroups, createNamingContext } from './naming';
import { mergeParameters, resolveParameters } from './resolve';

//////////////////////////////////////////////////////////////////////////

export const createOpenApiContext = (
  document: JsonRecord,
  warningSink: GenerateAccessorWarningSink | undefined = undefined
): OpenApiContext => {
  const components = getRecord(document, 'components') ?? {};
  const componentSchemas = getRecord(components, 'schemas') ?? {};
  const naming = createNamingContext(componentSchemas);

  return {
    componentSchemas,
    document,
    naming,
    warningSink,
  };
};

export const buildApiDefinition = (
  context: OpenApiContext,
  source: string | undefined
): ApiDefinition => {
  const info = getRecord(context.document, 'info');
  const title = getString(info, 'title');

  const schemaDefinitions = Array.from(
    context.naming.schemaTypeNames.entries()
  ).map(
    ([rawName, typeName]) =>
      ({
        description: getString(
          asRecord(context.componentSchemas[rawName]),
          'description'
        ),
        deprecated:
          getBoolean(
            asRecord(context.componentSchemas[rawName]),
            'deprecated'
          ) ?? false,
        rawName,
        typeName,
      }) satisfies SchemaDefinition
  );

  const accessorGroups = buildAccessorGroups(
    context,
    collectRawOperations(context)
  );

  return {
    accessorGroups,
    schemaDefinitions,
    source,
    title,
  };
};

const collectRawOperations = (
  context: OpenApiContext
): RawOperationDefinition[] => {
  const paths = getRecord(context.document, 'paths') ?? {};
  const operations: RawOperationDefinition[] = [];

  for (const path of Object.keys(paths).sort()) {
    const pathItem = asRecord(paths[path]);
    if (pathItem == null) {
      continue;
    }

    const sharedParameters = resolveParameters(
      context,
      asArray(pathItem.parameters)
    );

    for (const method of [
      'get',
      'post',
      'put',
      'delete',
      'patch',
      'head',
      'options',
    ] as const) {
      const rawOperation = asRecord(pathItem[method]);
      if (rawOperation == null) {
        continue;
      }

      const mergedParameters = mergeParameters(
        sharedParameters,
        resolveParameters(context, asArray(rawOperation.parameters))
      );

      operations.push({
        description: getString(rawOperation, 'description'),
        deprecated: getBoolean(rawOperation, 'deprecated') ?? false,
        headerParameters: mergedParameters.filter(
          (parameter) => parameter.location === 'header'
        ),
        method: method.toUpperCase(),
        operationId: getString(rawOperation, 'operationId'),
        path,
        pathParameters: mergedParameters.filter(
          (parameter) => parameter.location === 'path'
        ),
        queryParameters: mergedParameters.filter(
          (parameter) => parameter.location === 'query'
        ),
        rawOperation,
        summary: getString(rawOperation, 'summary'),
      } satisfies RawOperationDefinition);
    }
  }

  return operations;
};
