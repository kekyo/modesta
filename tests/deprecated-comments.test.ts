// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateAccessorSourceFromProject,
  SwaggerFixtureProject,
} from './support/harness';
import {
  expectMethodDocumentation,
  getInterfaceBlock,
  getInterfaceDocumentation,
} from './support/source-assertions';

const deprecatedProject: SwaggerFixtureProject = {
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
      '        options.OperationFilter<DeprecatedOperationFilter>();',
      '        options.SchemaFilter<DeprecatedSchemaFilter>();',
      '    });',
      'var app = builder.Build();',
      'app.UseSwagger();',
      '',
      'app.MapGet("/deprecated/{id}", ([FromRoute] string id) =>',
      '    TypedResults.Ok(new DeprecatedEnvelope("active", "legacy")))',
      '    .WithName("DeprecatedOperation");',
      '',
      'app.Run();',
      '',
      'public sealed record DeprecatedEnvelope(string ActiveField, string DeprecatedField);',
      '',
    ].join('\n'),
    'DeprecatedOperationFilter.cs': [
      'using Microsoft.OpenApi.Models;',
      'using Swashbuckle.AspNetCore.SwaggerGen;',
      '',
      'public sealed class DeprecatedOperationFilter : IOperationFilter',
      '{',
      '    public void Apply(OpenApiOperation operation, OperationFilterContext context)',
      '    {',
      '        if (operation.OperationId != "DeprecatedOperation")',
      '        {',
      '            return;',
      '        }',
      '',
      '        operation.Summary = "Deprecated operation summary.";',
      '        operation.Deprecated = true;',
      '',
      '        var parameter = operation.Parameters.Single(parameter => parameter.Name == "id");',
      '        parameter.Description = "Deprecated path parameter.";',
      '        parameter.Deprecated = true;',
      '',
      '        var response = operation.Responses["200"];',
      '        response.Description = "OK";',
      '        response.Headers ??= new Dictionary<string, OpenApiHeader>();',
      '        response.Headers["x-trace-id"] = new OpenApiHeader',
      '        {',
      '            Description = "Deprecated trace header.",',
      '            Deprecated = true,',
      '            Schema = new OpenApiSchema',
      '            {',
      '                Type = "string",',
      '            },',
      '        };',
      '    }',
      '}',
      '',
    ].join('\n'),
    'DeprecatedSchemaFilter.cs': [
      'using Microsoft.OpenApi.Models;',
      'using Swashbuckle.AspNetCore.SwaggerGen;',
      '',
      'public sealed class DeprecatedSchemaFilter : ISchemaFilter',
      '{',
      '    public void Apply(OpenApiSchema schema, SchemaFilterContext context)',
      '    {',
      '        if (context.Type != typeof(DeprecatedEnvelope))',
      '        {',
      '            return;',
      '        }',
      '',
      '        schema.Description = "Deprecated envelope schema.";',
      '        schema.Deprecated = true;',
      '',
      '        schema.Properties["activeField"].Description = "Active field.";',
      '        schema.Properties["deprecatedField"].Description = "Deprecated field.";',
      '        schema.Properties["deprecatedField"].Deprecated = true;',
      '    }',
      '}',
      '',
    ].join('\n'),
  },
};

describe('deprecated comment reflection', () => {
  let generatedSource = '';

  beforeAll(async () => {
    generatedSource = await generateAccessorSourceFromProject({
      artifactName: 'deprecated-comments',
      generatedArtifactPath: 'generated/deprecated-comments.ts',
      project: deprecatedProject,
    });
  });

  it('renders deprecated tags on accessor methods', () => {
    const accessorBlock = getInterfaceBlock(
      generatedSource,
      'DeprecatedOperation'
    );

    expectMethodDocumentation(
      accessorBlock,
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

  it('renders deprecated tags on generated parameter members', () => {
    const argumentsBlock = getInterfaceBlock(
      generatedSource,
      'DeprecatedOperation_get_arguments'
    );

    expect(argumentsBlock).toContain(
      [
        '  /**',
        '   * Deprecated path parameter.',
        '   * @deprecated This argument is deprecated.',
        '   */',
        '  readonly id: string;',
      ].join('\n')
    );
  });

  it('renders deprecated tags on generated response header members', () => {
    const responseHeadersBlock = getInterfaceBlock(
      generatedSource,
      'DeprecatedOperation_get_response_headers'
    );

    expect(responseHeadersBlock).toContain(
      [
        '  /**',
        '   * Deprecated trace header.',
        '   * @deprecated This response header is deprecated.',
        '   */',
        '  readonly xTraceId?: string;',
      ].join('\n')
    );
  });

  it('renders deprecated tags on generated schema definitions', () => {
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
  });

  it('renders deprecated tags on generated schema properties without affecting active fields', () => {
    const schemaBlock = getInterfaceBlock(
      generatedSource,
      'DeprecatedEnvelope'
    );

    expect(schemaBlock).toContain(
      [
        '  /**',
        '   * Deprecated field.',
        '   * @deprecated This property is deprecated.',
        '   */',
        '  readonly deprecatedField: string;',
      ].join('\n')
    );
    expect(schemaBlock).toContain(
      '/** Active field. */\n  readonly activeField: string;'
    );
  });
});
