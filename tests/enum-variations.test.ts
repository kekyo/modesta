// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateAccessorSourceFromProject,
  SwaggerFixtureProject,
} from './support/harness';

const numericEnumProject: SwaggerFixtureProject = {
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
    'Controllers/EnumController.cs': [
      'using Microsoft.AspNetCore.Mvc;',
      'using Fixture.Models;',
      '',
      'namespace Fixture.Controllers;',
      '',
      '[ApiController]',
      '[Route("enum")]',
      'public sealed class EnumController : ControllerBase',
      '{',
      '    [HttpGet("numeric")]',
      '    public ActionResult<NumericEnumEnvelope> GetNumeric() => Ok(new NumericEnumEnvelope',
      '    {',
      '        Status = NumericEnumKind.Alpha,',
      '    });',
      '}',
      '',
    ].join('\n'),
    'Models/NumericEnumKind.cs': [
      'namespace Fixture.Models;',
      '',
      'public enum NumericEnumKind',
      '{',
      '    Alpha = 0,',
      '    Beta = 1,',
      '}',
      '',
    ].join('\n'),
    'Models/NumericEnumEnvelope.cs': [
      'namespace Fixture.Models;',
      '',
      'public sealed class NumericEnumEnvelope',
      '{',
      '    public NumericEnumKind Status { get; init; }',
      '}',
      '',
    ].join('\n'),
  },
};

const symbolicEnumProject: SwaggerFixtureProject = {
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
      '        options.SchemaFilter<StringEnumSchemaFilter>();',
      '    });',
      'var app = builder.Build();',
      'app.UseSwagger();',
      'app.MapControllers();',
      'app.Run();',
      '',
    ].join('\n'),
    'Controllers/EnumController.cs': [
      'using Microsoft.AspNetCore.Mvc;',
      'using Fixture.Models;',
      '',
      'namespace Fixture.Controllers;',
      '',
      '[ApiController]',
      '[Route("enum")]',
      'public sealed class EnumController : ControllerBase',
      '{',
      '    [HttpGet("symbolic")]',
      '    public ActionResult<SymbolicEnumEnvelope> GetSymbolic() => Ok(new SymbolicEnumEnvelope',
      '    {',
      '        Status = SymbolicEnumKind.Alpha,',
      '    });',
      '}',
      '',
    ].join('\n'),
    'Filters/StringEnumSchemaFilter.cs': [
      'using Microsoft.OpenApi.Any;',
      'using Microsoft.OpenApi.Models;',
      'using Swashbuckle.AspNetCore.SwaggerGen;',
      '',
      'namespace Fixture.Filters;',
      '',
      'public sealed class StringEnumSchemaFilter : ISchemaFilter',
      '{',
      '    public void Apply(OpenApiSchema schema, SchemaFilterContext context)',
      '    {',
      '        if (context.Type.IsEnum == false)',
      '        {',
      '            return;',
      '        }',
      '',
      '        schema.Type = "string";',
      '        schema.Format = null;',
      '        schema.Enum = Enum.GetNames(context.Type)',
      '            .Select(name => (IOpenApiAny)new OpenApiString(name))',
      '            .ToList();',
      '    }',
      '}',
      '',
    ].join('\n'),
    'Models/SymbolicEnumKind.cs': [
      'namespace Fixture.Models;',
      '',
      'public enum SymbolicEnumKind',
      '{',
      '    Alpha = 0,',
      '    Beta = 1,',
      '}',
      '',
    ].join('\n'),
    'Models/SymbolicEnumEnvelope.cs': [
      'namespace Fixture.Models;',
      '',
      'public sealed class SymbolicEnumEnvelope',
      '{',
      '    public SymbolicEnumKind Status { get; init; }',
      '}',
      '',
    ].join('\n'),
  },
};

describe('enum schema variations', () => {
  let numericSource = '';
  let symbolicSource = '';

  beforeAll(async () => {
    numericSource = await generateAccessorSourceFromProject({
      artifactName: 'enum-variations-numeric',
      generatedArtifactPath: 'generated/numeric-enum.ts',
      project: numericEnumProject,
    });
    symbolicSource = await generateAccessorSourceFromProject({
      artifactName: 'enum-variations-symbolic',
      generatedArtifactPath: 'generated/symbolic-enum.ts',
      project: symbolicEnumProject,
    });
  });

  it('keeps default numeric enum definitions when no schema filter is configured', () => {
    expect(numericSource).toContain('export type NumericEnumKind = 0 | 1;');
    expect(numericSource).toMatch(/status\??: NumericEnumKind;/);
  });

  it('supports schema-filtered symbolic enum definitions', () => {
    expect(symbolicSource).toContain(
      "export type SymbolicEnumKind = 'Alpha' | 'Beta';"
    );
    expect(symbolicSource).toMatch(/status\??: SymbolicEnumKind;/);
  });
});
