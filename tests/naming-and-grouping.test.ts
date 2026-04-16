// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateAccessorSourceFromProject,
  SwaggerFixtureProject,
} from './support/harness';
import { getInterfaceBlock } from './support/source-assertions';

const pathGroupingProject: SwaggerFixtureProject = {
  files: {
    'Program.cs': [
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
      'app.MapGet("/xml-comments/documented", () => TypedResults.Ok(new ValueEnvelope("a")));',
      'app.MapPost("/xml-comments/documented", () => TypedResults.Ok(new ValueEnvelope("b")));',
      'app.MapGet("/xml-comments/returns-only", () => TypedResults.Ok(new ValueEnvelope("c")));',
      'app.MapGet("/another/returns-only", () => TypedResults.Ok(new ValueEnvelope("d")));',
      'app.MapGet("/users/{id}", (string id) => TypedResults.Ok(new ValueEnvelope(id)));',
      '',
      'app.Run();',
      '',
      'public sealed record ValueEnvelope(string Value);',
      '',
    ].join('\n'),
  },
};

const uniqueSuffixProject: SwaggerFixtureProject = {
  files: {
    'Program.cs': [
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
      'app.MapGet("/foobar/xml-comments/documented", () => TypedResults.Ok(new ValueEnvelope("a")));',
      'app.MapGet("/baz/xml-comments/documented", () => TypedResults.Ok(new ValueEnvelope("b")));',
      'app.MapGet("/baz/hoge/documented", () => TypedResults.Ok(new ValueEnvelope("c")));',
      '',
      'app.Run();',
      '',
      'public sealed record ValueEnvelope(string Value);',
      '',
    ].join('\n'),
  },
};

const pathGroupCollisionProject: SwaggerFixtureProject = {
  files: {
    'Program.cs': [
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
      'app.MapGet("/foo-bar/xml-comments/documented", () => TypedResults.Ok(new ValueEnvelope("a")));',
      'app.MapGet("/foo_bar/xml-comments/other", () => TypedResults.Ok(new ValueEnvelope("b")));',
      '',
      'app.Run();',
      '',
      'public sealed record ValueEnvelope(string Value);',
      '',
    ].join('\n'),
  },
};

const methodCollisionProject: SwaggerFixtureProject = {
  files: {
    'Program.cs': [
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
      'app.MapGet("/xml-comments/returns-only", () => TypedResults.Ok(new ValueEnvelope("a")));',
      'app.MapGet("/xml-comments/returns_only", () => TypedResults.Ok(new ValueEnvelope("b")));',
      '',
      'app.Run();',
      '',
      'public sealed record ValueEnvelope(string Value);',
      '',
    ].join('\n'),
  },
};

const operationIdCollisionProject: SwaggerFixtureProject = {
  files: {
    'Program.cs': [
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
      'app.MapGet("/first", () => TypedResults.Ok(new ValueEnvelope("a"))).WithName("foo-bar");',
      'app.MapPost("/second", () => TypedResults.Ok(new ValueEnvelope("b"))).WithName("foo_bar");',
      '',
      'app.Run();',
      '',
      'public sealed record ValueEnvelope(string Value);',
      '',
    ].join('\n'),
  },
};

describe('naming and grouping rules', () => {
  let pathGroupingSource = '';
  let uniqueSuffixSource = '';

  beforeAll(async () => {
    pathGroupingSource = await generateAccessorSourceFromProject({
      artifactName: 'naming-path-grouping',
      generatedArtifactPath: 'generated/naming-path-grouping.ts',
      project: pathGroupingProject,
    });
    uniqueSuffixSource = await generateAccessorSourceFromProject({
      artifactName: 'naming-unique-suffix',
      generatedArtifactPath: 'generated/naming-unique-suffix.ts',
      project: uniqueSuffixProject,
    });
  });

  it('groups path-derived operations into one interface and factory per group', () => {
    const xmlCommentsBlock = getInterfaceBlock(
      pathGroupingSource,
      'xml_comments'
    );
    const anotherBlock = getInterfaceBlock(pathGroupingSource, 'another');
    const usersBlock = getInterfaceBlock(pathGroupingSource, 'users');

    expect(xmlCommentsBlock).toContain(
      'readonly get_documented: (options?: AccessorOptionsWithoutContext | undefined) => Promise<ValueEnvelope>;'
    );
    expect(xmlCommentsBlock).toContain(
      'readonly post_documented: (options?: AccessorOptionsWithoutContext | undefined) => Promise<ValueEnvelope>;'
    );
    expect(xmlCommentsBlock).toContain(
      'readonly get_returns_only: (options?: AccessorOptionsWithoutContext | undefined) => Promise<ValueEnvelope>;'
    );
    expect(anotherBlock).toContain(
      'readonly get_returns_only: (options?: AccessorOptionsWithoutContext | undefined) => Promise<ValueEnvelope>;'
    );
    expect(usersBlock).toContain(
      'readonly get_by_id: (args: users_get_by_id_arguments, options?: AccessorOptionsWithoutContext | undefined) => Promise<ValueEnvelope>;'
    );

    expect(pathGroupingSource).toContain(
      [
        'export function create_xml_comments_accessor(sender: AccessorSenderWithoutContext<undefined>): xml_comments;',
        'export function create_xml_comments_accessor<TAccessorInterfaceContext>(',
        '  sender: AccessorSenderWithoutContext<TAccessorInterfaceContext>,',
        '  interfaceContext: TAccessorInterfaceContext',
        '): xml_comments;',
        'export function create_xml_comments_accessor<TAccessorContext>(',
        '  sender: AccessorSenderWithContext<undefined, TAccessorContext>',
        '): xml_comments_with_context<TAccessorContext>;',
        'export function create_xml_comments_accessor<TAccessorInterfaceContext, TAccessorContext>(',
        '  sender: AccessorSenderWithContext<TAccessorInterfaceContext, TAccessorContext>,',
        '  interfaceContext: TAccessorInterfaceContext',
        '): xml_comments_with_context<TAccessorContext>;',
        'export function create_xml_comments_accessor<TAccessorInterfaceContext, TAccessorContext>(',
        '  sender: AccessorSenderWithoutContext<TAccessorInterfaceContext> | AccessorSenderWithContext<TAccessorInterfaceContext, TAccessorContext>,',
        '  interfaceContext?: TAccessorInterfaceContext',
        '): xml_comments | xml_comments_with_context<TAccessorContext> {',
      ].join('\n')
    );
    expect(pathGroupingSource).toContain(
      [
        'export function create_another_accessor(sender: AccessorSenderWithoutContext<undefined>): another;',
        'export function create_another_accessor<TAccessorInterfaceContext>(',
        '  sender: AccessorSenderWithoutContext<TAccessorInterfaceContext>,',
        '  interfaceContext: TAccessorInterfaceContext',
        '): another;',
        'export function create_another_accessor<TAccessorContext>(',
        '  sender: AccessorSenderWithContext<undefined, TAccessorContext>',
        '): another_with_context<TAccessorContext>;',
        'export function create_another_accessor<TAccessorInterfaceContext, TAccessorContext>(',
        '  sender: AccessorSenderWithContext<TAccessorInterfaceContext, TAccessorContext>,',
        '  interfaceContext: TAccessorInterfaceContext',
        '): another_with_context<TAccessorContext>;',
        'export function create_another_accessor<TAccessorInterfaceContext, TAccessorContext>(',
        '  sender: AccessorSenderWithoutContext<TAccessorInterfaceContext> | AccessorSenderWithContext<TAccessorInterfaceContext, TAccessorContext>,',
        '  interfaceContext?: TAccessorInterfaceContext',
        '): another | another_with_context<TAccessorContext> {',
      ].join('\n')
    );
    expect(pathGroupingSource).toContain(
      [
        'export function create_users_accessor(sender: AccessorSenderWithoutContext<undefined>): users;',
        'export function create_users_accessor<TAccessorInterfaceContext>(',
        '  sender: AccessorSenderWithoutContext<TAccessorInterfaceContext>,',
        '  interfaceContext: TAccessorInterfaceContext',
        '): users;',
        'export function create_users_accessor<TAccessorContext>(',
        '  sender: AccessorSenderWithContext<undefined, TAccessorContext>',
        '): users_with_context<TAccessorContext>;',
        'export function create_users_accessor<TAccessorInterfaceContext, TAccessorContext>(',
        '  sender: AccessorSenderWithContext<TAccessorInterfaceContext, TAccessorContext>,',
        '  interfaceContext: TAccessorInterfaceContext',
        '): users_with_context<TAccessorContext>;',
        'export function create_users_accessor<TAccessorInterfaceContext, TAccessorContext>(',
        '  sender: AccessorSenderWithoutContext<TAccessorInterfaceContext> | AccessorSenderWithContext<TAccessorInterfaceContext, TAccessorContext>,',
        '  interfaceContext?: TAccessorInterfaceContext',
        '): users | users_with_context<TAccessorContext> {',
      ].join('\n')
    );
  });

  it('uses the minimal unique path suffix for accessor interface names', () => {
    const foobarXmlCommentsBlock = getInterfaceBlock(
      uniqueSuffixSource,
      'foobar_xml_comments'
    );
    const bazXmlCommentsBlock = getInterfaceBlock(
      uniqueSuffixSource,
      'baz_xml_comments'
    );
    const hogeBlock = getInterfaceBlock(uniqueSuffixSource, 'hoge');

    expect(foobarXmlCommentsBlock).toContain(
      'readonly get_documented: (options?: AccessorOptionsWithoutContext | undefined) => Promise<ValueEnvelope>;'
    );
    expect(bazXmlCommentsBlock).toContain(
      'readonly get_documented: (options?: AccessorOptionsWithoutContext | undefined) => Promise<ValueEnvelope>;'
    );
    expect(hogeBlock).toContain(
      'readonly get_documented: (options?: AccessorOptionsWithoutContext | undefined) => Promise<ValueEnvelope>;'
    );
  });

  it('fails when normalized path-derived group names collide', async () => {
    await expect(
      generateAccessorSourceFromProject({
        artifactName: 'naming-path-group-collision',
        generatedArtifactPath: 'generated/naming-path-group-collision.ts',
        project: pathGroupCollisionProject,
      })
    ).rejects.toThrow(
      /Could not derive a unique accessor interface name from path group 'foo-bar\/xml-comments'/
    );
  });

  it('fails when normalized path-derived method names collide', async () => {
    await expect(
      generateAccessorSourceFromProject({
        artifactName: 'naming-method-collision',
        generatedArtifactPath: 'generated/naming-method-collision.ts',
        project: methodCollisionProject,
      })
    ).rejects.toThrow(
      /Generated method name 'get_returns_only' in accessor 'xml_comments' is ambiguous/
    );
  });

  it('fails when normalized operationId group names collide', async () => {
    await expect(
      generateAccessorSourceFromProject({
        artifactName: 'naming-operation-id-collision',
        generatedArtifactPath: 'generated/naming-operation-id-collision.ts',
        project: operationIdCollisionProject,
      })
    ).rejects.toThrow(/Generated group name 'foo_bar' is ambiguous/);
  });
});
