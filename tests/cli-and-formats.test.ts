// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { createServer } from 'http';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { generateAccessorSource } from '../src/generator';
import {
  fetchSwaggerJsonFromProject,
  runCommand,
  runModestaCli,
  saveArtifactText,
  SwaggerFixtureProject,
} from './support/harness';

const formatProject: SwaggerFixtureProject = {
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
      'app.MapGet("/summaries/{region}", (',
      '    [FromRoute] string region,',
      '    [FromQuery] int limit,',
      '    [FromHeader(Name = "x-api-key")] string apiKey) =>',
      '    TypedResults.Ok(new SummaryEnvelope(',
      '        region,',
      '        new[]',
      '        {',
      '            new SummaryItem("alpha", DateTimeOffset.Parse("2024-01-02T03:04:05+09:00"), apiKey)',
      '        })))',
      '    .WithName("ListSummaries");',
      '',
      'app.MapPost("/lookups", ([FromBody] LookupRequest request) =>',
      '    TypedResults.Ok(new Dictionary<string, SummaryItem>',
      '    {',
      '        [request.Ids[0]] = new SummaryItem(request.Ids[0], DateTimeOffset.Parse("2024-02-03T04:05:06+09:00"), null)',
      '    }))',
      '    .WithName("LookupSummaries");',
      '',
      'app.Run();',
      '',
      'public sealed record LookupRequest(string[] Ids);',
      'public sealed record SummaryEnvelope(string Region, SummaryItem[] Items);',
      'public sealed record SummaryItem(string Id, DateTimeOffset RecordedAt, string? Note);',
      '',
    ].join('\n'),
  },
};

describe('CLI and format support', () => {
  let swaggerJson = '';

  beforeAll(async () => {
    swaggerJson = await fetchSwaggerJsonFromProject(
      formatProject,
      'cli-and-formats'
    );
  });

  it('writes generated source through the CLI', async () => {
    const generatedSource = await runModestaCli(
      swaggerJson,
      'cli-and-formats',
      'generated/from-cli-json.ts',
      'swagger/cli-input.json'
    );

    expect(generatedSource).toContain('export interface LookupSummaries {');
    expect(generatedSource).toContain('export interface ListSummaries {');
    expect(generatedSource).toContain(
      'export const create_LookupSummaries_accessor = (sender: AccessorSender): LookupSummaries => ({'
    );
    expect(generatedSource).toContain(
      'export const create_ListSummaries_accessor = (sender: AccessorSender): ListSummaries => ({'
    );
    expect(generatedSource).toContain(
      'export const createFetchSender = (options: CreateFetchSenderOptions): AccessorSender => {'
    );
  });

  it('writes generated source to stdout when only the input path is provided', async () => {
    const workingDirectory = await mkdtemp(
      join(tmpdir(), 'modesta-cli-stdout-')
    );
    try {
      const swaggerPath = join(workingDirectory, 'swagger.json');
      await writeFile(swaggerPath, swaggerJson, 'utf8');
      await saveArtifactText(
        'cli-and-formats',
        'swagger/cli-input-stdout.json',
        swaggerJson
      );
      const { stdout } = await runCommand(
        'node',
        [resolve(process.cwd(), 'dist/cli.mjs'), swaggerPath],
        process.cwd()
      );

      await saveArtifactText(
        'cli-and-formats',
        'generated/from-cli-path-stdout.ts',
        stdout
      );

      expect(stdout).toContain('export interface LookupSummaries {');
      expect(stdout).toContain('export interface ListSummaries {');
      expect(stdout).toContain(`// Source file: ${swaggerPath}`);
    } finally {
      await rm(workingDirectory, { force: true, recursive: true });
    }
  });

  it('reads Swagger from stdin and writes generated source to stdout', async () => {
    const { stdout } = await runCommand(
      'node',
      [resolve(process.cwd(), 'dist/cli.mjs')],
      process.cwd(),
      swaggerJson
    );

    await saveArtifactText(
      'cli-and-formats',
      'generated/from-cli-stdin-stdout.ts',
      stdout
    );

    expect(stdout).toContain('export interface LookupSummaries {');
    expect(stdout).toContain('export interface ListSummaries {');
    expect(stdout).toContain(
      'export const create_LookupSummaries_accessor = (sender: AccessorSender): LookupSummaries => ({'
    );
    expect(stdout).not.toContain('// Source file:');
  });

  it('fetches Swagger from a URL through the CLI', async () => {
    const swaggerYaml = YAML.stringify(JSON.parse(swaggerJson));
    const workingDirectory = await mkdtemp(join(tmpdir(), 'modesta-cli-url-'));
    const outputPath = join(workingDirectory, 'generated.ts');
    const server = createServer((request, response) => {
      if (request.url?.startsWith('/swagger/v1/swagger.yaml') !== true) {
        response.statusCode = 404;
        response.end();
        return;
      }

      response.writeHead(200, {
        'content-type': 'application/yaml; charset=utf-8',
      });
      response.end(swaggerYaml);
    });

    await new Promise<void>((resolveListen, rejectListen) => {
      server.once('error', rejectListen);
      server.listen(0, '127.0.0.1', () => resolveListen());
    });

    const address = server.address();
    if (address == null || typeof address === 'string') {
      await new Promise<void>((resolveClose) =>
        server.close(() => resolveClose())
      );
      throw new Error('Could not determine HTTP server address.');
    }

    const inputUrl = `http://127.0.0.1:${address.port}/swagger/v1/swagger.yaml?download=1`;

    try {
      await saveArtifactText(
        'cli-and-formats',
        'swagger/cli-input-from-url.yaml',
        swaggerYaml
      );

      await runCommand(
        'node',
        [resolve(process.cwd(), 'dist/cli.mjs'), inputUrl, outputPath],
        process.cwd()
      );

      const generatedSource = await readFile(outputPath, 'utf8');
      await saveArtifactText(
        'cli-and-formats',
        'generated/from-cli-url.ts',
        generatedSource
      );

      expect(generatedSource).toContain('export interface LookupSummaries {');
      expect(generatedSource).toContain('export interface ListSummaries {');
      expect(generatedSource).toContain(`// Source file: ${inputUrl}`);
    } finally {
      await new Promise<void>((resolveClose) =>
        server.close(() => resolveClose())
      );
      await rm(workingDirectory, { force: true, recursive: true });
    }
  });

  it('generates the same source from ASP.NET Core Swagger JSON and YAML', () => {
    const swaggerYaml = YAML.stringify(JSON.parse(swaggerJson));

    const fromJson = generateAccessorSource({
      document: swaggerJson,
    });
    const fromYaml = generateAccessorSource({
      document: swaggerYaml,
    });

    return Promise.all([
      saveArtifactText(
        'cli-and-formats',
        'swagger/derived-from-json.yaml',
        swaggerYaml
      ),
      saveArtifactText(
        'cli-and-formats',
        'generated/from-generator-json.ts',
        fromJson
      ),
      saveArtifactText(
        'cli-and-formats',
        'generated/from-generator-yaml.ts',
        fromYaml
      ),
    ]).then(() => {
      expect(fromYaml).toBe(fromJson);
      expect(fromJson).toContain('export interface LookupSummaries {');
      expect(fromJson).toContain(
        'readonly post: (args: LookupSummaries_post_arguments, signal?: AbortSignal | undefined) => Promise<LookupSummaries_post_response>;'
      );
      expect(fromJson).toContain('[key: string]: SummaryItem;');
      expect(fromJson).toContain('recordedAt: string;');
      expect(fromJson).toContain('note?: string | null;');
    });
  });

  it('fails explicitly for unsupported schema composition', () => {
    expect(() =>
      generateAccessorSource({
        document: {
          openapi: '3.0.1',
          info: {
            title: 'Unsupported',
          },
          paths: {
            '/value': {
              get: {
                responses: {
                  '200': {
                    content: {
                      'application/json': {
                        schema: {
                          oneOf: [{ type: 'string' }, { type: 'number' }],
                        },
                      },
                    },
                    description: 'OK',
                  },
                },
              },
            },
          },
        },
      })
    ).toThrow(/oneOf\/anyOf\/discriminator/);
  });
});
