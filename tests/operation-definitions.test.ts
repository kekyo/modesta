// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  generateAccessorSourceFromProject,
  getTypeScriptDiagnostics,
  SwaggerFixtureProject,
  transpileGeneratedSource,
} from './support/harness';
import { getInterfaceBlock } from './support/source-assertions';

const operationProject: SwaggerFixtureProject = {
  files: {
    'Program.cs': [
      'using Microsoft.AspNetCore.Mvc;',
      '',
      'var builder = WebApplication.CreateBuilder(args);',
      'builder.Services.AddEndpointsApiExplorer();',
      'builder.Services.AddSwaggerGen(options =>',
      '    {',
      '        options.SupportNonNullableReferenceTypes();',
      '        options.NonNullableReferenceTypesAsRequired();',
      '    });',
      'var app = builder.Build();',
      'app.UseSwagger();',
      '',
      'app.MapGet("/route/{id}", ([FromRoute] string id) =>',
      '    TypedResults.Ok(new SimpleRecord(id, "route")))',
      '    .WithName("GetRouteValue");',
      '',
      'app.MapGet("/query", ([FromQuery(Name = "page-size")] int pageSize) =>',
      '    TypedResults.Ok(new SimpleRecord(pageSize.ToString(), "query")))',
      '    .WithName("GetPage");',
      '',
      'app.MapGet("/header", ([FromHeader(Name = "x-api-key")] string apiKey) =>',
      '    TypedResults.Ok(new SimpleRecord(apiKey, "header")))',
      '    .WithName("GetHeaderValue");',
      '',
      'app.MapGet("/combined/{id}", ([FromRoute] string id, [FromQuery(Name = "page-size")] int pageSize, [FromHeader(Name = "x-api-key")] string apiKey) =>',
      '    TypedResults.Ok(new SimpleRecord($"{id}:{pageSize}:{apiKey}", "combined")))',
      '    .WithName("GetCombinedValue");',
      '',
      'app.MapPost("/body", ([FromBody] CreateItemRequest request) =>',
      '    TypedResults.Ok(new SimpleRecord(request.Name, "body")))',
      '    .WithName("CreateItem");',
      '',
      'app.MapPost("/combined/{id}", ([FromRoute] string id, [FromQuery(Name = "page-size")] int pageSize, [FromHeader(Name = "x-api-key")] string apiKey, [FromBody] CreateItemRequest request) =>',
      '    TypedResults.Ok(new SimpleRecord($"{id}:{pageSize}:{apiKey}:{request.Name}", "combined-body")))',
      '    .WithName("CreateCombinedItem");',
      '',
      'app.MapGet("/array", () =>',
      '    TypedResults.Ok(new[]',
      '    {',
      '        new SimpleRecord("alpha", "array"),',
      '    }))',
      '    .WithName("ListItems");',
      '',
      'app.MapGet("/dictionary", () =>',
      '    TypedResults.Ok(new Dictionary<string, SimpleRecord>',
      '    {',
      '        ["alpha"] = new SimpleRecord("alpha", "dictionary"),',
      '    }))',
      '    .WithName("MapItems");',
      '',
      'app.MapDelete("/items/{id}", ([FromRoute] string id) => TypedResults.NoContent())',
      '    .WithName("DeleteItem");',
      '',
      'app.Run();',
      '',
      'public sealed record CreateItemRequest(string Name);',
      'public sealed record SimpleRecord(string Id, string Source);',
      '',
    ].join('\n'),
  },
};

const operationEdgeCaseProject: SwaggerFixtureProject = {
  files: {
    'Program.cs': [
      'using Microsoft.AspNetCore.Mvc;',
      '',
      'var builder = WebApplication.CreateBuilder(args);',
      'builder.Services.AddEndpointsApiExplorer();',
      'builder.Services.AddSwaggerGen(options =>',
      '    {',
      '        options.SupportNonNullableReferenceTypes();',
      '        options.NonNullableReferenceTypesAsRequired();',
      '        options.OperationFilter<ResponseHeaderOperationFilter>();',
      '    });',
      'var app = builder.Build();',
      'app.UseSwagger();',
      '',
      'app.MapGet("/users/{user_id}", ([FromRoute] string user_id) =>',
      '    TypedResults.Ok(new CollisionValueResponse(user_id)))',
      '    .WithName("GetUser");',
      '',
      'app.MapGet("/items/{id}", ([FromRoute] string id, [FromQuery(Name = "id")] string? queryId, [FromHeader(Name = "id")] string? headerId) =>',
      '    TypedResults.Ok(new CollisionValueResponse($"{id}:{queryId}:{headerId}")))',
      '    .WithName("GetDuplicateParameters");',
      '',
      'app.MapGet("/normalized-collision", ([FromQuery(Name = "x-api-key")] string? queryKey, [FromHeader(Name = "x.api.key")] string? headerKey) =>',
      '    TypedResults.Ok(new CollisionValueResponse($"{queryKey}:{headerKey}")))',
      '    .WithName("GetNormalizedCollision");',
      '',
      'app.MapGet("/normalized-distinct/{user_id}", ([FromRoute] string user_id, [FromQuery(Name = "user-id")] string? userId, [FromHeader(Name = "tenant.id")] string? tenantId) =>',
      '    TypedResults.Ok(new CollisionValueResponse($"{user_id}:{userId}:{tenantId}")))',
      '    .WithName("GetNormalizedDistinct");',
      '',
      'app.MapPost("/items/{id}", ([FromRoute] string id, [FromQuery(Name = "x-api-key")] string? queryApiKey, [FromHeader(Name = "x-api-key")] string? headerApiKey, [FromBody] CreateCollisionItemRequest request) =>',
      '    TypedResults.Ok(new CollisionValueResponse(request.Name)))',
      '    .WithName("CreateItem");',
      '',
      'app.MapPost("/text", ([FromBody] string body) => TypedResults.NoContent())',
      '    .Accepts<string>("text/plain")',
      '    .WithName("CreateText");',
      '',
      'app.MapPost("/text/{scope}", ([FromRoute] string scope, [FromHeader(Name = "x-trace-id")] string? traceId, [FromBody] string body) => TypedResults.NoContent())',
      '    .Accepts<string>("text/plain")',
      '    .WithName("CreateScopedText");',
      '',
      'app.MapPost("/number-list", ([FromBody] int[] values) => TypedResults.NoContent())',
      '    .WithName("CreateNumberList");',
      '',
      'app.MapPut("/numbers/{scope}", ([FromRoute] string scope, [FromQuery(Name = "dry-run")] bool? dryRun, [FromBody] int[] values) => TypedResults.NoContent())',
      '    .WithName("UpdateNumbers");',
      '',
      'app.MapGet("/token", () => Results.Empty)',
      '    .Produces(StatusCodes.Status200OK)',
      '    .WithName("GetToken");',
      '',
      'app.MapGet("/document", () =>',
      '    TypedResults.Ok(new DocumentResponse("alpha")))',
      '    .WithName("GetDocument");',
      '',
      'app.MapGet("/plain-message", () => TypedResults.Text("hello"))',
      '    .Produces<string>(StatusCodes.Status200OK, "text/plain")',
      '    .WithName("GetPlainMessage");',
      '',
      'app.MapGet("/numbers", () => TypedResults.Ok(new[] { 1, 2, 3 }))',
      '    .WithName("GetNumbers");',
      '',
      'app.MapGet("/message", () => TypedResults.Text("hello"))',
      '    .Produces<string>(StatusCodes.Status200OK, "text/plain")',
      '    .WithName("GetMessage");',
      '',
      'app.MapGet("/number-message", () => TypedResults.Ok(new[] { 1, 2, 3 }))',
      '    .WithName("GetNumberMessage");',
      '',
      'app.MapGet("/rate-limits", () => Results.Empty)',
      '    .Produces(StatusCodes.Status200OK)',
      '    .WithName("GetRateLimits");',
      '',
      'app.MapGet("/response-collision", () =>',
      '    TypedResults.Ok(new ResponseCollisionBody("body-tag")))',
      '    .WithName("GetResponseCollision");',
      '',
      'app.Run();',
      '',
    ].join('\n'),
    'Models.cs': [
      'public sealed record CollisionValueResponse(string Value);',
      'public sealed record CreateCollisionItemRequest(string Id, string XApiKey, string Name);',
      'public sealed record DocumentResponse(string Value);',
      'public sealed record ResponseCollisionBody(string Etag);',
      '',
    ].join('\n'),
    'ResponseHeaderOperationFilter.cs': [
      'using Microsoft.OpenApi.Models;',
      'using Swashbuckle.AspNetCore.SwaggerGen;',
      '',
      'public sealed class ResponseHeaderOperationFilter : IOperationFilter',
      '{',
      '    public void Apply(OpenApiOperation operation, OperationFilterContext context)',
      '    {',
      '        if (operation.OperationId is null)',
      '        {',
      '            return;',
      '        }',
      '',
      '        if (!operation.Responses.TryGetValue("200", out var response))',
      '        {',
      '            return;',
      '        }',
      '',
      '        switch (operation.OperationId)',
      '        {',
      '            case "GetToken":',
      '                AddStringHeader(response, "x-request-id", "Request identifier.");',
      '                break;',
      '            case "GetDocument":',
      '                AddStringHeader(response, "etag", "Entity tag.");',
      '                break;',
      '            case "GetMessage":',
      '                AddStringHeader(response, "etag", "Entity tag.");',
      '                break;',
      '            case "GetNumberMessage":',
      '                AddStringHeader(response, "etag", "Entity tag.");',
      '                break;',
      '            case "GetRateLimits":',
      '                AddNumberArrayHeader(response, "x-rate-limit-history", "Recent remaining quota values.");',
      '                break;',
      '            case "GetResponseCollision":',
      '                AddStringHeader(response, "etag", "Entity tag.");',
      '                AddStringHeader(response, "x-api-key", "Primary collision key.");',
      '                AddStringHeader(response, "x.api.key", "Secondary collision key.");',
      '                break;',
      '        }',
      '    }',
      '',
      '    private static void AddStringHeader(OpenApiResponse response, string name, string description)',
      '    {',
      '        response.Headers ??= new Dictionary<string, OpenApiHeader>();',
      '        response.Headers[name] = new OpenApiHeader',
      '        {',
      '            Description = description,',
      '            Schema = new OpenApiSchema',
      '            {',
      '                Type = "string",',
      '            },',
      '        };',
      '    }',
      '',
      '    private static void AddNumberArrayHeader(OpenApiResponse response, string name, string description)',
      '    {',
      '        response.Headers ??= new Dictionary<string, OpenApiHeader>();',
      '        response.Headers[name] = new OpenApiHeader',
      '        {',
      '            Description = description,',
      '            Schema = new OpenApiSchema',
      '            {',
      '                Type = "array",',
      '                Items = new OpenApiSchema',
      '                {',
      '                    Type = "integer",',
      '                },',
      '            },',
      '        };',
      '    }',
      '}',
      '',
    ].join('\n'),
  },
};

describe('operation definition generation', () => {
  let generatedSource = '';
  let generatedModule: Record<string, any>;
  let edgeCaseGeneratedSource = '';
  let edgeCaseGeneratedModule: Record<string, any>;
  const edgeCaseWarnings: string[] = [];
  const getEdgeCaseWarnings = (accessorName: string) =>
    edgeCaseWarnings.filter((message) =>
      message.includes(`accessor '${accessorName}'`)
    );
  const replaceGlobalProperty = (name: string, value: unknown) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value,
      writable: true,
    });

    return () => {
      if (descriptor == null) {
        delete (globalThis as Record<string, unknown>)[name];
        return;
      }

      Object.defineProperty(globalThis, name, descriptor);
    };
  };

  beforeAll(async () => {
    generatedSource = await generateAccessorSourceFromProject({
      artifactName: 'operation-definitions',
      generatedArtifactPath: 'generated/operation-definitions.ts',
      project: operationProject,
    });
    generatedModule = await transpileGeneratedSource(generatedSource);
    edgeCaseGeneratedSource = await generateAccessorSourceFromProject({
      artifactName: 'operation-definitions-edge-cases',
      generatedArtifactPath: 'generated/operation-definitions-edge-cases.ts',
      project: operationEdgeCaseProject,
      warningSink: (message) => {
        edgeCaseWarnings.push(message);
      },
    });
    edgeCaseGeneratedModule = await transpileGeneratedSource(
      edgeCaseGeneratedSource
    );
  });

  it('flattens route parameter definitions into argument groups', () => {
    const argumentsBlock = getInterfaceBlock(
      generatedSource,
      'GetRouteValue_get_arguments'
    );

    expect(argumentsBlock).toContain('id: string;');
    expect(argumentsBlock).not.toContain('pathParameters:');
  });

  it('flattens query parameters and normalizes unsafe characters', () => {
    const argumentsBlock = getInterfaceBlock(
      generatedSource,
      'GetPage_get_arguments'
    );

    expect(argumentsBlock).toMatch(/pageSize\??: number;/);
    expect(generatedSource).not.toContain('GetPage_get_query_parameters');
  });

  it('flattens header parameters and normalizes unsafe characters', () => {
    const argumentsBlock = getInterfaceBlock(
      generatedSource,
      'GetHeaderValue_get_arguments'
    );

    expect(argumentsBlock).toMatch(/xApiKey\??: string;/);
    expect(generatedSource).not.toContain(
      'GetHeaderValue_get_header_parameters'
    );
  });

  it('uses the shared body type directly when no flattened parameters are present', () => {
    expect(generatedSource).toContain(
      'readonly post: (args: CreateItemRequest, options?: AccessorOptions | undefined) => Promise<SimpleRecord>;'
    );
    expect(generatedSource).not.toContain('CreateItem_post_arguments');
    expect(generatedSource).not.toContain('CreateItem_post_request_body');
  });

  it('uses an intersection type when flattened parameters and a body coexist', () => {
    const argumentsBlock = getInterfaceBlock(
      generatedSource,
      'CreateCombinedItem_post_arguments'
    );

    expect(argumentsBlock).toContain('id: string;');
    expect(argumentsBlock).toMatch(/pageSize\??: number;/);
    expect(argumentsBlock).toMatch(/xApiKey\??: string;/);
    expect(generatedSource).toContain(
      'readonly post: (args: CreateItemRequest & CreateCombinedItem_post_arguments, options?: AccessorOptions | undefined) => Promise<SimpleRecord>;'
    );
  });

  it('uses shared schema types directly for direct response definitions', () => {
    expect(generatedSource).toContain(
      'readonly get: (args: GetRouteValue_get_arguments, options?: AccessorOptions | undefined) => Promise<SimpleRecord>;'
    );
    expect(generatedSource).not.toContain('GetRouteValue_get_response');
  });

  it('uses shared schema types directly for array return type definitions', () => {
    expect(generatedSource).toContain(
      'readonly get: (options?: AccessorOptions | undefined) => Promise<ReadonlyArray<SimpleRecord>>;'
    );
    expect(generatedSource).not.toContain('ListItems_get_response');
  });

  it('separates dictionary return type definitions', () => {
    const dictionaryResponseBlock = getInterfaceBlock(
      generatedSource,
      'MapItems_get_response'
    );

    expect(dictionaryResponseBlock).toContain('[key: string]: SimpleRecord;');
  });

  it('uses void directly for empty responses', () => {
    expect(generatedSource).toContain(
      '_delete: (args: DeleteItem_delete_arguments, options?: AccessorOptions | undefined) => Promise<void>;'
    );
    expect(generatedSource).not.toContain('DeleteItem_delete_response');
  });

  it('omits args from no-argument accessor signatures', () => {
    expect(generatedSource).toContain(
      'get: (options?: AccessorOptions | undefined) => Promise<ReadonlyArray<SimpleRecord>>;'
    );
    expect(generatedSource).not.toContain(
      'get: (args?: ListItems_get_arguments | undefined, options?: AccessorOptions | undefined) => Promise<ReadonlyArray<SimpleRecord>>;'
    );
  });

  it('renders accessor factories as overload functions for interface and per-call context combinations', () => {
    expect(generatedSource).not.toContain(
      'export type AccessorContextArgument'
    );
    expect(generatedSource).toContain(
      [
        'export function create_GetRouteValue_accessor(sender: AccessorSender): GetRouteValue;',
        'export function create_GetRouteValue_accessor<TAccessorContext>(',
        '  sender: AccessorSenderWithContext<TAccessorContext>',
        '): GetRouteValue_with_context<TAccessorContext>;',
        'export function create_GetRouteValue_accessor<TAccessorContext>(',
        '  sender: AccessorSender | AccessorSenderWithContext<TAccessorContext>',
        '): GetRouteValue | GetRouteValue_with_context<TAccessorContext> {',
      ].join('\n')
    );
  });

  it('renders paired accessor interfaces for with and without per-call context', () => {
    expect(generatedSource).toContain('export interface DeleteItem {');
    expect(generatedSource).toContain(
      'readonly _delete: (args: DeleteItem_delete_arguments, options?: AccessorOptions | undefined) => Promise<void>;'
    );
    expect(generatedSource).toContain(
      'export interface DeleteItem_with_context<TAccessorContext> {'
    );
    expect(generatedSource).toContain(
      'readonly _delete: (args: DeleteItem_delete_arguments, options: AccessorOptionsWithContext<TAccessorContext>) => Promise<void>;'
    );
  });

  it('builds sender descriptors for route parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_GetRouteValue_accessor(sender);
    const signal = new AbortController().signal;

    await accessor.get(
      {
        id: '42',
      },
      { signal }
    );

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'GetRouteValue.get',
        method: 'GET',
        url: '/route/42',
        headers: {
          accept: 'application/json',
        },
        body: undefined,
        responseContentType: 'application/json',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      { signal }
    );
  });

  it('builds sender descriptors for query parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_GetPage_accessor(sender);

    await accessor.get({
      pageSize: 20,
    });

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'GetPage.get',
        method: 'GET',
        url: '/query?page-size=20',
        headers: {
          accept: 'application/json',
        },
        body: undefined,
        responseContentType: 'application/json',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('builds sender descriptors for operations without arguments', async () => {
    const sender = vi.fn(async (request: unknown, options: unknown) => ({
      request,
      options,
    }));
    const accessor = generatedModule.create_ListItems_accessor(sender);
    const signal = new AbortController().signal;

    await accessor.get({ signal });

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'ListItems.get',
        method: 'GET',
        url: '/array',
        headers: {
          accept: 'application/json',
        },
        body: undefined,
        responseContentType: 'application/json',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      { signal }
    );
  });

  it('builds sender descriptors for header parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_GetHeaderValue_accessor(sender);

    await accessor.get({
      xApiKey: 'secret',
    });

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'GetHeaderValue.get',
        method: 'GET',
        url: '/header',
        headers: {
          'x-api-key': 'secret',
          accept: 'application/json',
        },
        body: undefined,
        responseContentType: 'application/json',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('builds sender descriptors for combined path, query, and header parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_GetCombinedValue_accessor(sender);

    await accessor.get({
      id: '42',
      pageSize: 20,
      xApiKey: 'secret',
    });

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'GetCombinedValue.get',
        method: 'GET',
        url: '/combined/42?page-size=20',
        headers: {
          'x-api-key': 'secret',
          accept: 'application/json',
        },
        body: undefined,
        responseContentType: 'application/json',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('builds sender descriptors for body parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_CreateItem_accessor(sender);

    await accessor.post({
      name: 'alpha',
    });

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'CreateItem.post',
        method: 'POST',
        url: '/body',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: {
          name: 'alpha',
        },
        responseContentType: 'application/json',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('passes per-call context values to sender calls when requested by the sender type', async () => {
    const signal = new AbortController().signal;
    const sender = vi.fn(
      async (_request: unknown, options: unknown) => options
    );
    const accessor = generatedModule.create_CreateItem_accessor(sender);

    await accessor.post(
      {
        name: 'alpha',
      },
      {
        context: {
          requestId: 'request-99',
        },
        signal,
      }
    );

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'CreateItem.post',
        method: 'POST',
        url: '/body',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: {
          name: 'alpha',
        },
        responseContentType: 'application/json',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      {
        context: {
          requestId: 'request-99',
        },
        signal,
      }
    );
  });

  it('builds sender descriptors for combined path, query, header, and body parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_CreateCombinedItem_accessor(sender);

    await accessor.post({
      id: '42',
      pageSize: 20,
      xApiKey: 'secret',
      name: 'alpha',
    });

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'CreateCombinedItem.post',
        method: 'POST',
        url: '/combined/42?page-size=20',
        headers: {
          'x-api-key': 'secret',
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: {
          name: 'alpha',
        },
        responseContentType: 'application/json',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('does not pass interface context values to sender calls', async () => {
    const sender = vi.fn(
      async (_request: unknown, options: unknown) => options
    );
    const accessor = generatedModule.create_DeleteItem_accessor(sender);

    await accessor._delete({
      id: '42',
    });

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'DeleteItem._delete',
        method: 'DELETE',
        url: '/items/42',
        headers: {},
        body: undefined,
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('emits sender interfaces and deprecated function compatibility aliases', () => {
    expect(generatedSource).toContain(
      "export type PayloadType = 'string' | 'ArrayBuffer';"
    );
    expect(generatedSource).toContain(
      [
        'export interface AccessorSenderSerializer {',
        '  /** Serialized payload data shape used by this serializer. */',
        '  readonly payloadType: PayloadType;',
        '  /**',
        '   * Serializes a request body value into transport data.',
        '   * @param value Target value',
        '   * @returns Serialized payload data',
        '   */',
        '  readonly serialize: (value: unknown) => unknown;',
        '  /**',
        '   * Deserializes transport data into a response body value.',
        '   * @param payloadData Serialized payload data',
        '   * @returns Retrieved value',
        '   */',
        '  readonly deserialize: (payloadData: unknown) => unknown;',
        '}',
      ].join('\n')
    );
    expect(generatedSource).toContain(
      [
        '/**',
        ' * @deprecated Use `AccessorSenderInterface` instead.',
        ' */',
        'export type AccessorSenderFunction = <TResponse>(',
        '  request: AccessorRequestDescriptor,',
        '  options: AccessorOptions | undefined) => Promise<TResponse>;',
      ].join('\n')
    );
    expect(generatedSource).toContain(
      'export type AccessorSender = AccessorSenderFunction | AccessorSenderInterface;'
    );
    expect(generatedSource).toContain(
      [
        'export type AccessorSenderWithContext<TAccessorContext> =',
        '  | AccessorSenderFunctionWithContext<TAccessorContext>',
        '  | AccessorSenderInterfaceWithContext<TAccessorContext>;',
      ].join('\n')
    );
  });

  it('type-checks sender and per-call context requirements for generated accessors', async () => {
    const diagnostics = await getTypeScriptDiagnostics({
      'generated.ts': generatedSource,
      'consumer.ts': [
        'import {',
        '  AccessorOptionsWithContext,',
        '  AccessorOptions,',
        '  AccessorRequestDescriptor,',
        '  AccessorSender,',
        '  AccessorSenderInterface,',
        '  AccessorSenderInterfaceWithContext,',
        '  AccessorSenderWithContext,',
        '  create_CreateItem_accessor,',
        '  create_DeleteItem_accessor,',
        '  createFetchSender,',
        '  modestaDefaultSerializers,',
        '  modestaProjectResponse,',
        "} from './generated.ts';",
        '',
        'const sender: AccessorSender = async <TResponse>(',
        '  _request: AccessorRequestDescriptor,',
        '  _options: AccessorOptions | undefined',
        "): Promise<TResponse> => 'ok' as unknown as TResponse;",
        '',
        'const deleteAccessor = create_DeleteItem_accessor(sender);',
        "deleteAccessor._delete({ id: '42' });",
        '// @ts-expect-error accessor factories no longer accept interface context arguments',
        "create_DeleteItem_accessor(sender, 'trace-42');",
        '',
        'const senderFromLambda: AccessorSender = async (request, _options) =>',
        '  modestaProjectResponse(request, {',
        "    body: 'ok',",
        '    getHeader: () => null,',
        '  });',
        'create_DeleteItem_accessor(senderFromLambda);',
        '',
        'const senderFromObject: AccessorSenderInterface = {',
        '  serializers: modestaDefaultSerializers,',
        '  send: async <TResponse>(',
        '    _request: AccessorRequestDescriptor,',
        '    _options: AccessorOptions | undefined',
        "  ): Promise<TResponse> => 'ok' as unknown as TResponse,",
        '};',
        'create_DeleteItem_accessor(senderFromObject);',
        '',
        'const senderWithContext: AccessorSenderWithContext<{ requestId: string }> = async <TResponse>(',
        '  _request: AccessorRequestDescriptor,',
        '  options: AccessorOptionsWithContext<{ requestId: string }>',
        '): Promise<TResponse> => options.context as unknown as TResponse;',
        '',
        'const createAccessor = create_CreateItem_accessor(senderWithContext);',
        "createAccessor.post({ name: 'alpha' }, { context: { requestId: 'request-99' } });",
        '// @ts-expect-error per-call context is required for senders with context',
        "createAccessor.post({ name: 'alpha' });",
        '// @ts-expect-error accessor factories no longer accept interface context arguments',
        "create_CreateItem_accessor(senderWithContext, 'trace-42');",
        '',
        'const senderWithContextFromObject: AccessorSenderInterfaceWithContext<{ requestId: string }> = {',
        '  serializers: modestaDefaultSerializers,',
        '  send: async <TResponse>(',
        '    _request: AccessorRequestDescriptor,',
        '    options: AccessorOptionsWithContext<{ requestId: string }>',
        '  ): Promise<TResponse> => options.context as unknown as TResponse,',
        '};',
        'const createAccessorFromObject = create_CreateItem_accessor(senderWithContextFromObject);',
        "createAccessorFromObject.post({ name: 'alpha' }, { context: { requestId: 'request-99' } });",
        '// @ts-expect-error per-call context is required for sender objects with context',
        "createAccessorFromObject.post({ name: 'alpha' });",
        '',
        'const fetchSender = createFetchSender();',
        "const fetchSenderWithOptions = createFetchSender({ baseUrl: 'https://example.com/' });",
        'create_DeleteItem_accessor(fetchSender);',
        'create_DeleteItem_accessor(fetchSenderWithOptions);',
        '// @ts-expect-error accessor factories no longer accept interface context arguments',
        "create_DeleteItem_accessor(fetchSender, 'trace-42');",
        '',
      ].join('\n'),
    });

    expect(diagnostics).toEqual([]);
  });

  it('provides public helpers for custom sender request preparation', () => {
    const signal = new AbortController().signal;
    const requestBody = {
      name: 'alpha',
    };
    const request = {
      operationName: 'CreateItem.post',
      method: 'POST',
      url: '/body',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: requestBody,
      responseHeaders: [],
      wrapResponseBody: false,
    };

    expect(
      generatedModule.modestaPrepareRequest(
        request,
        { signal },
        {
          baseUrl: 'https://api.example.com',
          headers: {
            authorization: 'Bearer token',
          },
        }
      )
    ).toEqual({
      url: new URL('https://api.example.com/body'),
      method: 'POST',
      headers: {
        authorization: 'Bearer token',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: requestBody,
      signal,
    });
    expect(
      generatedModule.modestaSerializeRequestBody(
        request,
        generatedModule.modestaDefaultSerializers
      )
    ).toBe(JSON.stringify(requestBody));

    const customSerializer = {
      deserialize: vi.fn(),
      payloadType: 'string',
      serialize: vi.fn((value: unknown) => ({
        encoded: value,
      })),
    };
    expect(
      generatedModule.modestaSerializeRequestBody(
        request,
        new Map([['application/json', customSerializer]])
      )
    ).toEqual({
      encoded: requestBody,
    });
    expect(customSerializer.serialize).toHaveBeenCalledWith(requestBody);
    expect(
      generatedModule.modestaPrepareRequest(
        {
          ...request,
          headers: {},
          body: undefined,
        },
        undefined,
        {
          baseUrl: 'https://api.example.com',
        }
      )
    ).toEqual({
      url: new URL('https://api.example.com/body'),
      method: 'POST',
      headers: undefined,
      body: undefined,
      signal: undefined,
    });
  });

  it('provides public helpers for custom sender response projection', () => {
    const responseBody = {
      value: 'alpha',
    };
    const projectedObjectResponse = generatedModule.modestaProjectResponse(
      {
        operationName: 'GetDocument.get',
        method: 'GET',
        url: '/document',
        headers: {
          accept: 'application/json',
        },
        body: undefined,
        responseHeaders: [
          {
            name: 'etag',
            propertyName: 'etag',
            valueType: 'string',
          },
        ],
        wrapResponseBody: false,
      },
      {
        body: responseBody,
        getHeader: (name: string) => (name === 'etag' ? 'etag-42' : null),
      }
    );

    expect(projectedObjectResponse).toBe(responseBody);
    expect(projectedObjectResponse).toEqual({
      value: 'alpha',
      etag: 'etag-42',
    });

    expect(
      generatedModule.modestaProjectResponse(
        {
          operationName: 'GetRateLimits.get',
          method: 'GET',
          url: '/rate-limits',
          headers: {},
          body: undefined,
          responseHeaders: [
            {
              name: 'x-rate-limit-history',
              propertyName: 'xRateLimitHistory',
              valueType: 'array',
              itemValueType: 'number',
            },
          ],
          wrapResponseBody: true,
        },
        {
          body: [1, 2, 3],
          getHeader: (name: string) =>
            name === 'x-rate-limit-history' ? '7, 5, 3' : null,
        }
      )
    ).toEqual({
      body: [1, 2, 3],
      xRateLimitHistory: [7, 5, 3],
    });
  });

  it('provides a public fetch response body reader helper', async () => {
    const responseBody = {
      id: '42',
      source: 'helper',
    };
    const responseText = JSON.stringify(responseBody);
    const serializer = {
      deserialize: vi.fn((data: unknown) => JSON.parse(String(data))),
      payloadType: 'string',
      serialize: vi.fn(),
    };
    const text = vi.fn(async () => responseText);

    await expect(
      generatedModule.modestaReadFetchResponseBody(
        {
          status: 200,
          headers: {
            get: (name: string) =>
              name === 'content-type' ? 'application/json' : null,
          },
          text,
        },
        'application/json',
        new Map([['application/json', serializer]])
      )
    ).resolves.toEqual(responseBody);
    expect(text).toHaveBeenCalledTimes(1);
    expect(serializer.deserialize).toHaveBeenCalledWith(responseText);

    const responsePayload = new ArrayBuffer(4);
    const arrayBufferSerializer = {
      deserialize: vi.fn((data: unknown) => data),
      payloadType: 'ArrayBuffer',
      serialize: vi.fn(),
    };
    const arrayBuffer = vi.fn(async () => responsePayload);
    const unusedText = vi.fn(async () => 'ignored');
    await expect(
      generatedModule.modestaReadFetchResponseBody(
        {
          status: 200,
          headers: {
            get: (name: string) =>
              name === 'content-type' ? 'application/octet-stream' : null,
          },
          arrayBuffer,
          text: unusedText,
        },
        undefined,
        new Map([['application/octet-stream', arrayBufferSerializer]])
      )
    ).resolves.toBe(responsePayload);
    expect(arrayBuffer).toHaveBeenCalledTimes(1);
    expect(unusedText).not.toHaveBeenCalled();
    expect(arrayBufferSerializer.deserialize).toHaveBeenCalledWith(
      responsePayload
    );

    const emptyText = vi.fn(async () => 'ignored');
    await expect(
      generatedModule.modestaReadFetchResponseBody(
        {
          status: 204,
          headers: {
            get: () => null,
          },
          text: emptyText,
        },
        undefined,
        generatedModule.modestaDefaultSerializers
      )
    ).resolves.toBeUndefined();
    expect(emptyText).not.toHaveBeenCalled();
  });

  it('provides a fetch-based sender helper', async () => {
    const signal = new AbortController().signal;
    const json = vi.fn(async () => ({ id: '42', source: 'route' }));
    const text = vi.fn(async () =>
      JSON.stringify({ id: '42', source: 'route' })
    );
    const fetchImplementation = vi.fn(
      async (input: URL, init?: RequestInit) => {
        expect(String(input)).toBe('https://api.example.com/route/42');
        expect(init).toEqual({
          credentials: 'include',
          method: 'GET',
          headers: {
            authorization: 'Bearer token',
            accept: 'application/json',
          },
          signal,
        });

        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: {
            get: (name: string) =>
              name === 'content-type' ? 'application/json' : null,
          },
          json,
          text,
        };
      }
    );
    const sender = generatedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: fetchImplementation,
      headers: {
        authorization: 'Bearer token',
      },
      init: {
        credentials: 'include',
      },
    });
    const accessor = generatedModule.create_GetRouteValue_accessor(sender);

    const result = await accessor.get(
      {
        id: '42',
      },
      { signal }
    );

    expect(result).toEqual({
      id: '42',
      source: 'route',
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledTimes(1);
    expect(text).not.toHaveBeenCalled();
  });

  it('uses the generated response content type when fetch omits the response header', async () => {
    const json = vi.fn(async () => ({ id: '42', source: 'route' }));
    const fetchImplementation = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: () => null,
      },
      json,
      text: async () => JSON.stringify(await json()),
    }));
    const sender = generatedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: fetchImplementation,
    });
    const accessor = generatedModule.create_GetRouteValue_accessor(sender);

    await expect(
      accessor.get({
        id: '42',
      })
    ).resolves.toEqual({
      id: '42',
      source: 'route',
    });

    expect(json).toHaveBeenCalledTimes(1);
  });

  it('selects custom fetch serializers by normalized content type', async () => {
    const textSerializer = {
      deserialize: vi.fn((payloadData: unknown) => ({
        decoded: String(payloadData),
      })),
      payloadType: 'string',
      serialize: vi.fn((value: unknown) => `encoded:${String(value)}`),
    };
    const fetchImplementation = vi.fn(
      async (input: URL, init?: RequestInit) => {
        if (String(input) === 'https://api.example.com/text/tenant') {
          expect(init?.body).toBe('encoded:payload');
          return {
            ok: true,
            status: 204,
            statusText: 'No Content',
            headers: {
              get: () => null,
            },
            text: async () => '',
          };
        }

        expect(String(input)).toBe('https://api.example.com/plain-message');
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: {
            get: (name: string) =>
              name === 'content-type' ? 'text/plain; charset=utf-8' : null,
          },
          text: async () => 'hello',
        };
      }
    );
    const sender = edgeCaseGeneratedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: fetchImplementation,
      serializers: new Map([['Text/Plain; charset=utf-8', textSerializer]]),
    });
    const textRequestAccessor =
      edgeCaseGeneratedModule.create_CreateScopedText_accessor(sender);
    const textResponseAccessor =
      edgeCaseGeneratedModule.create_GetPlainMessage_accessor(sender);

    await expect(
      textRequestAccessor.post({
        body: 'payload',
        scope: 'tenant',
      })
    ).resolves.toBeUndefined();
    await expect(textResponseAccessor.get()).resolves.toEqual({
      decoded: 'hello',
    });

    expect(textSerializer.serialize).toHaveBeenCalledWith('payload');
    expect(textSerializer.deserialize).toHaveBeenCalledWith('hello');
  });

  it('uses the current origin for fetch-based sender when baseUrl is omitted', async () => {
    const restoreLocation = replaceGlobalProperty('location', {
      origin: 'https://current.example',
    });
    const json = vi.fn(async () => ({
      id: '42',
      source: 'route',
    }));
    const text = vi.fn(async () => JSON.stringify(await json()));
    const fetchImplementation = vi.fn(
      async (input: URL, init?: RequestInit) => {
        expect(String(input)).toBe('https://current.example/route/42');
        expect(init).toEqual({
          method: 'GET',
          headers: {
            accept: 'application/json',
          },
        });

        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: {
            get: (name: string) =>
              name === 'content-type' ? 'application/json' : null,
          },
          json,
          text,
        };
      }
    );
    const restoreFetch = replaceGlobalProperty('fetch', fetchImplementation);

    try {
      const sender = generatedModule.createFetchSender();
      const accessor = generatedModule.create_GetRouteValue_accessor(sender);

      await expect(
        accessor.get({
          id: '42',
        })
      ).resolves.toEqual({
        id: '42',
        source: 'route',
      });
    } finally {
      restoreFetch();
      restoreLocation();
    }

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledTimes(1);
    expect(text).not.toHaveBeenCalled();
  });

  it('requires baseUrl when the current origin is unavailable', async () => {
    const restoreLocation = replaceGlobalProperty('location', undefined);
    const fetchImplementation = vi.fn(async () => {
      throw new Error('Unexpected fetch call.');
    });

    try {
      const sender = generatedModule.createFetchSender({
        fetch: fetchImplementation,
      });
      const accessor = generatedModule.create_GetRouteValue_accessor(sender);

      await expect(
        accessor.get({
          id: '42',
        })
      ).rejects.toThrow(
        'Base URL is not available. Pass baseUrl explicitly outside browser-like environments.'
      );
    } finally {
      restoreLocation();
    }

    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('emits runtime helpers that short-circuit empty response header projections', () => {
    expect(generatedSource).toContain('if (descriptors.length === 0) {');
    expect(generatedSource).toContain(
      'let projectedHeaders: Record<string, unknown> | undefined;'
    );
    expect(generatedSource).toContain('if (projectedHeaders == null) {');
    expect(generatedSource).not.toContain(
      'Object.keys(projectedHeaders).length'
    );
  });

  it('returns undefined from the fetch-based sender helper for empty responses', async () => {
    const fetchImplementation = vi.fn(async () => ({
      ok: true,
      status: 204,
      statusText: 'No Content',
      headers: {
        get: () => null,
      },
      text: async () => '',
    }));
    const sender = generatedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: fetchImplementation,
    });
    const accessor = generatedModule.create_DeleteItem_accessor(sender);

    const result = await accessor._delete({
      id: '42',
    });

    expect(result).toBeUndefined();
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it('omits empty fetch init fields when no defaults or request headers are present', async () => {
    const fetchImplementation = vi.fn(
      async (input: URL, init?: RequestInit) => {
        expect(String(input)).toBe('https://api.example.com/items/42');
        expect(init).toEqual({
          method: 'DELETE',
        });

        return {
          ok: true,
          status: 204,
          statusText: 'No Content',
          headers: {
            get: () => null,
          },
          text: async () => '',
        };
      }
    );
    const sender = generatedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: fetchImplementation,
    });
    const accessor = generatedModule.create_DeleteItem_accessor(sender);

    await expect(
      accessor._delete({
        id: '42',
      })
    ).resolves.toBeUndefined();

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it('retains underscores in normalized parameter names', () => {
    const argumentsBlock = getInterfaceBlock(
      edgeCaseGeneratedSource,
      'GetUser_get_arguments'
    );
    expect(argumentsBlock).toContain('user_id: string;');
  });

  it('renames duplicated parameter-only names and emits warnings without a request body', async () => {
    const argumentsBlock = getInterfaceBlock(
      edgeCaseGeneratedSource,
      'GetDuplicateParameters_get_arguments'
    );
    expect(argumentsBlock).toContain('path_id: string;');
    expect(argumentsBlock).toContain('query_id?: string;');
    expect(argumentsBlock).toContain('header_id?: string;');
    expect(argumentsBlock).toContain("@remarks Duplicated argument name: 'id'");
    expect(edgeCaseGeneratedSource).toContain(
      'readonly get: (args: GetDuplicateParameters_get_arguments, options?: AccessorOptions | undefined) => Promise<CollisionValueResponse>;'
    );

    const warnings = getEdgeCaseWarnings('GetDuplicateParameters');
    expect(warnings).toHaveLength(3);
    expect(warnings).toEqual(
      expect.arrayContaining([
        "Renamed path parameter 'id' to 'path_id' in accessor 'GetDuplicateParameters' method 'get' because generated argument name 'id' was duplicated.",
        "Renamed query parameter 'id' to 'query_id' in accessor 'GetDuplicateParameters' method 'get' because generated argument name 'id' was duplicated.",
        "Renamed header parameter 'id' to 'header_id' in accessor 'GetDuplicateParameters' method 'get' because generated argument name 'id' was duplicated.",
      ])
    );

    const sender = vi.fn(async (request: unknown) => request);
    const accessor =
      edgeCaseGeneratedModule.create_GetDuplicateParameters_accessor(sender);

    await accessor.get({
      path_id: 'route-42',
      query_id: 'query-42',
      header_id: 'header-42',
    });

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'GetDuplicateParameters.get',
        method: 'GET',
        url: '/items/route-42?id=query-42',
        headers: {
          id: 'header-42',
          accept: 'application/json',
        },
        body: undefined,
        responseContentType: 'application/json',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('renames parameters whose normalized names collide and preserves each wire name', async () => {
    const argumentsBlock = getInterfaceBlock(
      edgeCaseGeneratedSource,
      'GetNormalizedCollision_get_arguments'
    );
    expect(argumentsBlock).toContain('query_xApiKey?: string;');
    expect(argumentsBlock).toContain('header_xApiKey?: string;');
    expect(argumentsBlock).toContain(
      "@remarks Duplicated argument name: 'xApiKey'"
    );

    const warnings = getEdgeCaseWarnings('GetNormalizedCollision');
    expect(warnings).toHaveLength(2);
    expect(warnings).toEqual(
      expect.arrayContaining([
        "Renamed query parameter 'x-api-key' to 'query_xApiKey' in accessor 'GetNormalizedCollision' method 'get' because generated argument name 'xApiKey' was duplicated.",
        "Renamed header parameter 'x.api.key' to 'header_xApiKey' in accessor 'GetNormalizedCollision' method 'get' because generated argument name 'xApiKey' was duplicated.",
      ])
    );

    const sender = vi.fn(async (request: unknown) => request);
    const accessor =
      edgeCaseGeneratedModule.create_GetNormalizedCollision_accessor(sender);

    await accessor.get({
      query_xApiKey: 'query-key',
      header_xApiKey: 'header-key',
    });

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'GetNormalizedCollision.get',
        method: 'GET',
        url: '/normalized-collision?x-api-key=query-key',
        headers: {
          'x.api.key': 'header-key',
          accept: 'application/json',
        },
        body: undefined,
        responseContentType: 'application/json',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('does not rename parameters when normalization keeps their names distinct', async () => {
    const argumentsBlock = getInterfaceBlock(
      edgeCaseGeneratedSource,
      'GetNormalizedDistinct_get_arguments'
    );
    expect(argumentsBlock).toContain('user_id: string;');
    expect(argumentsBlock).toContain('userId?: string;');
    expect(argumentsBlock).toContain('tenantId?: string;');
    expect(argumentsBlock).not.toContain('path_user_id');
    expect(argumentsBlock).not.toContain('query_userId');
    expect(argumentsBlock).not.toContain('header_tenantId');
    expect(argumentsBlock).not.toContain('@remarks Duplicated argument name');
    expect(getEdgeCaseWarnings('GetNormalizedDistinct')).toEqual([]);

    const sender = vi.fn(async (request: unknown) => request);
    const accessor =
      edgeCaseGeneratedModule.create_GetNormalizedDistinct_accessor(sender);

    await accessor.get({
      user_id: 'route-42',
      userId: 'query-42',
      tenantId: 'header-42',
    });

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'GetNormalizedDistinct.get',
        method: 'GET',
        url: '/normalized-distinct/route-42?user-id=query-42',
        headers: {
          'tenant.id': 'header-42',
          accept: 'application/json',
        },
        body: undefined,
        responseContentType: 'application/json',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('renames duplicated flattened parameter names, keeps wire names, and excludes them from the request body', async () => {
    const argumentsBlock = getInterfaceBlock(
      edgeCaseGeneratedSource,
      'CreateItem_post_arguments'
    );
    expect(argumentsBlock).toContain('path_id: string;');
    expect(argumentsBlock).toContain('query_xApiKey?: string;');
    expect(argumentsBlock).toContain('header_xApiKey?: string;');
    expect(argumentsBlock).toContain("@remarks Duplicated argument name: 'id'");
    expect(argumentsBlock).toContain(
      "@remarks Duplicated argument name: 'xApiKey'"
    );
    expect(edgeCaseGeneratedSource).toContain(
      'readonly post: (args: CreateCollisionItemRequest & CreateItem_post_arguments, options?: AccessorOptions | undefined) => Promise<CollisionValueResponse>;'
    );

    const warnings = getEdgeCaseWarnings('CreateItem');
    expect(warnings).toHaveLength(3);
    expect(warnings).toEqual(
      expect.arrayContaining([
        "Renamed path parameter 'id' to 'path_id' in accessor 'CreateItem' method 'post' because generated argument name 'id' was duplicated.",
        "Renamed query parameter 'x-api-key' to 'query_xApiKey' in accessor 'CreateItem' method 'post' because generated argument name 'xApiKey' was duplicated.",
        "Renamed header parameter 'x-api-key' to 'header_xApiKey' in accessor 'CreateItem' method 'post' because generated argument name 'xApiKey' was duplicated.",
      ])
    );

    const sender = vi.fn(async (request: unknown) => request);
    const accessor = edgeCaseGeneratedModule.create_CreateItem_accessor(sender);

    await accessor.post({
      id: 'body-42',
      xApiKey: 'body-key',
      name: 'alpha',
      path_id: 'route-42',
      query_xApiKey: 'query-key',
      header_xApiKey: 'header-key',
    });

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'CreateItem.post',
        method: 'POST',
        url: '/items/route-42?x-api-key=query-key',
        headers: {
          'x-api-key': 'header-key',
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: {
          id: 'body-42',
          xApiKey: 'body-key',
          name: 'alpha',
        },
        responseContentType: 'application/json',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('hoists excluded request body property names into generated constants', async () => {
    expect(edgeCaseGeneratedSource).toContain(
      'const modestaExcludedProperties_CreateItem_post = ["path_id","query_xApiKey","header_xApiKey"];'
    );
    expect(edgeCaseGeneratedSource).toContain(
      'body: modestaExcludeProperties(args, modestaExcludedProperties_CreateItem_post),'
    );
  });

  it('uses primitive request bodies directly when no flattened parameters are present', async () => {
    expect(edgeCaseGeneratedSource).toContain(
      'readonly post: (args: string, options?: AccessorOptions | undefined) => Promise<void>;'
    );
    expect(edgeCaseGeneratedSource).not.toContain(
      'CreateText_post_request_envelope'
    );

    const sender = vi.fn(async (request: unknown) => request);
    const accessor = edgeCaseGeneratedModule.create_CreateText_accessor(sender);

    await accessor.post('alpha');

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'CreateText.post',
        method: 'POST',
        url: '/text',
        headers: {
          'content-type': 'text/plain',
        },
        body: 'alpha',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('wraps primitive request bodies in an envelope while intersecting flattened parameters', async () => {
    const requestEnvelopeBlock = getInterfaceBlock(
      edgeCaseGeneratedSource,
      'CreateScopedText_post_request_envelope'
    );
    expect(requestEnvelopeBlock).toContain('readonly body: string;');
    expect(edgeCaseGeneratedSource).toContain(
      'readonly post: (args: CreateScopedText_post_request_envelope & CreateScopedText_post_arguments, options?: AccessorOptions | undefined) => Promise<void>;'
    );

    const sender = vi.fn(async (request: unknown) => request);
    const accessor =
      edgeCaseGeneratedModule.create_CreateScopedText_accessor(sender);

    await accessor.post({
      scope: 'alpha',
      xTraceId: 'trace-42',
      body: 'payload',
    });

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'CreateScopedText.post',
        method: 'POST',
        url: '/text/alpha',
        headers: {
          'x-trace-id': 'trace-42',
          'content-type': 'text/plain',
        },
        body: 'payload',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('uses array request bodies directly when no flattened parameters are present', async () => {
    expect(edgeCaseGeneratedSource).toContain(
      'readonly post: (args: ReadonlyArray<number>, options?: AccessorOptions | undefined) => Promise<void>;'
    );
    expect(edgeCaseGeneratedSource).not.toContain(
      'CreateNumberList_post_request_envelope'
    );
    expect(edgeCaseGeneratedSource).toContain(
      [
        '  } as CreateItem | CreateItem_with_context<TAccessorContext>;',
        '}',
        '',
        '/** CreateNumberList accessor definition. */',
      ].join('\n')
    );
    expect(edgeCaseGeneratedSource).not.toContain(
      [
        '  } as CreateItem | CreateItem_with_context<TAccessorContext>;',
        '}',
        '',
        '',
        '',
        '/** CreateNumberList accessor definition. */',
      ].join('\n')
    );

    const sender = vi.fn(async (request: unknown) => request);
    const accessor =
      edgeCaseGeneratedModule.create_CreateNumberList_accessor(sender);

    await accessor.post([1, 2, 3]);

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'CreateNumberList.post',
        method: 'POST',
        url: '/number-list',
        headers: {
          'content-type': 'application/json',
        },
        body: [1, 2, 3],
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('wraps array request bodies in an envelope while intersecting flattened parameters', async () => {
    const requestEnvelopeBlock = getInterfaceBlock(
      edgeCaseGeneratedSource,
      'UpdateNumbers_put_request_envelope'
    );
    expect(requestEnvelopeBlock).toContain(
      'readonly body: ReadonlyArray<number>;'
    );
    expect(edgeCaseGeneratedSource).toContain(
      'readonly put: (args: UpdateNumbers_put_request_envelope & UpdateNumbers_put_arguments, options?: AccessorOptions | undefined) => Promise<void>;'
    );

    const sender = vi.fn(async (request: unknown) => request);
    const accessor =
      edgeCaseGeneratedModule.create_UpdateNumbers_accessor(sender);

    await accessor.put({
      scope: 'global',
      dryRun: true,
      body: [1, 2, 3],
    });

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'UpdateNumbers.put',
        method: 'PUT',
        url: '/numbers/global?dry-run=true',
        headers: {
          'content-type': 'application/json',
        },
        body: [1, 2, 3],
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('returns projected response headers when the response body is absent', async () => {
    expect(edgeCaseGeneratedSource).toContain(
      'const modestaEmptyResponseHeaders: readonly AccessorResponseHeaderDescriptor[] = [];'
    );
    expect(edgeCaseGeneratedSource).toContain(
      'responseHeaders: modestaEmptyResponseHeaders,'
    );
    expect(edgeCaseGeneratedSource).toContain(
      'const modestaResponseHeaders_GetToken_get: readonly AccessorResponseHeaderDescriptor[] = ['
    );
    expect(edgeCaseGeneratedSource).toContain(
      'responseHeaders: modestaResponseHeaders_GetToken_get,'
    );

    const responseHeadersBlock = getInterfaceBlock(
      edgeCaseGeneratedSource,
      'GetToken_get_response_headers'
    );
    expect(responseHeadersBlock).toContain('xRequestId?: string;');
    expect(edgeCaseGeneratedSource).toContain(
      'readonly get: (options?: AccessorOptions | undefined) => Promise<GetToken_get_response_headers>;'
    );

    const sender = edgeCaseGeneratedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) => (name === 'x-request-id' ? 'req-42' : null),
        },
        text: async () => '',
      })),
    });
    const accessor = edgeCaseGeneratedModule.create_GetToken_accessor(sender);

    await expect(accessor.get()).resolves.toEqual({
      xRequestId: 'req-42',
    });
  });

  it('preserves URL encoding for path and query parameters in generated sender descriptors', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor =
      edgeCaseGeneratedModule.create_GetNormalizedDistinct_accessor(sender);

    await accessor.get({
      tenantId: 'tenant#1',
      userId: 'query &+?=',
      user_id: 'route/42 alpha?',
    });

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'GetNormalizedDistinct.get',
        method: 'GET',
        url: '/normalized-distinct/route%2F42%20alpha%3F?user-id=query+%26%2B%3F%3D',
        headers: {
          'tenant.id': 'tenant#1',
          accept: 'application/json',
        },
        body: undefined,
        responseContentType: 'application/json',
        responseHeaders: [],
        wrapResponseBody: false,
      },
      undefined
    );
  });

  it('returns primitive response bodies directly when response headers are absent', async () => {
    expect(edgeCaseGeneratedSource).toContain(
      'readonly get: (options?: AccessorOptions | undefined) => Promise<string>;'
    );
    expect(edgeCaseGeneratedSource).not.toContain(
      'GetPlainMessage_get_response_body'
    );
    expect(edgeCaseGeneratedSource).not.toContain(
      'GetPlainMessage_get_response_headers'
    );

    const sender = edgeCaseGeneratedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => null,
        },
        text: async () => 'hello',
      })),
    });
    const accessor =
      edgeCaseGeneratedModule.create_GetPlainMessage_accessor(sender);

    await expect(accessor.get()).resolves.toBe('hello');
  });

  it('returns array response bodies directly when response headers are absent', async () => {
    expect(edgeCaseGeneratedSource).toContain(
      'readonly get: (options?: AccessorOptions | undefined) => Promise<ReadonlyArray<number>>;'
    );
    expect(edgeCaseGeneratedSource).not.toContain(
      'GetNumbers_get_response_body'
    );
    expect(edgeCaseGeneratedSource).not.toContain(
      'GetNumbers_get_response_headers'
    );

    const sender = edgeCaseGeneratedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) =>
            name === 'content-type' ? 'application/json' : null,
        },
        json: async () => [1, 2, 3],
      })),
    });
    const accessor = edgeCaseGeneratedModule.create_GetNumbers_accessor(sender);

    await expect(accessor.get()).resolves.toEqual([1, 2, 3]);
  });

  it('merges object response bodies with projected response headers', async () => {
    expect(edgeCaseGeneratedSource).toContain(
      'readonly get: (options?: AccessorOptions | undefined) => Promise<DocumentResponse & GetDocument_get_response_headers>;'
    );

    const responseBody = { value: 'alpha' };
    const sender = edgeCaseGeneratedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) =>
            name === 'content-type'
              ? 'application/json'
              : name === 'etag'
                ? 'etag-42'
                : null,
        },
        json: async () => responseBody,
      })),
    });
    const accessor =
      edgeCaseGeneratedModule.create_GetDocument_accessor(sender);

    const result = await accessor.get();

    expect(result).toBe(responseBody);
    expect(result).toEqual({
      value: 'alpha',
      etag: 'etag-42',
    });
  });

  it('wraps primitive response bodies when response headers are also projected', async () => {
    const responseEnvelopeBlock = getInterfaceBlock(
      edgeCaseGeneratedSource,
      'GetMessage_get_response_body'
    );
    expect(responseEnvelopeBlock).toContain('readonly body: string;');
    expect(edgeCaseGeneratedSource).toContain(
      'readonly get: (options?: AccessorOptions | undefined) => Promise<GetMessage_get_response_body & GetMessage_get_response_headers>;'
    );

    const sender = edgeCaseGeneratedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) => (name === 'etag' ? 'etag-99' : null),
        },
        text: async () => 'hello',
      })),
    });
    const accessor = edgeCaseGeneratedModule.create_GetMessage_accessor(sender);

    await expect(accessor.get()).resolves.toEqual({
      body: 'hello',
      etag: 'etag-99',
    });
  });

  it('wraps array response bodies when response headers are also projected', async () => {
    const responseEnvelopeBlock = getInterfaceBlock(
      edgeCaseGeneratedSource,
      'GetNumberMessage_get_response_body'
    );
    expect(responseEnvelopeBlock).toContain(
      'readonly body: ReadonlyArray<number>;'
    );
    expect(edgeCaseGeneratedSource).toContain(
      'readonly get: (options?: AccessorOptions | undefined) => Promise<GetNumberMessage_get_response_body & GetNumberMessage_get_response_headers>;'
    );

    const sender = edgeCaseGeneratedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) =>
            name === 'content-type'
              ? 'application/json'
              : name === 'etag'
                ? 'etag-100'
                : null,
        },
        json: async () => [1, 2, 3],
      })),
    });
    const accessor =
      edgeCaseGeneratedModule.create_GetNumberMessage_accessor(sender);

    await expect(accessor.get()).resolves.toEqual({
      body: [1, 2, 3],
      etag: 'etag-100',
    });
  });

  it('renames duplicated response field names and emits warnings for response headers', async () => {
    const responseHeadersBlock = getInterfaceBlock(
      edgeCaseGeneratedSource,
      'GetResponseCollision_get_response_headers'
    );
    expect(responseHeadersBlock).toContain('header_etag?: string;');
    expect(responseHeadersBlock).toContain('header_xApiKey?: string;');
    expect(responseHeadersBlock).toContain('header_xApiKey_2?: string;');
    expect(responseHeadersBlock).toContain(
      "@remarks Duplicated response field name: 'etag'"
    );
    expect(responseHeadersBlock).toContain(
      "@remarks Duplicated response field name: 'xApiKey'"
    );

    const warnings = getEdgeCaseWarnings('GetResponseCollision');
    expect(warnings).toEqual(
      expect.arrayContaining([
        "Renamed response header 'etag' to 'header_etag' in accessor 'GetResponseCollision' method 'get' because generated response field name 'etag' was duplicated.",
        "Renamed response header 'x-api-key' to 'header_xApiKey' in accessor 'GetResponseCollision' method 'get' because generated response field name 'xApiKey' was duplicated.",
        "Renamed response header 'x.api.key' to 'header_xApiKey_2' in accessor 'GetResponseCollision' method 'get' because generated response field name 'xApiKey' was duplicated.",
      ])
    );

    const sender = edgeCaseGeneratedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) =>
            name === 'content-type'
              ? 'application/json'
              : name === 'etag'
                ? 'header-tag'
                : name === 'x-api-key'
                  ? 'query-tag'
                  : name === 'x.api.key'
                    ? 'header-tag-2'
                    : null,
        },
        json: async () => ({ etag: 'body-tag' }),
      })),
    });
    const accessor =
      edgeCaseGeneratedModule.create_GetResponseCollision_accessor(sender);

    await expect(accessor.get()).resolves.toEqual({
      etag: 'body-tag',
      header_etag: 'header-tag',
      header_xApiKey: 'query-tag',
      header_xApiKey_2: 'header-tag-2',
    });
  });

  it('parses projected array response headers with trimmed numeric items', async () => {
    const responseHeadersBlock = getInterfaceBlock(
      edgeCaseGeneratedSource,
      'GetRateLimits_get_response_headers'
    );
    expect(responseHeadersBlock).toContain(
      'xRateLimitHistory?: ReadonlyArray<number>;'
    );

    const sender = edgeCaseGeneratedModule.createFetchSender({
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) =>
            name === 'x-rate-limit-history' ? '7, 5, 3' : null,
        },
        text: async () => '',
      })),
    });
    const accessor =
      edgeCaseGeneratedModule.create_GetRateLimits_accessor(sender);

    await expect(accessor.get()).resolves.toEqual({
      xRateLimitHistory: [7, 5, 3],
    });
  });

  it('emits fetch helper options without signal in init', () => {
    expect(generatedSource).toContain(
      "init?: Omit<RequestInit, 'body' | 'headers' | 'method' | 'signal'> | undefined;"
    );
  });
});
