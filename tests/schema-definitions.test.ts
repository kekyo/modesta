// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateAccessorSourceFromProject,
  SwaggerFixtureProject,
} from './support/harness';
import {
  getInterfaceBlock,
  getTypeAliasStatement,
} from './support/source-assertions';

const schemaProject: SwaggerFixtureProject = {
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
    'Controllers/SchemaController.cs': [
      'using Microsoft.AspNetCore.Mvc;',
      'using Fixture.Models;',
      '',
      'namespace Fixture.Controllers;',
      '',
      '[ApiController]',
      '[Route("schemas")]',
      'public sealed class SchemaController : ControllerBase',
      '{',
      '    [HttpGet("class")]',
      '    public ActionResult<ClassEnvelope> GetClass() => Ok(new ClassEnvelope',
      '    {',
      '        ClassName = "alpha",',
      '        Kind = MemberKind.Alpha,',
      '    });',
      '',
      '    [HttpGet("struct")]',
      '    public ActionResult<StructEnvelope> GetStruct() => Ok(new StructEnvelope',
      '    {',
      '        StructCount = 7,',
      '        Enabled = true,',
      '    });',
      '',
      '    [HttpGet("record")]',
      '    public ActionResult<RecordEnvelope> GetRecord() => Ok(new RecordEnvelope("beta", 9));',
      '',
      '    [HttpGet("scoped")]',
      '    public ActionResult<ScopedEnvelope> GetScoped() => Ok(new ScopedEnvelope',
      '    {',
      '        VisibleName = "visible",',
      '    });',
      '',
      '    [HttpGet("attribute")]',
      '    public ActionResult<AttributedEnvelope> GetAttribute() => Ok(new AttributedEnvelope',
      '    {',
      '        RenamedValue = "renamed",',
      '    });',
      '}',
      '',
    ].join('\n'),
    'Models/MemberKind.cs': [
      'namespace Fixture.Models;',
      '',
      'public enum MemberKind',
      '{',
      '    Alpha = 0,',
      '    Beta = 1,',
      '}',
      '',
    ].join('\n'),
    'Models/ClassEnvelope.cs': [
      'namespace Fixture.Models;',
      '',
      'public sealed class ClassEnvelope',
      '{',
      '    public required string ClassName { get; init; }',
      '    public MemberKind Kind { get; init; }',
      '}',
      '',
    ].join('\n'),
    'Models/StructEnvelope.cs': [
      'namespace Fixture.Models;',
      '',
      'public struct StructEnvelope',
      '{',
      '    public int StructCount { get; set; }',
      '    public bool Enabled { get; set; }',
      '}',
      '',
    ].join('\n'),
    'Models/RecordEnvelope.cs': [
      'namespace Fixture.Models;',
      '',
      'public sealed record RecordEnvelope(string RecordTitle, int RecordLevel);',
      '',
    ].join('\n'),
    'Models/ScopedEnvelope.cs': [
      'namespace Fixture.Models;',
      '',
      'public sealed class ScopedEnvelope',
      '{',
      '    public string VisibleName { get; init; } = string.Empty;',
      '    internal string HiddenInternal { get; init; } = string.Empty;',
      '    protected string HiddenProtected { get; init; } = string.Empty;',
      '    private string HiddenPrivate { get; init; } = string.Empty;',
      '}',
      '',
    ].join('\n'),
    'Models/AttributedEnvelope.cs': [
      'using System.Text.Json.Serialization;',
      '',
      'namespace Fixture.Models;',
      '',
      'public sealed class AttributedEnvelope',
      '{',
      '    [JsonPropertyName("renamed-value")]',
      '    public string? RenamedValue { get; init; }',
      '}',
      '',
    ].join('\n'),
  },
};

describe('schema definition generation', () => {
  let generatedSource = '';

  beforeAll(async () => {
    generatedSource = await generateAccessorSourceFromProject({
      artifactName: 'schema-definitions',
      generatedArtifactPath: 'generated/schema-definitions.ts',
      project: schemaProject,
    });
  });

  it('generates class-based schema definitions', () => {
    const classBlock = getInterfaceBlock(generatedSource, 'ClassEnvelope');

    expect(classBlock).toContain('className: string;');
    expect(classBlock).toContain('kind: MemberKind;');
  });

  it('generates struct-based schema definitions', () => {
    const structBlock = getInterfaceBlock(generatedSource, 'StructEnvelope');

    expect(structBlock).toContain('structCount: number;');
    expect(structBlock).toContain('enabled: boolean;');
  });

  it('generates record-based schema definitions', () => {
    const recordBlock = getInterfaceBlock(generatedSource, 'RecordEnvelope');

    expect(recordBlock).toContain('recordTitle: string;');
    expect(recordBlock).toContain('recordLevel: number;');
  });

  it('generates enum-based schema definitions', () => {
    expect(getTypeAliasStatement(generatedSource, 'MemberKind')).toBe(
      'export type MemberKind = 0 | 1;'
    );
  });

  it('ignores non-public members from schemas', () => {
    const scopedBlock = getInterfaceBlock(generatedSource, 'ScopedEnvelope');

    expect(scopedBlock).toContain('visibleName: string;');
    expect(scopedBlock).not.toContain('hiddenInternal');
    expect(scopedBlock).not.toContain('hiddenProtected');
    expect(scopedBlock).not.toContain('hiddenPrivate');
  });

  it('applies property-level attributes with named arguments', () => {
    const attributedBlock = getInterfaceBlock(
      generatedSource,
      'AttributedEnvelope'
    );

    expect(attributedBlock).toContain("'renamed-value'?: string | null;");
  });
});
