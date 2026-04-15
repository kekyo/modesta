// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { JsonRecord } from '../types';
import {
  extractPathPlaceholderName,
  getRecord,
  getRequiredMapEntry,
  isPathPlaceholderSegment,
  normalizeTypeName,
  normalizeValueName,
  splitPathSegments,
} from '../util';
import {
  AccessorGroupDefinition,
  NamingContext,
  OpenApiContext,
  OperationDefinition,
  OperationNamingDraft,
  RawOperationDefinition,
} from './types';
import { resolveRequestBody, resolveResponse } from './resolve';

//////////////////////////////////////////////////////////////////////////

export const createNamingContext = (
  componentSchemas: JsonRecord
): NamingContext => {
  const usedTypeNames = new Set<string>();
  const schemaTypeNames = new Map<string, string>();

  for (const rawName of Object.keys(componentSchemas).sort()) {
    const typeName = registerTypeName(
      usedTypeNames,
      normalizeTypeName(rawName, 'Generated'),
      `schema '${rawName}'`
    );
    schemaTypeNames.set(rawName, typeName);
  }

  return {
    usedFactoryNames: new Set<string>(),
    usedTypeNames,
    schemaTypeNames,
  };
};

export const buildAccessorGroups = (
  context: OpenApiContext,
  rawOperations: RawOperationDefinition[]
): AccessorGroupDefinition[] => {
  const namingDrafts = rawOperations.map((rawOperation) =>
    createOperationNamingDraft(rawOperation)
  );
  const pathGroupNames = resolvePathGroupNames(
    namingDrafts.filter((draft) => draft.pathGroupSegments != null)
  );

  const groupNameByKey = new Map<string, string>();
  const groupKeyByName = new Map<string, string>();

  for (const draft of namingDrafts) {
    const groupName =
      draft.groupName ??
      getRequiredMapEntry(
        pathGroupNames,
        draft.groupKey,
        `group name for ${draft.namingSource}`
      );
    const existingGroupKey = groupKeyByName.get(groupName);
    if (existingGroupKey != null && existingGroupKey !== draft.groupKey) {
      throw new Error(
        `Generated group name '${groupName}' is ambiguous between ${draft.namingSource} and ${existingGroupKey}.`
      );
    }

    groupNameByKey.set(draft.groupKey, groupName);
    groupKeyByName.set(groupName, draft.groupKey);
  }

  const factoryNameByGroup = new Map<string, string>();
  for (const groupName of Array.from(groupKeyByName.keys()).sort()) {
    registerTypeName(
      context.naming.usedTypeNames,
      groupName,
      `accessor interface '${groupName}'`
    );
    const factoryName = registerValueName(
      context.naming.usedFactoryNames,
      normalizeValueName(`create_${groupName}_accessor`, 'create_accessor'),
      `factory for accessor '${groupName}'`
    );
    factoryNameByGroup.set(groupName, factoryName);
  }

  const memberByGroup = new Map<string, Map<string, string>>();
  const operationsByGroup = new Map<string, OperationDefinition[]>();

  for (const draft of namingDrafts) {
    const groupName = getRequiredMapEntry(
      groupNameByKey,
      draft.groupKey,
      `accessor group for ${draft.namingSource}`
    );
    const groupMembers =
      memberByGroup.get(groupName) ?? new Map<string, string>();
    const existingMemberSource = groupMembers.get(draft.memberName);
    if (existingMemberSource != null) {
      throw new Error(
        `Generated method name '${draft.memberName}' in accessor '${groupName}' is ambiguous between ${existingMemberSource} and ${draft.namingSource}.`
      );
    }
    groupMembers.set(draft.memberName, draft.namingSource);
    memberByGroup.set(groupName, groupMembers);

    const typeNamePrefix = normalizeTypeName(
      `${groupName}_${draft.memberName}`,
      'generated_operation'
    );
    const pathParametersTypeName =
      draft.rawOperation.pathParameters.length > 0
        ? registerTypeName(
            context.naming.usedTypeNames,
            `${typeNamePrefix}_path_parameters`,
            `path parameters type for ${groupName}.${draft.memberName}`
          )
        : undefined;
    const queryParametersTypeName =
      draft.rawOperation.queryParameters.length > 0
        ? registerTypeName(
            context.naming.usedTypeNames,
            `${typeNamePrefix}_query_parameters`,
            `query parameters type for ${groupName}.${draft.memberName}`
          )
        : undefined;
    const headerParametersTypeName =
      draft.rawOperation.headerParameters.length > 0
        ? registerTypeName(
            context.naming.usedTypeNames,
            `${typeNamePrefix}_header_parameters`,
            `header parameters type for ${groupName}.${draft.memberName}`
          )
        : undefined;
    const requestBodyTypeName =
      getRecord(draft.rawOperation.rawOperation, 'requestBody') != null
        ? registerTypeName(
            context.naming.usedTypeNames,
            `${typeNamePrefix}_request_body`,
            `request body type for ${groupName}.${draft.memberName}`
          )
        : undefined;
    const argumentsTypeName = registerTypeName(
      context.naming.usedTypeNames,
      `${typeNamePrefix}_arguments`,
      `arguments type for ${groupName}.${draft.memberName}`
    );
    const responseTypeName = registerTypeName(
      context.naming.usedTypeNames,
      `${typeNamePrefix}_response`,
      `response type for ${groupName}.${draft.memberName}`
    );

    const operation: OperationDefinition = {
      argumentsTypeName,
      description: draft.rawOperation.description,
      descriptorOperationName: `${groupName}.${draft.memberName}`,
      groupName,
      headerParameters: draft.rawOperation.headerParameters,
      headerParametersTypeName,
      method: draft.rawOperation.method,
      memberName: draft.memberName,
      namingSource: draft.namingSource,
      path: draft.rawOperation.path,
      pathParameters: draft.rawOperation.pathParameters,
      pathParametersTypeName,
      queryParameters: draft.rawOperation.queryParameters,
      queryParametersTypeName,
      requestBody:
        requestBodyTypeName != null
          ? resolveRequestBody(
              context,
              draft.rawOperation.rawOperation,
              requestBodyTypeName
            )
          : undefined,
      response: resolveResponse(
        context,
        draft.rawOperation.rawOperation,
        responseTypeName
      ),
      summary: draft.rawOperation.summary,
    };
    validateOperationArgumentMembers(operation);

    const groupOperations = operationsByGroup.get(groupName) ?? [];
    groupOperations.push(operation);
    operationsByGroup.set(groupName, groupOperations);
  }

  return Array.from(operationsByGroup.entries())
    .sort(([leftGroupName], [rightGroupName]) =>
      leftGroupName.localeCompare(rightGroupName)
    )
    .map(
      ([groupName, operations]) =>
        ({
          factoryName: getRequiredMapEntry(
            factoryNameByGroup,
            groupName,
            `factory for accessor '${groupName}'`
          ),
          interfaceName: groupName,
          operations: operations.sort((left, right) =>
            left.memberName.localeCompare(right.memberName)
          ),
        }) satisfies AccessorGroupDefinition
    );
};

const validateOperationArgumentMembers = (operation: OperationDefinition) => {
  const memberSourceByName = new Map<string, string>();
  const registerMember = (name: string, source: string) => {
    const existingSource = memberSourceByName.get(name);
    if (existingSource != null) {
      throw new Error(
        `Generated argument member '${name}' in accessor '${operation.groupName}' method '${operation.memberName}' is ambiguous between ${existingSource} and ${source}.`
      );
    }

    memberSourceByName.set(name, source);
  };

  for (const parameter of operation.pathParameters) {
    registerMember(
      parameter.propertyName,
      `path parameter '${parameter.name}' for ${operation.descriptorOperationName}`
    );
  }
  if (operation.queryParameters.length > 0) {
    registerMember(
      'queryParameters',
      `query parameter group for ${operation.descriptorOperationName}`
    );
  }
  if (operation.headerParameters.length > 0) {
    registerMember(
      'headerParameters',
      `header parameter group for ${operation.descriptorOperationName}`
    );
  }
  if (operation.requestBody != null) {
    registerMember(
      'body',
      `request body for ${operation.descriptorOperationName}`
    );
  }
};

const createOperationNamingDraft = (
  rawOperation: RawOperationDefinition
): OperationNamingDraft => {
  if (rawOperation.operationId != null) {
    return {
      groupKey: `operationId:${rawOperation.operationId}`,
      groupName: normalizeTypeName(
        rawOperation.operationId,
        'generated_accessor'
      ),
      memberName: normalizeValueName(
        rawOperation.method.toLowerCase(),
        'operation'
      ),
      namingSource: `operationId '${rawOperation.operationId}'`,
      pathGroupSegments: undefined,
      rawOperation,
    };
  }

  return createPathOperationNamingDraft(rawOperation);
};

const createPathOperationNamingDraft = (
  rawOperation: RawOperationDefinition
): OperationNamingDraft => {
  const pathSegments = splitPathSegments(rawOperation.path);
  if (pathSegments.length === 0) {
    return {
      groupKey: 'path:/',
      groupName: undefined,
      memberName: normalizeValueName(
        rawOperation.method.toLowerCase(),
        'operation'
      ),
      namingSource: `${rawOperation.method} ${rawOperation.path}`,
      pathGroupSegments: [],
      rawOperation,
    };
  }

  const literalSegments = pathSegments.filter(
    (segment) => isPathPlaceholderSegment(segment) === false
  );
  if (literalSegments.length === 0) {
    throw new Error(
      `Path '${rawOperation.path}' requires operationId because it does not contain any literal segment.`
    );
  }

  const groupSegments =
    literalSegments.length === 1
      ? [literalSegments[0]]
      : literalSegments.slice(0, -1);
  const groupBoundary = findGroupBoundaryIndex(pathSegments, groupSegments);
  const remainderSegments = pathSegments.slice(groupBoundary);
  const memberName = buildPathDerivedMemberName(
    rawOperation.method.toLowerCase(),
    remainderSegments
  );

  return {
    groupKey: `path:${groupSegments.join('/')}`,
    groupName: undefined,
    memberName,
    namingSource: `${rawOperation.method} ${rawOperation.path}`,
    pathGroupSegments: groupSegments,
    rawOperation,
  };
};

const resolvePathGroupNames = (drafts: OperationNamingDraft[]) => {
  const uniqueGroupSegments = new Map<string, string[]>();
  for (const draft of drafts) {
    const pathGroupSegments = draft.pathGroupSegments;
    if (pathGroupSegments == null) {
      continue;
    }

    uniqueGroupSegments.set(draft.groupKey, pathGroupSegments);
  }

  const entries = Array.from(uniqueGroupSegments.entries());
  const groupNameByKey = new Map<string, string>();

  for (const [groupKey, groupSegments] of entries) {
    if (groupSegments.length === 0) {
      groupNameByKey.set(groupKey, 'root');
      continue;
    }

    let resolvedGroupName: string | undefined;
    for (
      let suffixLength = 1;
      suffixLength <= groupSegments.length;
      suffixLength += 1
    ) {
      const candidateName = normalizeTypeName(
        groupSegments.slice(-suffixLength).join('_'),
        'root'
      );
      const collides = entries.some(
        ([otherGroupKey, otherGroupSegments]) =>
          otherGroupKey !== groupKey &&
          normalizeTypeName(
            otherGroupSegments
              .slice(-Math.min(suffixLength, otherGroupSegments.length))
              .join('_'),
            'root'
          ) === candidateName
      );
      if (collides === false) {
        resolvedGroupName = candidateName;
        break;
      }
    }

    if (resolvedGroupName == null) {
      throw new Error(
        `Could not derive a unique accessor interface name from path group '${groupSegments.join('/')}'. Please define operationId or change the path.`
      );
    }

    groupNameByKey.set(groupKey, resolvedGroupName);
  }

  return groupNameByKey;
};

const findGroupBoundaryIndex = (
  pathSegments: string[],
  groupSegments: string[]
) => {
  if (groupSegments.length === 0) {
    return 0;
  }

  let matchedLiteralCount = 0;
  for (let index = 0; index < pathSegments.length; index += 1) {
    const segment = pathSegments[index];
    if (isPathPlaceholderSegment(segment)) {
      continue;
    }

    if (segment !== groupSegments[matchedLiteralCount]) {
      throw new Error(
        'Internal error while resolving path-derived accessor grouping.'
      );
    }

    matchedLiteralCount += 1;
    if (matchedLiteralCount === groupSegments.length) {
      return index + 1;
    }
  }

  throw new Error(
    'Internal error while determining the path-derived accessor boundary.'
  );
};

const buildPathDerivedMemberName = (
  methodName: string,
  remainderSegments: string[]
) => {
  if (remainderSegments.length === 0) {
    return normalizeValueName(methodName, 'operation');
  }

  const tokens = [methodName];
  for (const segment of remainderSegments) {
    const placeholderName = extractPathPlaceholderName(segment);
    if (placeholderName != null) {
      tokens.push(`by_${normalizeValueName(placeholderName, 'value')}`);
      continue;
    }

    tokens.push(segment);
  }

  return normalizeValueName(tokens.join('_'), 'operation');
};

const registerTypeName = (
  usedTypeNames: Set<string>,
  preferredName: string,
  contextLabel: string
) => {
  if (usedTypeNames.has(preferredName)) {
    throw new Error(
      `Generated type name '${preferredName}' is ambiguous for ${contextLabel}.`
    );
  }

  usedTypeNames.add(preferredName);
  return preferredName;
};

const registerValueName = (
  usedValueNames: Set<string>,
  preferredName: string,
  contextLabel: string
) => {
  if (usedValueNames.has(preferredName)) {
    throw new Error(
      `Generated value name '${preferredName}' is ambiguous for ${contextLabel}.`
    );
  }

  usedValueNames.add(preferredName);
  return preferredName;
};
