// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { JsonRecord } from '../types';

//////////////////////////////////////////////////////////////////////////

export interface NamingContext {
  usedFactoryNames: Set<string>;
  usedTypeNames: Set<string>;
  schemaTypeNames: Map<string, string>;
}

export interface SchemaDefinition {
  description: string | undefined;
  rawName: string;
  typeName: string;
}

export interface ParameterDefinition {
  description: string | undefined;
  location: 'path' | 'query' | 'header';
  name: string;
  propertyName: string;
  required: boolean;
  schema: JsonRecord;
}

export interface RequestBodyDefinition {
  contentType: string | undefined;
  parameterDescription: string | undefined;
  required: boolean;
  schema: JsonRecord;
  schemaDescription: string | undefined;
  typeName: string;
}

export interface ResponseDefinition {
  accept: string | undefined;
  description: string | undefined;
  schema: JsonRecord | undefined;
  statusCode: string;
  typeName: string;
}

export interface OperationDefinition {
  argumentsTypeName: string;
  description: string | undefined;
  descriptorOperationName: string;
  groupName: string;
  headerParametersTypeName: string | undefined;
  headerParameters: ParameterDefinition[];
  method: string;
  memberName: string;
  namingSource: string;
  path: string;
  pathParametersTypeName: string | undefined;
  pathParameters: ParameterDefinition[];
  queryParametersTypeName: string | undefined;
  queryParameters: ParameterDefinition[];
  requestBody: RequestBodyDefinition | undefined;
  response: ResponseDefinition;
  summary: string | undefined;
}

export interface ApiDefinition {
  accessorGroups: AccessorGroupDefinition[];
  schemaDefinitions: SchemaDefinition[];
  sourcePath: string | undefined;
  title: string | undefined;
}

export interface AccessorGroupDefinition {
  factoryName: string;
  interfaceName: string;
  operations: OperationDefinition[];
}

export interface RawOperationDefinition {
  description: string | undefined;
  headerParameters: ParameterDefinition[];
  method: string;
  operationId: string | undefined;
  path: string;
  pathParameters: ParameterDefinition[];
  queryParameters: ParameterDefinition[];
  rawOperation: JsonRecord;
  summary: string | undefined;
}

export interface OperationNamingDraft {
  groupKey: string;
  groupName: string | undefined;
  memberName: string;
  namingSource: string;
  pathGroupSegments: string[] | undefined;
  rawOperation: RawOperationDefinition;
}

export interface OpenApiContext {
  componentSchemas: JsonRecord;
  document: JsonRecord;
  naming: NamingContext;
}
