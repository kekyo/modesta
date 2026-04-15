// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateAccessorSourceFromProject,
  SwaggerFixtureProject,
} from './support/harness';

const nullabilityFiles = {
  'Controllers/NullabilityController.cs': [
    'using Microsoft.AspNetCore.Mvc;',
    'using Fixture.Models;',
    '',
    'namespace Fixture.Controllers;',
    '',
    '[ApiController]',
    '[Route("nullability")]',
    'public sealed class NullabilityController : ControllerBase',
    '{',
    '    [HttpGet]',
    '    public ActionResult<NullabilityEnvelope> GetValue() => Ok(new NullabilityEnvelope',
    '    {',
    '        NonNullableText = "alpha",',
    '        NullableText = null,',
    '        NonNullableCount = 7,',
    '        NullableCount = null,',
    '        NonNullableTimestamp = DateTimeOffset.Parse("2024-01-02T03:04:05+09:00"),',
    '        NullableTimestamp = null,',
    '        NonNullablePoint = new CoordinatePoint { X = 1, Y = 2 },',
    '        NullablePoint = null,',
    '    });',
    '}',
    '',
  ].join('\n'),
  'Models/CoordinatePoint.cs': [
    'namespace Fixture.Models;',
    '',
    'public struct CoordinatePoint',
    '{',
    '    public int X { get; set; }',
    '    public int Y { get; set; }',
    '}',
    '',
  ].join('\n'),
  'Models/NullabilityEnvelope.cs': [
    'namespace Fixture.Models;',
    '',
    'public sealed class NullabilityEnvelope',
    '{',
    '    public string NonNullableText { get; init; } = string.Empty;',
    '    public string? NullableText { get; init; }',
    '    public int NonNullableCount { get; init; }',
    '    public int? NullableCount { get; init; }',
    '    public DateTimeOffset NonNullableTimestamp { get; init; }',
    '    public DateTimeOffset? NullableTimestamp { get; init; }',
    '    public CoordinatePoint NonNullablePoint { get; init; }',
    '    public CoordinatePoint? NullablePoint { get; init; }',
    '}',
    '',
  ].join('\n'),
} satisfies Record<string, string>;

const defaultNullabilityProject: SwaggerFixtureProject = {
  files: {
    'Program.cs': [
      'var builder = WebApplication.CreateBuilder(args);',
      'builder.Services.AddControllers();',
      'builder.Services.AddEndpointsApiExplorer();',
      'builder.Services.AddSwaggerGen(options =>',
      '    {',
      '        options.SupportNonNullableReferenceTypes();',
      '        options.NonNullableReferenceTypesAsRequired();',
      '    });',
      'var app = builder.Build();',
      'app.UseSwagger();',
      'app.MapControllers();',
      'app.Run();',
      '',
    ].join('\n'),
    ...nullabilityFiles,
  },
};

const filteredStructNullabilityProject: SwaggerFixtureProject = {
  files: {
    'Program.cs': [
      'using Fixture.Filters;',
      '',
      'var builder = WebApplication.CreateBuilder(args);',
      'builder.Services.AddControllers();',
      'builder.Services.AddEndpointsApiExplorer();',
      'builder.Services.AddSwaggerGen(options =>',
      '    {',
      '        options.SupportNonNullableReferenceTypes();',
      '        options.NonNullableReferenceTypesAsRequired();',
      '        options.SchemaFilter<NullableStructSchemaFilter>();',
      '    });',
      'var app = builder.Build();',
      'app.UseSwagger();',
      'app.MapControllers();',
      'app.Run();',
      '',
    ].join('\n'),
    'Filters/NullableStructSchemaFilter.cs': [
      'using Microsoft.OpenApi.Models;',
      'using Swashbuckle.AspNetCore.SwaggerGen;',
      'using Fixture.Models;',
      '',
      'namespace Fixture.Filters;',
      '',
      'public sealed class NullableStructSchemaFilter : ISchemaFilter',
      '{',
      '    public void Apply(OpenApiSchema schema, SchemaFilterContext context)',
      '    {',
      '        if (context.Type == typeof(NullabilityEnvelope) &&',
      '            schema.Properties.TryGetValue("nullablePoint", out var propertySchema) &&',
      '            propertySchema.Reference is not null)',
      '        {',
      '            propertySchema.AllOf = new List<OpenApiSchema>',
      '            {',
      '                new() { Reference = propertySchema.Reference },',
      '            };',
      '            propertySchema.Reference = null;',
      '            propertySchema.Nullable = true;',
      '        }',
      '    }',
      '}',
      '',
    ].join('\n'),
    ...nullabilityFiles,
  },
};

describe('nullability schema variations', () => {
  let defaultSource = '';
  let defaultNormalizedSource = '';
  let filteredSource = '';
  let filteredNormalizedSource = '';

  beforeAll(async () => {
    defaultSource = await generateAccessorSourceFromProject({
      artifactName: 'nullability-default',
      generatedArtifactPath: 'generated/default-nullability.ts',
      project: defaultNullabilityProject,
    });
    defaultNormalizedSource = defaultSource.replace(/\s+/gu, ' ');

    filteredSource = await generateAccessorSourceFromProject({
      artifactName: 'nullability-filtered-struct',
      generatedArtifactPath: 'generated/filtered-struct-nullability.ts',
      project: filteredStructNullabilityProject,
    });
    filteredNormalizedSource = filteredSource.replace(/\s+/gu, ' ');
  });

  it('marks non-nullable reference types as required without null unions', () => {
    expect(defaultNormalizedSource).toMatch(/nonNullableText: string;/);
    expect(defaultNormalizedSource).not.toMatch(/nonNullableText\?: string;/);
    expect(defaultNormalizedSource).not.toMatch(
      /nonNullableText: string \| null;/
    );
  });

  it('keeps nullable reference types optional and nullable', () => {
    expect(defaultNormalizedSource).toMatch(/nullableText\?: string \| null;/);
  });

  it('keeps non-nullable value types without null unions', () => {
    expect(defaultNormalizedSource).toMatch(/nonNullableCount\??: number;/);
    expect(defaultNormalizedSource).not.toMatch(
      /nonNullableCount\??: number \| null;/
    );
    expect(defaultNormalizedSource).toMatch(/nonNullableTimestamp\??: string;/);
    expect(defaultNormalizedSource).not.toMatch(
      /nonNullableTimestamp\??: string \| null;/
    );
  });

  it('adds null unions for nullable value types', () => {
    expect(defaultNormalizedSource).toMatch(
      /nullableCount\??: number \| null;/
    );
    expect(defaultNormalizedSource).toMatch(
      /nullableTimestamp\??: string \| null;/
    );
  });

  it('keeps non-nullable struct properties without null unions', () => {
    expect(defaultSource).toContain('export interface CoordinatePoint {');
    expect(defaultNormalizedSource).toMatch(
      /nonNullablePoint\??: CoordinatePoint;/
    );
    expect(defaultNormalizedSource).not.toMatch(
      /nonNullablePoint\??: CoordinatePoint \| null;/
    );
  });

  it('keeps default nullable struct properties without null unions when Swagger omits nullable metadata', () => {
    expect(defaultNormalizedSource).toMatch(
      /nullablePoint\??: CoordinatePoint;/
    );
    expect(defaultNormalizedSource).not.toMatch(
      /nullablePoint\??: CoordinatePoint \| null;/
    );
  });

  it('supports schema-filtered nullable struct properties when Swagger includes nullable metadata', () => {
    expect(filteredNormalizedSource).toMatch(
      /nullablePoint\??: CoordinatePoint \| null;/
    );
  });
});
