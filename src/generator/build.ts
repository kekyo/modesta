// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import {
  FormatTypeMappings,
  GenerateAccessorWarningSink,
  JsonRecord,
} from '../types';
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
  warningSink: GenerateAccessorWarningSink | undefined = undefined,
  formatTypeMappings: FormatTypeMappings | undefined = undefined
): OpenApiContext => {
  const components = getRecord(document, 'components') ?? {};
  const componentSchemas = getRecord(components, 'schemas') ?? {};
  const naming = createNamingContext(componentSchemas);

  return {
    componentSchemas,
    document,
    formatTypeMappings,
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
    swaggerBaseUrl: resolveSwaggerBaseUrl(context),
    title,
  };
};

const resolveSwaggerServerUrlVariables = (
  context: OpenApiContext,
  server: JsonRecord,
  url: string
) => {
  const variables = getRecord(server, 'variables') ?? {};
  let couldResolveAllVariables = true;
  const resolvedUrl = url.replace(/\{([^{}]+)\}/gu, (placeholder, name) => {
    const variable = getRecord(variables, name);
    const defaultValue = getString(variable, 'default');
    if (defaultValue == null) {
      couldResolveAllVariables = false;
      context.warningSink?.(
        `OpenAPI server URL variable '${name}' does not have a string default value. The server URL was ignored.`
      );
      return placeholder;
    }
    return defaultValue;
  });

  return couldResolveAllVariables ? resolvedUrl : undefined;
};

const resolveSwaggerBaseUrl = (context: OpenApiContext) => {
  const servers = asArray(context.document.servers);
  if (servers == null || servers.length === 0) {
    return undefined;
  }

  const server = asRecord(servers[0]);
  const url = getString(server, 'url');
  if (server == null || url == null || url.length === 0) {
    context.warningSink?.(
      'OpenAPI document-level servers[0].url is not a string. The server URL was ignored.'
    );
    return undefined;
  }

  return resolveSwaggerServerUrlVariables(context, server, url);
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
