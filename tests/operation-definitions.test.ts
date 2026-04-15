// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { generateAccessorSource } from '../src/generator';
import {
  generateAccessorSourceFromProject,
  SwaggerFixtureProject,
  transpileGeneratedSource,
} from './support/harness';
import {
  getInterfaceBlock,
  getTypeAliasStatement,
} from './support/source-assertions';

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
      'app.MapPost("/body", ([FromBody] CreateItemRequest request) =>',
      '    TypedResults.Ok(new SimpleRecord(request.Name, "body")))',
      '    .WithName("CreateItem");',
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

describe('operation definition generation', () => {
  let generatedSource = '';
  let generatedModule: Record<string, any>;

  beforeAll(async () => {
    generatedSource = await generateAccessorSourceFromProject({
      artifactName: 'operation-definitions',
      generatedArtifactPath: 'generated/operation-definitions.ts',
      project: operationProject,
    });
    generatedModule = await transpileGeneratedSource(generatedSource);
  });

  it('flattens route parameter definitions into argument groups', () => {
    const argumentsBlock = getInterfaceBlock(
      generatedSource,
      'GetRouteValue_get_arguments'
    );

    expect(argumentsBlock).toContain('id: string;');
    expect(argumentsBlock).not.toContain('pathParameters:');
  });

  it('separates query attribute definitions with renamed names', () => {
    const queryParametersBlock = getInterfaceBlock(
      generatedSource,
      'GetPage_get_query_parameters'
    );

    expect(queryParametersBlock).toContain("'page-size': number;");
  });

  it('separates header attribute definitions with renamed names', () => {
    const headerParametersBlock = getInterfaceBlock(
      generatedSource,
      'GetHeaderValue_get_header_parameters'
    );

    expect(headerParametersBlock).toContain("'x-api-key': string;");
  });

  it('separates body parameter definitions', () => {
    const requestBodyBlock = getInterfaceBlock(
      generatedSource,
      'CreateItem_post_request_body'
    );

    expect(requestBodyBlock).toContain('name: string;');
  });

  it('separates array return type definitions', () => {
    const listItemsResponse = getTypeAliasStatement(
      generatedSource,
      'ListItems_get_response'
    );

    expect(listItemsResponse).toContain('Array<{');
    expect(generatedSource).toMatch(
      /export type ListItems_get_response = Array<\{[\s\S]*id: string;[\s\S]*source: string;[\s\S]*\}>;/u
    );
  });

  it('separates dictionary return type definitions', () => {
    const dictionaryResponseBlock = getInterfaceBlock(
      generatedSource,
      'MapItems_get_response'
    );

    expect(dictionaryResponseBlock).toContain('[key: string]: SimpleRecord;');
  });

  it('separates void return type definitions', () => {
    expect(
      getTypeAliasStatement(generatedSource, 'DeleteItem_delete_response')
    ).toBe('export type DeleteItem_delete_response = void;');
    expect(generatedSource).toContain(
      '_delete: (args: DeleteItem_delete_arguments, signal?: AbortSignal | undefined) => Promise<void>;'
    );
  });

  it('omits args from no-argument accessor signatures', () => {
    expect(generatedSource).toContain(
      'get: (signal?: AbortSignal | undefined) => Promise<ListItems_get_response>;'
    );
    expect(generatedSource).not.toContain(
      'get: (args?: ListItems_get_arguments | undefined, signal?: AbortSignal | undefined) => Promise<ListItems_get_response>;'
    );
  });

  it('uses a helper type for bound accessor context', () => {
    expect(
      getTypeAliasStatement(generatedSource, 'AccessorContextArgument')
    ).toBe(
      [
        'export type AccessorContextArgument<TContext> = [TContext] extends [undefined]',
        '    ? [context?: TContext]',
        '    : [context: TContext];',
      ].join('\n')
    );
    expect(generatedSource).toContain(
      [
        'export const create_GetRouteValue_accessor = <TContext>(',
        '  sender: AccessorSender<TContext>,',
        '  ...[context]: AccessorContextArgument<TContext>',
        '): GetRouteValue => ({',
      ].join('\n')
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
      signal
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
      },
      undefined,
      signal
    );
  });

  it('builds sender descriptors for query parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_GetPage_accessor(sender);

    await accessor.get({
      queryParameters: {
        'page-size': 20,
      },
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
      },
      undefined,
      undefined
    );
  });

  it('builds sender descriptors for operations without arguments', async () => {
    const sender = vi.fn(
      async (request: unknown, context: unknown, signal: unknown) => ({
        request,
        context,
        signal,
      })
    );
    const accessor = generatedModule.create_ListItems_accessor(sender);
    const signal = new AbortController().signal;

    await accessor.get(signal);

    expect(sender).toHaveBeenCalledWith(
      {
        operationName: 'ListItems.get',
        method: 'GET',
        url: '/array',
        headers: {
          accept: 'application/json',
        },
        body: undefined,
      },
      undefined,
      signal
    );
  });

  it('builds sender descriptors for header parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_GetHeaderValue_accessor(sender);

    await accessor.get({
      headerParameters: {
        'x-api-key': 'secret',
      },
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
      },
      undefined,
      undefined
    );
  });

  it('builds sender descriptors for body parameters', async () => {
    const sender = vi.fn(async (request: unknown) => request);
    const accessor = generatedModule.create_CreateItem_accessor(sender);

    await accessor.post({
      body: {
        name: 'alpha',
      },
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
      },
      undefined,
      undefined
    );
  });

  it('passes bound context values to sender calls', async () => {
    const sender = vi.fn(
      async (_request: unknown, context: unknown) => context
    );
    const accessor = generatedModule.create_DeleteItem_accessor(sender, {
      traceId: 'trace-42',
    });

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
      },
      {
        traceId: 'trace-42',
      },
      undefined
    );
  });

  it('provides a fetch-based sender helper', async () => {
    const signal = new AbortController().signal;
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
          body: undefined,
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
          text: async () => JSON.stringify({ id: '42', source: 'route' }),
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
      signal
    );

    expect(result).toEqual({
      id: '42',
      source: 'route',
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
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

  it('fails when flattened path parameter names collide with request body members', () => {
    expect(() =>
      generateAccessorSource({
        document: {
          openapi: '3.0.3',
          info: {
            title: 'Argument collision',
            version: '1.0.0',
          },
          paths: {
            '/items/{body}': {
              post: {
                operationId: 'CreateItem',
                parameters: [
                  {
                    in: 'path',
                    name: 'body',
                    required: true,
                    schema: {
                      type: 'string',
                    },
                  },
                ],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['name'],
                        properties: {
                          name: {
                            type: 'string',
                          },
                        },
                      },
                    },
                  },
                },
                responses: {
                  '200': {
                    description: 'OK',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          required: ['value'],
                          properties: {
                            value: {
                              type: 'string',
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
    ).toThrow(
      /Generated argument member 'body' in accessor 'CreateItem' method 'post' is ambiguous/
    );
  });

  it('emits fetch helper options without signal in init', () => {
    expect(generatedSource).toContain(
      "init?: Omit<RequestInit, 'body' | 'headers' | 'method' | 'signal'> | undefined;"
    );
  });
});
