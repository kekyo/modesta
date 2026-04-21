// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  getTypeScriptDiagnostics,
  transpileGeneratedSource,
} from '../../support/harness';
import {
  expectMemberDocumentation,
  expectMethodDocumentation,
  getInterfaceBlock,
  getInterfaceDocumentation,
} from '../../support/source-assertions';
import { fetchOpenApiFromPlatformServer } from '../support/platform-harness';

describe('Huma platform integration', () => {
  let openApiDocument: Record<string, any> = {};
  let generatedSource = '';
  let generatedModule: Record<string, any>;
  let normalizedSource = '';
  const warnings: string[] = [];
  const getWarnings = (accessorName: string) =>
    warnings.filter((message) =>
      message.includes(`accessor '${accessorName}'`)
    );
  const schemaUriMetadata = {
    properties: {
      $schema: {
        format: 'uri',
      },
    },
  };

  beforeAll(async () => {
    const result = await fetchOpenApiFromPlatformServer({
      artifactName: 'platform-huma',
      containerPort: 8888,
      fixtureDirectory: 'tests/platforms/huma/fixture',
      generatedArtifactPath: 'generated/huma.ts',
      openApiArtifactPath: 'openapi/openapi-3.0.json',
      openApiPath: '/openapi-3.0.json',
      platformName: 'huma',
      warningSink: (message) => warnings.push(message),
    });

    openApiDocument = JSON.parse(result.openApiDocument) as Record<string, any>;
    generatedSource = result.generatedSource;
    normalizedSource = generatedSource.replace(/\s+/gu, ' ');
    generatedModule = await transpileGeneratedSource(generatedSource);
  });

  it('loads a Huma-generated OpenAPI 3.0 document from Podman', () => {
    expect(openApiDocument.openapi).toBe('3.0.3');
    expect(openApiDocument.info.title).toBe('Modesta Huma Fixture');
    expect(openApiDocument.paths['/route/{id}'].get.operationId).toBe(
      'GetRouteValue'
    );
  });

  it('keeps Huma default error schemas without blocking generation', () => {
    expect(openApiDocument.components.schemas.ErrorModel).toBeDefined();
    expect(generatedSource).toContain('export interface ErrorModel {');
    expect(generatedSource).toContain('export interface ErrorDetail {');
  });

  it('flattens route parameter definitions into argument groups', () => {
    const block = getInterfaceBlock(
      generatedSource,
      'GetRouteValue_get_arguments'
    );
    expect(block).toContain('readonly id: string;');
  });

  it('flattens query parameters and normalizes unsafe characters', () => {
    const block = getInterfaceBlock(generatedSource, 'GetPage_get_arguments');
    expect(block).toContain('readonly pageSize?: number;');
  });

  it('flattens header parameters and normalizes unsafe characters', () => {
    const block = getInterfaceBlock(
      generatedSource,
      'GetHeaderValue_get_arguments'
    );
    expect(block).toContain('readonly xApiKey: string;');
  });

  it('uses the shared body type directly when no flattened parameters are present', () => {
    const block = getInterfaceBlock(generatedSource, 'CreateItem');
    expect(block).toContain(
      'readonly post: (args: CreateItemRequest, options?: AccessorOptions | undefined) => Promise<SimpleRecord>;'
    );
  });

  it('uses an intersection type when flattened parameters and a body coexist', () => {
    const block = getInterfaceBlock(generatedSource, 'CreateCombinedItem');
    expect(block).toContain(
      'readonly post: (args: CreateItemRequest & CreateCombinedItem_post_arguments, options?: AccessorOptions | undefined) => Promise<SimpleRecord>;'
    );
  });

  it('uses shared schema types directly for object response definitions', () => {
    const block = getInterfaceBlock(generatedSource, 'GetRouteValue');
    expect(block).toContain('Promise<SimpleRecord>');
    expect(generatedSource).not.toContain('GetRouteValue_get_response');
  });

  it('uses array return type definitions for Huma slices', () => {
    const block = getInterfaceBlock(generatedSource, 'ListItems');
    expect(block).toContain('Promise<ReadonlyArray<SimpleRecord>>');
  });

  it('separates dictionary return type definitions for Huma maps', () => {
    const responseBlock = getInterfaceBlock(
      generatedSource,
      'MapItems_get_response'
    );
    expect(responseBlock).toContain('readonly [key: string]: SimpleRecord;');
  });

  it('uses void directly for Huma 204 responses', () => {
    const block = getInterfaceBlock(generatedSource, 'DeleteItem');
    expect(block).toContain('Promise<void>');
  });

  it('omits args from no-argument accessor signatures', () => {
    const block = getInterfaceBlock(generatedSource, 'ListItems');
    expect(block).toContain(
      'readonly get: (options?: AccessorOptions | undefined) => Promise<ReadonlyArray<SimpleRecord>>;'
    );
  });

  it('uses primitive request bodies directly when no flattened parameters are present', () => {
    const block = getInterfaceBlock(generatedSource, 'CreateText');
    expect(block).toContain(
      'readonly post: (args: string, options?: AccessorOptions | undefined) => Promise<void>;'
    );
  });

  it('wraps primitive request bodies in an envelope while intersecting flattened parameters', () => {
    const envelopeBlock = getInterfaceBlock(
      generatedSource,
      'CreateScopedText_post_request_envelope'
    );
    const accessorBlock = getInterfaceBlock(
      generatedSource,
      'CreateScopedText'
    );
    expect(envelopeBlock).toContain('readonly body: string;');
    expect(accessorBlock).toContain(
      'CreateScopedText_post_request_envelope & CreateScopedText_post_arguments'
    );
  });

  it('uses array request bodies directly when no flattened parameters are present', () => {
    const block = getInterfaceBlock(generatedSource, 'CreateNumberList');
    expect(block).toContain(
      'readonly post: (args: ReadonlyArray<number>, options?: AccessorOptions | undefined) => Promise<void>;'
    );
  });

  it('wraps array request bodies in an envelope while intersecting flattened parameters', () => {
    const envelopeBlock = getInterfaceBlock(
      generatedSource,
      'UpdateNumbers_put_request_envelope'
    );
    const accessorBlock = getInterfaceBlock(generatedSource, 'UpdateNumbers');
    expect(envelopeBlock).toContain('readonly body: ReadonlyArray<number>;');
    expect(accessorBlock).toContain(
      'UpdateNumbers_put_request_envelope & UpdateNumbers_put_arguments'
    );
  });

  it('returns projected response headers when the response body is absent', async () => {
    const block = getInterfaceBlock(
      generatedSource,
      'GetToken_get_response_headers'
    );
    expect(block).toContain('/** Request identifier. */');
    expect(block).toContain('readonly xRequestId?: string;');

    const sender = generatedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(async () => ({
        headers: {
          get: (name: string) => (name === 'x-request-id' ? 'req-42' : null),
        },
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '',
      })),
    });
    const accessor = generatedModule.create_GetToken_accessor(sender);

    await expect(accessor.get()).resolves.toEqual({
      xRequestId: 'req-42',
    });
  });

  it('merges object response bodies with projected response headers', () => {
    const block = getInterfaceBlock(generatedSource, 'GetDocument');
    expect(block).toContain(
      'Promise<DocumentResponse & GetDocument_get_response_headers>'
    );
  });

  it('returns primitive response bodies directly when response headers are absent', () => {
    const block = getInterfaceBlock(generatedSource, 'GetPlainMessage');
    expect(block).toContain('Promise<string>');
    expect(generatedSource).not.toContain('GetPlainMessage_get_response_body');
  });

  it('wraps primitive response bodies when response headers are also projected', () => {
    const bodyBlock = getInterfaceBlock(
      generatedSource,
      'GetMessage_get_response_body'
    );
    const accessorBlock = getInterfaceBlock(generatedSource, 'GetMessage');
    expect(bodyBlock).toContain('readonly body: string;');
    expect(accessorBlock).toContain(
      'Promise<GetMessage_get_response_body & GetMessage_get_response_headers>'
    );
  });

  it('returns array response bodies directly when response headers are absent', () => {
    const block = getInterfaceBlock(generatedSource, 'GetNumbers');
    expect(block).toContain('Promise<ReadonlyArray<number>>');
    expect(generatedSource).not.toContain('GetNumbers_get_response_body');
  });

  it('wraps array response bodies when response headers are also projected', () => {
    const bodyBlock = getInterfaceBlock(
      generatedSource,
      'GetNumberMessage_get_response_body'
    );
    const accessorBlock = getInterfaceBlock(
      generatedSource,
      'GetNumberMessage'
    );
    expect(bodyBlock).toContain('readonly body: ReadonlyArray<number>;');
    expect(accessorBlock).toContain(
      'Promise<GetNumberMessage_get_response_body & GetNumberMessage_get_response_headers>'
    );
  });

  it('renames duplicated parameter-only names and emits warnings', () => {
    const block = getInterfaceBlock(
      generatedSource,
      'GetDuplicateParameters_get_arguments'
    );
    expect(block).toContain('readonly path_id: string;');
    expect(block).toContain('readonly query_id?: string;');
    expect(block).toContain('readonly header_id?: string;');
    expect(getWarnings('GetDuplicateParameters')).toHaveLength(3);
  });

  it('renames normalized parameter collisions from Huma query and header names', () => {
    const block = getInterfaceBlock(
      generatedSource,
      'GetNormalizedCollision_get_arguments'
    );
    expect(block).toContain('readonly query_xApiKey?: string;');
    expect(block).toContain('readonly header_xApiKey?: string;');
    expect(getWarnings('GetNormalizedCollision')).toHaveLength(2);
  });

  it('does not rename parameters when normalization keeps their names distinct', () => {
    const block = getInterfaceBlock(
      generatedSource,
      'GetNormalizedDistinct_get_arguments'
    );
    expect(block).toContain('readonly user_id: string;');
    expect(block).toContain('readonly userId?: string;');
    expect(block).toContain('readonly tenantId?: string;');
    expect(getWarnings('GetNormalizedDistinct')).toHaveLength(0);
  });

  it('renames duplicated flattened parameter names while keeping the request body shared', () => {
    const block = getInterfaceBlock(
      generatedSource,
      'CreateCollisionItem_post_arguments'
    );
    expect(block).toContain('readonly id: string;');
    expect(block).toContain('readonly query_xApiKey?: string;');
    expect(block).toContain('readonly header_xApiKey?: string;');
    expect(getWarnings('CreateCollisionItem')).toHaveLength(2);
  });

  it('retains underscores in normalized Huma path parameter names', () => {
    const block = getInterfaceBlock(generatedSource, 'GetUser_get_arguments');
    expect(block).toContain('readonly user_id: string;');
  });

  it('renames duplicated response field names and emits warnings for response headers', () => {
    const block = getInterfaceBlock(
      generatedSource,
      'GetResponseCollision_get_response_headers'
    );
    expect(block).toContain('readonly header_etag?: string;');
    expect(block).toContain('readonly header_xApiKey?: string;');
    expect(block).toContain('readonly header_xApiKey_2?: string;');
    expect(getWarnings('GetResponseCollision')).toHaveLength(3);
  });

  it('builds sender descriptors for route parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_GetRouteValue_accessor(sender);
    const signal = new AbortController().signal;

    await accessor.get({ id: '42' }, { signal });

    expect(sender).toHaveBeenCalledWith(
      {
        body: undefined,
        headers: {
          accept: 'application/json',
        },
        method: 'GET',
        operationName: 'GetRouteValue.get',
        responseBodyMetadata: schemaUriMetadata,
        responseContentType: 'application/json',
        responseHeaders: [],
        url: '/route/42',
        wrapResponseBody: false,
      },
      { signal }
    );
  });

  it('builds sender descriptors for query parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_GetPage_accessor(sender);

    await accessor.get({ pageSize: 20 });

    expect(sender).toHaveBeenCalledWith(
      {
        body: undefined,
        headers: {
          accept: 'application/json',
        },
        method: 'GET',
        operationName: 'GetPage.get',
        responseBodyMetadata: schemaUriMetadata,
        responseContentType: 'application/json',
        responseHeaders: [],
        url: '/query?page-size=20',
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('builds sender descriptors for header parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_GetHeaderValue_accessor(sender);

    await accessor.get({ xApiKey: 'secret' });

    expect(sender).toHaveBeenCalledWith(
      {
        body: undefined,
        headers: {
          'x-api-key': 'secret',
          accept: 'application/json',
        },
        method: 'GET',
        operationName: 'GetHeaderValue.get',
        responseBodyMetadata: schemaUriMetadata,
        responseContentType: 'application/json',
        responseHeaders: [],
        url: '/header',
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('builds sender descriptors for JSON body parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_CreateItem_accessor(sender);

    await accessor.post({ name: 'alpha' });

    expect(sender).toHaveBeenCalledWith(
      {
        body: {
          name: 'alpha',
        },
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        method: 'POST',
        operationName: 'CreateItem.post',
        requestBodyMetadata: schemaUriMetadata,
        responseBodyMetadata: schemaUriMetadata,
        responseContentType: 'application/json',
        responseHeaders: [],
        url: '/body',
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('builds sender descriptors for combined path, query, header, and body parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_CreateCombinedItem_accessor(sender);

    await accessor.post({
      id: '42',
      name: 'alpha',
      pageSize: 20,
      xApiKey: 'secret',
    });

    expect(sender).toHaveBeenCalledWith(
      {
        body: {
          name: 'alpha',
        },
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'secret',
          accept: 'application/json',
        },
        method: 'POST',
        operationName: 'CreateCombinedItem.post',
        requestBodyMetadata: schemaUriMetadata,
        responseBodyMetadata: schemaUriMetadata,
        responseContentType: 'application/json',
        responseHeaders: [],
        url: '/combined/42?page-size=20',
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('builds sender descriptors for Huma text/plain request bodies', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_CreateScopedText_accessor(sender);

    await accessor.post({
      body: 'hello',
      scope: 'tenant a',
      xTraceId: 'trace-1',
    });

    expect(sender).toHaveBeenCalledWith(
      {
        body: 'hello',
        headers: {
          'content-type': 'text/plain',
          'x-trace-id': 'trace-1',
        },
        method: 'POST',
        operationName: 'CreateScopedText.post',
        responseHeaders: [],
        url: '/text/tenant%20a',
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('preserves URL encoding for path and query parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_UpdateNumbers_accessor(sender);

    await accessor.put({
      body: [1, 2],
      dryRun: true,
      scope: 'tenant a/b',
    });

    expect(sender).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/numbers/tenant%20a%2Fb?dry-run=true',
      }),
      undefined
    );
  });

  it('projects Huma response headers from fetch responses', async () => {
    const sender = generatedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(async () => ({
        headers: {
          get: (name: string) =>
            name === 'etag'
              ? 'entity-tag'
              : name === 'content-type'
                ? 'application/json'
                : null,
        },
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          value: 'alpha',
        }),
      })),
    });
    const accessor = generatedModule.create_GetDocument_accessor(sender);

    await expect(accessor.get()).resolves.toEqual({
      etag: 'entity-tag',
      value: 'alpha',
    });
  });

  it('renders Huma object schemas with generated schema links', () => {
    const block = getInterfaceBlock(generatedSource, 'ObjectEnvelope');
    expect(block).toContain('readonly $schema?: string;');
    expect(block).toContain("readonly kind: 'Alpha' | 'Beta';");
    expect(block).toContain('readonly objectName: string;');
  });

  it('ignores Huma json:\"-\" fields from schemas', () => {
    const block = getInterfaceBlock(generatedSource, 'HiddenEnvelope');
    expect(block).toContain('readonly visibleName: string;');
    expect(block).not.toContain('hidden');
  });

  it('applies Huma json property names with unsafe characters', () => {
    const block = getInterfaceBlock(generatedSource, 'AttributedEnvelope');
    expect(block).toContain("readonly 'renamed-value'?: string | null;");
  });

  it('supports numeric enum tags emitted by Huma', () => {
    const block = getInterfaceBlock(generatedSource, 'NumericEnumEnvelope');
    expect(block).toContain('readonly status: 0 | 1;');
  });

  it('supports symbolic enum tags emitted by Huma', () => {
    const block = getInterfaceBlock(generatedSource, 'SymbolicEnumEnvelope');
    expect(block).toContain("readonly status: 'Alpha' | 'Beta';");
  });

  it('marks non-nullable Huma scalar fields as required without null unions', () => {
    expect(normalizedSource).toMatch(/nonNullableText: string;/);
    expect(normalizedSource).toMatch(/nonNullableCount: number;/);
    expect(normalizedSource).toMatch(/nonNullableTimestamp: string;/);
    expect(normalizedSource).not.toMatch(/nonNullableText: string \| null;/);
  });

  it('adds null unions for Huma nullable scalar fields', () => {
    expect(normalizedSource).toMatch(/nullableText\?: string \| null;/);
    expect(normalizedSource).toMatch(/nullableCount\?: number \| null;/);
    expect(normalizedSource).toMatch(/nullableTimestamp\?: string \| null;/);
  });

  it('records Huma nullable object schemas while keeping referenced properties typed', () => {
    expect(openApiDocument.components.schemas.NullablePoint.nullable).toBe(
      true
    );
    expect(normalizedSource).toMatch(/nullablePoint\?: NullablePoint;/);
  });

  it('maps Huma operation, parameter, request body, and schema docs into OpenAPI fields', () => {
    const documentedGet = openApiDocument.paths['/comments/documented'].get;
    expect(documentedGet.summary).toBe('Returns a documented response.');
    expect(documentedGet.description).toBe(
      'First detail line.\nSecond detail line.'
    );
    expect(documentedGet.parameters[0].description).toBe(
      'Filter text from Huma parameter doc tags.'
    );

    const documentedPost = openApiDocument.paths['/comments/documented'].post;
    expect(
      documentedPost.requestBody.content['application/json'].schema.description
    ).toBe('Documented request body.');
    expect(
      openApiDocument.components.schemas.DocumentedEnvelope.description
    ).toBe('Envelope described by a Huma schema transformer.');
  });

  it('renders Huma operation summary and description on accessor methods', () => {
    const block = getInterfaceBlock(generatedSource, 'GetDocumented');
    expectMethodDocumentation(
      block,
      'get',
      [
        '/**',
        ' * Returns a documented response.',
        ' *',
        ' * @remarks First detail line.',
        ' * Second detail line.',
        ' * @param args Optional arguments for GET /comments/documented.',
        ' * @param options Additional accessor call options without per-call context.',
        ' * @returns Huma documented success response.',
        ' */',
      ].join('\n')
    );
  });

  it('renders Huma parameter docs on generated parameter members', () => {
    const block = getInterfaceBlock(
      generatedSource,
      'GetDocumented_get_arguments'
    );
    expectMemberDocumentation(
      block,
      'filter',
      '/** Filter text from Huma parameter doc tags. */'
    );
  });

  it('renders Huma request body docs on accessor args', () => {
    const block = getInterfaceBlock(generatedSource, 'CreateDocumented');
    expect(block).toContain('Request body: Documented request body.');
    expect(block).toContain(
      'readonly post: (args: CreateDocumentedRequest, options?: AccessorOptions | undefined) => Promise<DocumentedEnvelope>;'
    );
  });

  it('renders Huma schema and property docs on generated schema types', () => {
    const block = getInterfaceBlock(generatedSource, 'DocumentedEnvelope');
    expect(
      getInterfaceDocumentation(generatedSource, 'DocumentedEnvelope')
    ).toBe('/** Envelope described by a Huma schema transformer. */');
    expectMemberDocumentation(
      block,
      'title',
      '/** A required title from Huma doc tags. */'
    );
    expectMemberDocumentation(
      block,
      'optionalNote',
      '/** An optional note from Huma doc tags. */'
    );
  });

  it('renders deprecated tags on Huma accessor methods', () => {
    const block = getInterfaceBlock(generatedSource, 'DeprecatedOperation');
    expectMethodDocumentation(
      block,
      'get',
      [
        '/**',
        ' * Deprecated operation summary.',
        ' * @deprecated This operation is deprecated.',
        ' * @param args Arguments for GET /deprecated/{id}.',
        ' * @param options Additional accessor call options without per-call context.',
        ' * @returns OK',
        ' */',
      ].join('\n')
    );
  });

  it('renders deprecated tags from Huma parameter schemas', () => {
    const block = getInterfaceBlock(
      generatedSource,
      'DeprecatedOperation_get_arguments'
    );
    expect(block).toContain(
      [
        '  /**',
        '   * Deprecated path parameter.',
        '   * @deprecated This argument is deprecated.',
        '   */',
        '  readonly id: string;',
      ].join('\n')
    );
  });

  it('renders deprecated tags from Huma response header schemas', () => {
    const block = getInterfaceBlock(
      generatedSource,
      'DeprecatedOperation_get_response_headers'
    );
    expect(block).toContain(
      [
        '  /**',
        '   * Deprecated trace header.',
        '   * @deprecated This response header is deprecated.',
        '   */',
        '  readonly xTraceId?: string;',
      ].join('\n')
    );
  });

  it('renders deprecated tags on Huma schema definitions and properties', () => {
    const block = getInterfaceBlock(generatedSource, 'DeprecatedEnvelope');
    expect(
      getInterfaceDocumentation(generatedSource, 'DeprecatedEnvelope')
    ).toBe(
      [
        '/**',
        ' * Deprecated envelope schema.',
        ' * @deprecated This schema is deprecated.',
        ' */',
      ].join('\n')
    );
    expect(block).toContain(
      [
        '  /**',
        '   * Deprecated field.',
        '   * @deprecated This property is deprecated.',
        '   */',
        '  readonly deprecatedField: string;',
      ].join('\n')
    );
  });

  it('keeps Huma validation metadata in the input OpenAPI document', () => {
    const schema = openApiDocument.components.schemas.ValidatedEnvelope;
    expect(schema.properties.code.minLength).toBe(2);
    expect(schema.properties.code.maxLength).toBe(8);
    expect(schema.properties.code.pattern).toBe('^[A-Z]+$');
    expect(schema.properties.level.minimum).toBe(1);
    expect(schema.properties.level.maximum).toBe(5);
    expect(schema.properties.level.default).toBe(3);
  });

  it('renders Huma validation enum fields as TypeScript literal unions', () => {
    const block = getInterfaceBlock(generatedSource, 'ValidatedEnvelope');
    expect(block).toContain("readonly status: 'draft' | 'published';");
  });

  it('type-checks generated Huma accessors', async () => {
    await expect(
      getTypeScriptDiagnostics({
        'generated.ts': generatedSource,
      })
    ).resolves.toEqual([]);
  });
});
