// modesta - Simplest zero-dependency swagger proxy generator
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
  deprecated: boolean;
  rawName: string;
  typeName: string;
}

export interface ParameterDefinition {
  description: string | undefined;
  deprecated: boolean;
  location: 'path' | 'query' | 'header';
  duplicatedPropertyName: string | undefined;
  name: string;
  originalPropertyName: string;
  propertyName: string;
  required: boolean;
  schema: JsonRecord;
}

export interface ResponseHeaderDefinition {
  description: string | undefined;
  deprecated: boolean;
  duplicatedPropertyName: string | undefined;
  name: string;
  originalPropertyName: string;
  propertyName: string;
  required: boolean;
  schema: JsonRecord;
}

export interface RequestBodyDefinition {
  contentType: string | undefined;
  envelopeTypeName: string | undefined;
  parameterDescription: string | undefined;
  required: boolean;
  schema: JsonRecord;
  schemaDescription: string | undefined;
  typeName: string;
}

export interface ResponseDefinition {
  accept: string | undefined;
  bodyEnvelopeTypeName: string | undefined;
  description: string | undefined;
  headers: readonly ResponseHeaderDefinition[];
  headersTypeName: string | undefined;
  schema: JsonRecord | undefined;
  statusCode: string;
  typeName: string;
}

export interface OperationDefinition {
  argumentsTypeName: string;
  description: string | undefined;
  descriptorOperationName: string;
  deprecated: boolean;
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
  source: string | undefined;
  swaggerBaseUrl: string | undefined;
  title: string | undefined;
}

export interface AccessorGroupDefinition {
  factoryName: string;
  interfaceName: string;
  operations: OperationDefinition[];
}

export interface RawOperationDefinition {
  description: string | undefined;
  deprecated: boolean;
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
  formatTypeMappings: Readonly<Record<string, string>> | undefined;
  naming: NamingContext;
  warningSink: ((message: string) => void) | undefined;
}
