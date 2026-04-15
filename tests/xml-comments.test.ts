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
        ' * @param signal Abort signal used to cancel the request.',
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
        ' * @param signal Abort signal used to cancel the request.',
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
        ' * @param signal Abort signal used to cancel the request.',
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

    expect(
      getInterfaceDocumentation(generatedSource, 'AccessorRequestDescriptor')
    ).toBe('/** Prepared request descriptor used by generated accessors. */');
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

    expect(getTypeAliasDocumentation(generatedSource, 'AccessorSender')).toBe(
      [
        '/**',
        ' * Sender function used by generated accessors.',
        ' * @typeParam TResponse Response payload type.',
        ' * @typeParam TRequestBody Request body payload type.',
        ' * @param request Prepared request descriptor.',
        ' * @param signal Abort signal used to cancel the request.',
        ' * @returns Promise that resolves to the typed response payload.',
        ' */',
      ].join('\n')
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

    expect(getConstDocumentation(generatedSource, 'createFetchSender')).toBe(
      [
        '/**',
        ' * Creates a sender implementation backed by the fetch API.',
        ' * @param options Options that configure the fetch-based sender.',
        ' * @returns Sender implementation that executes requests via the fetch API.',
        ' * @remarks When `options.fetch` is omitted, `globalThis.fetch` must be available.',
        ' */',
      ].join('\n')
    );
    expect(
      getConstDocumentation(generatedSource, 'create_xml_comments_accessor')
    ).toBe(
      [
        '/**',
        ' * Creates a xml_comments accessor implementation.',
        ' * @param sender Sender implementation used to execute generated requests.',
        ' * @returns xml_comments accessor implementation bound to the provided sender.',
        ' */',
      ].join('\n')
    );
  });

  it('renders parameter comments on generated parameter members', () => {
    const queryParametersBlock = getInterfaceBlock(
      generatedSource,
      'xml_comments_get_documented_query_parameters'
    );
    expect(queryParametersBlock).toContain('filter?: string;');
    expectMemberDocumentation(
      queryParametersBlock,
      'filter',
      '/** Filter text from XML parameter comments. */'
    );
  });

  it('renders body parameter comments on args.body and keeps schema comments on the request type', () => {
    const argumentsBlock = getInterfaceBlock(
      generatedSource,
      'xml_comments_post_documented_arguments'
    );
    const requestBodyBlock = getInterfaceBlock(
      generatedSource,
      'xml_comments_post_documented_request_body'
    );

    expect(argumentsBlock).toContain(
      'body?: xml_comments_post_documented_request_body;'
    );
    expectMemberDocumentation(
      argumentsBlock,
      'body',
      '/** Documented request body. */'
    );
    expect(
      getInterfaceDocumentation(
        generatedSource,
        'xml_comments_post_documented_request_body'
      )
    ).toBe('/** Request schema described by XML comments. */');
    expectMemberDocumentation(
      requestBodyBlock,
      'identifier',
      '/** The request identifier. */'
    );
    expectMemberDocumentation(
      requestBodyBlock,
      'optionalLabel',
      '/** An optional request label. */'
    );
  });

  it('renders response comments on generated response types', () => {
    expect(
      getInterfaceDocumentation(
        generatedSource,
        'xml_comments_get_documented_response'
      )
    ).toBe('/** XML documented success response. */');
    expect(
      getInterfaceDocumentation(
        generatedSource,
        'xml_comments_post_documented_response'
      )
    ).toBe('/** XML documented create response. */');
    expect(
      getInterfaceDocumentation(
        generatedSource,
        'xml_comments_get_returns_only_response'
      )
    ).toBe('/** OK */');
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
