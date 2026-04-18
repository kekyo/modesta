// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { beforeAll, describe, expect, it } from 'vitest';
import { generateAccessorSource } from '../src/generator';
import {
  fetchSwaggerJsonFromProject,
  saveArtifactText,
  SwaggerFixtureProject,
} from './support/harness';
import {
  getConstDocumentation,
  expectMemberDocumentation,
  expectMethodDocumentation,
  getFunctionDocumentation,
  getInterfaceBlock,
  getInterfaceDocumentation,
  getTypeAliasDocumentation,
} from './support/source-assertions';

const xmlCommentsProject: SwaggerFixtureProject = {
  csprojPropertyLines: [
    '<GenerateDocumentationFile>true</GenerateDocumentationFile>',
    '<NoWarn>$(NoWarn);1591</NoWarn>',
  ],
  files: {
    'Program.cs': [
      'using System.Reflection;',
      '',
      'var builder = WebApplication.CreateBuilder(args);',
      'builder.Services.AddControllers();',
      'builder.Services.AddEndpointsApiExplorer();',
      'builder.Services.AddSwaggerGen(options =>',
      '    {',
      '        options.SupportNonNullableReferenceTypes();',
      '        options.NonNullableReferenceTypesAsRequired();',
      '        var xmlFilename = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";',
      '        options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xmlFilename));',
      '    });',
      'var app = builder.Build();',
      'app.UseSwagger();',
      'app.MapControllers();',
      'app.Run();',
      '',
    ].join('\n'),
    'Controllers/XmlCommentsController.cs': [
      'using Microsoft.AspNetCore.Mvc;',
      'using Fixture.Models;',
      '',
      'namespace Fixture.Controllers;',
      '',
      '[ApiController]',
      '[Route("xml-comments")]',
      'public sealed class XmlCommentsController : ControllerBase',
      '{',
      '    /// <summary>',
      '    /// Returns a documented response.',
      '    /// </summary>',
      '    /// <remarks>',
      '    /// First detail line.',
      '    /// Second detail line.',
      '    /// </remarks>',
      '    /// <param name="filter">Filter text from XML parameter comments.</param>',
      '    /// <response code="200">XML documented success response.</response>',
      '    [HttpGet("documented")]',
      '    public ActionResult<DocumentedEnvelope> GetDocumented([FromQuery] string filter) =>',
      '        Ok(new DocumentedEnvelope',
      '        {',
      '            Title = filter,',
      '            OptionalNote = null,',
      '        });',
      '',
      '    /// <summary>',
      '    /// Creates a documented response.',
      '    /// </summary>',
      '    /// <param name="request">Documented request body.</param>',
      '    /// <response code="200">XML documented create response.</response>',
      '    [HttpPost("documented")]',
      '    public ActionResult<DocumentedEnvelope> Create([FromBody] CreateDocumentedRequest request) =>',
      '        Ok(new DocumentedEnvelope',
      '        {',
      '            Title = request.Identifier,',
      '            OptionalNote = request.OptionalLabel,',
      '        });',
      '',
      '    /// <summary>',
      '    /// Returns a response documented only by the returns tag.',
      '    /// </summary>',
      '    /// <returns>Returns-only XML comment.</returns>',
      '    [HttpGet("returns-only")]',
      '    public ActionResult<DocumentedEnvelope> GetReturnsOnly() =>',
      '        Ok(new DocumentedEnvelope',
      '        {',
      '            Title = "returns-only",',
      '            OptionalNote = null,',
      '        });',
      '}',
      '',
    ].join('\n'),
    'Models/DocumentedEnvelope.cs': [
      'namespace Fixture.Models;',
      '',
      '/// <summary>',
      '/// Envelope described by XML comments.',
      '/// </summary>',
      'public sealed class DocumentedEnvelope',
      '{',
      '    /// <summary>',
      '    /// A required title from XML comments.',
      '    /// </summary>',
      '    public string Title { get; init; } = string.Empty;',
      '',
      '    /// <summary>',
      '    /// An optional note from XML comments.',
      '    /// </summary>',
      '    public string? OptionalNote { get; init; }',
      '}',
      '',
    ].join('\n'),
    'Models/CreateDocumentedRequest.cs': [
      'namespace Fixture.Models;',
      '',
      '/// <summary>',
      '/// Request schema described by XML comments.',
      '/// </summary>',
      'public sealed class CreateDocumentedRequest',
      '{',
      '    /// <summary>',
      '    /// The request identifier.',
      '    /// </summary>',
      '    public string Identifier { get; init; } = string.Empty;',
      '',
      '    /// <summary>',
      '    /// An optional request label.',
      '    /// </summary>',
      '    public string? OptionalLabel { get; init; }',
      '}',
      '',
    ].join('\n'),
  },
};

describe('xml comments integration', () => {
  let swaggerDocument: Record<string, any> = {};
  let generatedSource = '';

  beforeAll(async () => {
    const swaggerJson = await fetchSwaggerJsonFromProject(
      xmlCommentsProject,
      'xml-comments'
    );
    swaggerDocument = JSON.parse(swaggerJson) as Record<string, any>;
    generatedSource = generateAccessorSource({
      document: swaggerJson,
      source: 'swagger.json',
    });
    await saveArtifactText(
      'xml-comments',
      'generated/xml-comments.ts',
      generatedSource
    );
  });

  it('maps XML summary, remarks, param, response, request body, and schema comments into swagger fields', () => {
    const documentedGet = swaggerDocument.paths['/xml-comments/documented'].get;
    expect(documentedGet.summary).toBe('Returns a documented response.');
    expect(documentedGet.description).toBe(
      'First detail line.\nSecond detail line.'
    );
    expect(documentedGet.parameters).toHaveLength(1);
    expect(documentedGet.parameters[0].description).toBe(
      'Filter text from XML parameter comments.'
    );
    expect(documentedGet.responses['200'].description).toBe(
      'XML documented success response.'
    );

    const documentedPost =
      swaggerDocument.paths['/xml-comments/documented'].post;
    expect(documentedPost.requestBody.description).toBe(
      'Documented request body.'
    );
    expect(documentedPost.responses['200'].description).toBe(
      'XML documented create response.'
    );

    expect(
      swaggerDocument.components.schemas.DocumentedEnvelope.description
    ).toBe('Envelope described by XML comments.');
    expect(
      swaggerDocument.components.schemas.DocumentedEnvelope.properties.title
        .description
    ).toBe('A required title from XML comments.');
    expect(
      swaggerDocument.components.schemas.CreateDocumentedRequest.description
    ).toBe('Request schema described by XML comments.');
    expect(
      swaggerDocument.components.schemas.CreateDocumentedRequest.properties
        .identifier.description
    ).toBe('The request identifier.');
  });

  it('does not map returns-only XML comments into swagger success response descriptions with Swashbuckle 9.0.1', () => {
    const returnsOnly = swaggerDocument.paths['/xml-comments/returns-only'].get;
    expect(returnsOnly.summary).toBe(
      'Returns a response documented only by the returns tag.'
    );
    expect(returnsOnly.responses['200'].description).toBe('OK');
    expect(returnsOnly.responses['200'].description).not.toBe(
      'Returns-only XML comment.'
    );
  });

  it('renders operation summary and remarks on accessor methods', () => {
    const accessorBlock = getInterfaceBlock(generatedSource, 'xml_comments');

    expectMethodDocumentation(
      accessorBlock,
      'get_documented',
      [
        '/**',
        ' * Returns a documented response.',
        ' *',
        ' * @remarks First detail line.',
        ' * Second detail line.',
        ' * @param args Optional arguments for GET /xml-comments/documented.',
        ' * @param options Additional accessor call options without per-call context.',
        ' * @returns XML documented success response.',
        ' */',
      ].join('\n')
    );
    expectMethodDocumentation(
      accessorBlock,
      'post_documented',
      [
        '/**',
        ' * Creates a documented response.',
        ' * @param args Optional arguments for POST /xml-comments/documented.',
        ' * Request body payload is passed directly as args.',
        ' * Request body: Documented request body.',
        ' * @param options Additional accessor call options without per-call context.',
        ' * @returns XML documented create response.',
        ' */',
      ].join('\n')
    );
    expectMethodDocumentation(
      accessorBlock,
      'get_returns_only',
      [
        '/**',
        ' * Returns a response documented only by the returns tag.',
        ' * @param options Additional accessor call options without per-call context.',
        ' * @returns OK',
        ' */',
      ].join('\n')
    );
  });

  it('renders detailed docs for shared helper types and factories', () => {
    const requestDescriptorBlock = getInterfaceBlock(
      generatedSource,
      'AccessorRequestDescriptor'
    );
    const fetchSenderOptionsBlock = getInterfaceBlock(
      generatedSource,
      'CreateFetchSenderOptions'
    );
    const modestaPrepareRequestOptionsBlock = getInterfaceBlock(
      generatedSource,
      'ModestaPrepareRequestOptions'
    );
    const modestaPreparedRequestBlock = getInterfaceBlock(
      generatedSource,
      'ModestaPreparedRequest'
    );
    const modestaResponseSourceBlock = getInterfaceBlock(
      generatedSource,
      'ModestaResponseSource'
    );

    expect(
      getInterfaceDocumentation(generatedSource, 'AccessorRequestDescriptor')
    ).toBe(
      [
        '/**',
        ' * Prepared request descriptor used by generated accessors.',
        ' */',
      ].join('\n')
    );
    expect(requestDescriptorBlock).toContain('readonly operationName: string;');
    expect(fetchSenderOptionsBlock).toContain(
      'readonly baseUrl: string | URL;'
    );
    expectMemberDocumentation(
      requestDescriptorBlock,
      'operationName',
      '/** Stable operation name used for diagnostics and tracing. */'
    );
    expectMemberDocumentation(
      requestDescriptorBlock,
      'method',
      '/** HTTP method sent to the endpoint. */'
    );
    expectMemberDocumentation(
      requestDescriptorBlock,
      'url',
      '/** Relative request URL including path and query string. */'
    );
    expectMemberDocumentation(
      requestDescriptorBlock,
      'headers',
      '/** HTTP headers applied to the outgoing request. */'
    );
    expectMemberDocumentation(
      requestDescriptorBlock,
      'body',
      '/** Request body payload passed to the sender. */'
    );
    expectMemberDocumentation(
      requestDescriptorBlock,
      'responseHeaders',
      '/** Response header definitions used to project the sender result. */'
    );
    expectMemberDocumentation(
      requestDescriptorBlock,
      'wrapResponseBody',
      '/** Indicates that primitive or array response bodies must be exposed through a `body` member when response headers are also defined. */'
    );
    expect(getInterfaceDocumentation(generatedSource, 'AccessorOptions')).toBe(
      '/** Shared options accepted by generated accessor methods. */'
    );
    expect(
      getInterfaceDocumentation(
        generatedSource,
        'AccessorOptionsWithoutContext'
      )
    ).toBe(
      '/** Additional options accepted by accessors that do not use per-call context values. */'
    );
    expect(
      getInterfaceDocumentation(generatedSource, 'AccessorOptionsWithContext')
    ).toBe(
      [
        '/**',
        ' * Additional options accepted by accessors that require a per-call context value.',
        ' * @typeParam TAccessorContext Per-call context value type passed to the sender.',
        ' */',
      ].join('\n')
    );
    expect(
      getInterfaceDocumentation(generatedSource, 'xml_comments_with_context')
    ).toBe(
      [
        '/**',
        ' * xml_comments accessor definition that requires per-call context values.',
        ' * @typeParam TAccessorContext Per-call context value type passed to the sender.',
        ' */',
      ].join('\n')
    );

    expect(
      getTypeAliasDocumentation(generatedSource, 'AccessorSenderWithoutContext')
    ).toBe(
      [
        '/**',
        ' * Sender function used by generated accessors that do not require per-call context values.',
        ' * @typeParam TResponse Response payload type.',
        ' * @param request Prepared request descriptor.',
        ' * @param options Additional accessor call options without per-call context.',
        ' * @returns Promise that resolves to the typed response payload.',
        ' */',
      ].join('\n')
    );
    expect(
      getTypeAliasDocumentation(generatedSource, 'AccessorSenderWithContext')
    ).toBe(
      [
        '/**',
        ' * Sender function used by generated accessors that require per-call context values.',
        ' * @typeParam TResponse Response payload type.',
        ' * @typeParam TAccessorContext Per-call context value type passed to the sender.',
        ' * @param request Prepared request descriptor.',
        ' * @param options Additional accessor call options with per-call context.',
        ' * @returns Promise that resolves to the typed response payload.',
        ' */',
      ].join('\n')
    );
    expect(generatedSource).not.toContain(
      'export type AccessorContextArgument'
    );

    expect(
      getInterfaceDocumentation(generatedSource, 'CreateFetchSenderOptions')
    ).toBe('/** Options that configure the fetch-based sender. */');
    expectMemberDocumentation(
      fetchSenderOptionsBlock,
      'baseUrl',
      '/** Base URL used to resolve generated accessor request URLs. */'
    );
    expectMemberDocumentation(
      fetchSenderOptionsBlock,
      'fetch',
      '/** Fetch implementation to use. Defaults to globalThis.fetch. */'
    );
    expectMemberDocumentation(
      fetchSenderOptionsBlock,
      'headers',
      '/** Default headers merged with per-request headers. */'
    );
    expectMemberDocumentation(
      fetchSenderOptionsBlock,
      'init',
      '/** Additional RequestInit values merged into every request. Generated accessors continue to control body, headers, method, and signal. */'
    );
    expect(
      getInterfaceDocumentation(generatedSource, 'ModestaPrepareRequestOptions')
    ).toBe(
      [
        '/**',
        ' * Options that configure request preparation for custom sender implementations.',
        ' */',
      ].join('\n')
    );
    expectMemberDocumentation(
      modestaPrepareRequestOptionsBlock,
      'baseUrl',
      '/** Base URL used to resolve generated accessor request URLs. */'
    );
    expectMemberDocumentation(
      modestaPrepareRequestOptionsBlock,
      'headers',
      '/** Default headers merged with per-request headers. */'
    );
    expect(
      getInterfaceDocumentation(generatedSource, 'ModestaPreparedRequest')
    ).toBe(
      [
        '/**',
        ' * Transport-neutral request values prepared for a sender implementation.',
        ' */',
      ].join('\n')
    );
    expectMemberDocumentation(
      modestaPreparedRequestBlock,
      'url',
      '/** Absolute request URL resolved against the configured base URL. */'
    );
    expectMemberDocumentation(
      modestaPreparedRequestBlock,
      'method',
      '/** HTTP method sent to the endpoint. */'
    );
    expectMemberDocumentation(
      modestaPreparedRequestBlock,
      'headers',
      '/** Merged request headers, or undefined when no headers are present. */'
    );
    expectMemberDocumentation(
      modestaPreparedRequestBlock,
      'body',
      '/** Original request body payload before transport-specific serialization. */'
    );
    expectMemberDocumentation(
      modestaPreparedRequestBlock,
      'signal',
      '/** Abort signal forwarded from the accessor call options. */'
    );
    expect(
      getInterfaceDocumentation(generatedSource, 'ModestaResponseSource')
    ).toBe(
      [
        '/**',
        ' * Transport response values supplied to response projection helpers.',
        ' */',
      ].join('\n')
    );
    expectMemberDocumentation(
      modestaResponseSourceBlock,
      'getHeader',
      '/** Function that reads a response header value by its wire name. */'
    );
    expectMemberDocumentation(
      modestaResponseSourceBlock,
      'body',
      '/** Parsed or transport-native response body value. */'
    );

    expect(getConstDocumentation(generatedSource, 'createFetchSender')).toBe(
      [
        '/**',
        ' * Creates a sender implementation backed by the fetch API.',
        ' * @param options Options that configure the fetch-based sender.',
        ' * @returns Sender implementation that executes requests via the fetch API.',
        ' * @remarks When `options.fetch` is omitted, `globalThis.fetch` must be available.',
        ' * Per-call context values are not accepted by this sender implementation.',
        ' */',
      ].join('\n')
    );
    expect(
      getConstDocumentation(generatedSource, 'modestaPrepareRequest')
    ).toBe(
      [
        '/**',
        ' * Prepares transport-neutral request values for a sender implementation.',
        ' * @param request Prepared request descriptor emitted by the generated accessor.',
        ' * @param accessorOptions Additional accessor call options passed to the sender.',
        ' * @param options Options that configure request preparation.',
        ' * @returns Request values resolved against the configured base URL.',
        ' * @remarks The returned `body` is not serialized. Use `modestaSerializeRequestBody()` when a transport expects a serialized payload.',
        ' */',
      ].join('\n')
    );
    expect(
      getConstDocumentation(generatedSource, 'modestaSerializeRequestBody')
    ).toBe(
      [
        '/**',
        ' * Serializes a request body using the accessor request content type.',
        ' * @param request Prepared request descriptor emitted by the generated accessor.',
        ' * @returns Serialized body value for fetch-style transports, or undefined when the request has no body.',
        ' * @remarks JSON media types are stringified. Other body values are returned as-is.',
        ' */',
      ].join('\n')
    );
    expect(
      getConstDocumentation(generatedSource, 'modestaProjectResponse')
    ).toBe(
      [
        '/**',
        ' * Projects a transport response into the generated accessor response shape.',
        ' * @typeParam TResponse Response payload type.',
        ' * @param request Prepared request descriptor emitted by the generated accessor.',
        ' * @param response Transport response values used to project response headers and body.',
        ' * @returns Response value that matches the generated accessor contract.',
        ' * @remarks Response headers defined by the accessor are parsed and merged into the returned body shape.',
        ' */',
      ].join('\n')
    );
    expect(
      getConstDocumentation(generatedSource, 'modestaReadFetchResponseBody')
    ).toBe(
      [
        '/**',
        ' * Reads a response body from a fetch-compatible response object.',
        ' * @param response Fetch-compatible response object.',
        ' * @returns Parsed response body value, or undefined for empty responses.',
        ' * @remarks JSON media types are parsed with `response.json()`. Other bodies are read with `response.text()`.',
        ' */',
      ].join('\n')
    );
    expect(
      getFunctionDocumentation(generatedSource, 'create_xml_comments_accessor')
    ).toBe(
      [
        '/**',
        ' * Creates a xml_comments accessor implementation.',
        ' * @typeParam TAccessorContext Per-call context value type passed to the sender.',
        ' * @param sender Sender implementation used to execute generated requests.',
        ' * @returns xml_comments accessor implementation bound to the provided sender.',
        ' * @remarks When the sender requires per-call context values, the returned accessor methods require `options.context` for each invocation.',
        ' */',
      ].join('\n')
    );
  });

  it('renders parameter comments on generated parameter members', () => {
    const argumentsBlock = getInterfaceBlock(
      generatedSource,
      'xml_comments_get_documented_arguments'
    );
    expect(argumentsBlock).toContain('filter?: string;');
    expectMemberDocumentation(
      argumentsBlock,
      'filter',
      '/** Filter text from XML parameter comments. */'
    );
  });

  it('renders request body comments on accessor args while using the shared request type directly', () => {
    const accessorBlock = getInterfaceBlock(generatedSource, 'xml_comments');

    expect(accessorBlock).toContain(
      'readonly post_documented: (args?: CreateDocumentedRequest | undefined, options?: AccessorOptionsWithoutContext | undefined) => Promise<DocumentedEnvelope>;'
    );
    expect(generatedSource).not.toContain(
      'xml_comments_post_documented_arguments'
    );
    expect(generatedSource).not.toContain(
      'xml_comments_post_documented_request_body'
    );
  });

  it('uses shared response types directly on accessor signatures', () => {
    const accessorBlock = getInterfaceBlock(generatedSource, 'xml_comments');

    expect(accessorBlock).toContain(
      'readonly get_documented: (args?: xml_comments_get_documented_arguments | undefined, options?: AccessorOptionsWithoutContext | undefined) => Promise<DocumentedEnvelope>;'
    );
    expect(accessorBlock).toContain(
      'readonly post_documented: (args?: CreateDocumentedRequest | undefined, options?: AccessorOptionsWithoutContext | undefined) => Promise<DocumentedEnvelope>;'
    );
    expect(accessorBlock).toContain(
      'readonly get_returns_only: (options?: AccessorOptionsWithoutContext | undefined) => Promise<DocumentedEnvelope>;'
    );
    expect(generatedSource).not.toContain(
      'xml_comments_get_documented_response'
    );
    expect(generatedSource).not.toContain(
      'xml_comments_post_documented_response'
    );
    expect(generatedSource).not.toContain(
      'xml_comments_get_returns_only_response'
    );
  });

  it('renders schema and property comments on generated schema types', () => {
    const envelopeBlock = getInterfaceBlock(
      generatedSource,
      'DocumentedEnvelope'
    );
    const requestBlock = getInterfaceBlock(
      generatedSource,
      'CreateDocumentedRequest'
    );

    expect(
      getInterfaceDocumentation(generatedSource, 'DocumentedEnvelope')
    ).toBe('/** Envelope described by XML comments. */');
    expect(envelopeBlock).toContain('title: string;');
    expect(envelopeBlock).toContain('optionalNote?: string | null;');
    expectMemberDocumentation(
      envelopeBlock,
      'title',
      '/** A required title from XML comments. */'
    );
    expectMemberDocumentation(
      envelopeBlock,
      'optionalNote',
      '/** An optional note from XML comments. */'
    );

    expect(
      getInterfaceDocumentation(generatedSource, 'CreateDocumentedRequest')
    ).toBe('/** Request schema described by XML comments. */');
    expect(requestBlock).toContain('identifier: string;');
    expect(requestBlock).toContain('optionalLabel?: string | null;');
  });
});
