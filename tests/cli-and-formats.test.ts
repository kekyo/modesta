// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { createServer } from 'http';
import { mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import dayjs from 'dayjs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';
import type { IncomingMessage, ServerResponse } from 'http';
import {
  generateAccessorSource,
  generateAccessorSourceFromFile,
  loadOpenApiDocumentFromFile,
} from '../src/generator';
import {
  fetchSwaggerJsonFromProject,
  getTypeScriptDiagnostics,
  runCommand,
  runCommandAllowFailure,
  runModestaCli,
  saveArtifactText,
  SwaggerFixtureProject,
  transpileGeneratedSource,
} from './support/harness';
import { createSelfSignedHttpsServer } from './support/https-fixture';

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
      'public sealed record LookupRequest(string[] Ids, DateTimeOffset RequestedAt, SummaryItem Anchor, DateTimeOffset[] Milestones, Dictionary<string, DateTimeOffset> Windows);',
      'public sealed record SummaryEnvelope(string Region, SummaryItem[] Items);',
      'public sealed record SummaryItem(string Id, DateTimeOffset RecordedAt, string? Note);',
      '',
    ].join('\n'),
  },
};

describe('CLI and format support', () => {
  let swaggerJson = '';
  let generatedSource = '';
  let generatedModule: Record<string, any>;

  beforeAll(async () => {
    swaggerJson = await fetchSwaggerJsonFromProject(
      formatProject,
      'cli-and-formats'
    );
    generatedSource = generateAccessorSource({
      document: swaggerJson,
      source: 'swagger.json',
    });
    generatedModule = await transpileGeneratedSource(generatedSource);
  });

  const listenServer = async (
    server:
      | ReturnType<typeof createSelfSignedHttpsServer>
      | ReturnType<typeof createServer>
  ) => {
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

    return address;
  };

  const expectedSourceFileDisplay = (source: string) => {
    try {
      const url = new URL(source);
      if (url.protocol === 'file:') {
        return basename(fileURLToPath(url));
      }

      url.hostname = 'example.com';
      url.port = '';
      url.username = '';
      url.password = '';
      return url.href;
    } catch {
      return basename(source);
    }
  };

  const getConstBlock = (source: string, constName: string) => {
    const start = source.indexOf(`const ${constName}:`);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf('\n\n', start);
    return source.slice(start, end >= 0 ? end : undefined);
  };

  it('emits reusable schema metadata only for formatted branches', () => {
    expect(generatedSource).toContain(
      [
        'const modestaSchemaMetadata_format_date_time: AccessorSchemaMetadata = {',
        "  format: 'date-time',",
        '};',
      ].join('\n')
    );

    const summaryItemMetadata = getConstBlock(
      generatedSource,
      'modestaSchemaMetadata_SummaryItem'
    );
    expect(summaryItemMetadata).toContain(
      'recordedAt: modestaSchemaMetadata_format_date_time'
    );
    expect(summaryItemMetadata).not.toContain('id:');
    expect(summaryItemMetadata).not.toContain('note:');

    const summaryEnvelopeMetadata = getConstBlock(
      generatedSource,
      'modestaSchemaMetadata_SummaryEnvelope'
    );
    expect(summaryEnvelopeMetadata).toContain(
      'items: modestaSchemaMetadata_SummaryEnvelope_items'
    );
    expect(summaryEnvelopeMetadata).not.toContain('region:');
    expect(
      getConstBlock(
        generatedSource,
        'modestaSchemaMetadata_SummaryEnvelope_items'
      )
    ).toContain('items: modestaSchemaMetadata_SummaryItem');

    const lookupRequestMetadata = getConstBlock(
      generatedSource,
      'modestaSchemaMetadata_LookupRequest'
    );
    expect(lookupRequestMetadata).toContain(
      'requestedAt: modestaSchemaMetadata_format_date_time'
    );
    expect(lookupRequestMetadata).toContain(
      'anchor: modestaSchemaMetadata_SummaryItem'
    );
    expect(lookupRequestMetadata).not.toContain('ids:');
  });

  it('maps formatted schemas to configured TypeScript types', async () => {
    const dateMappedSource = generateAccessorSource({
      document: swaggerJson,
      formatTypeMappings: {
        'date-time': 'Date',
      },
      source: 'swagger.json',
    });

    expect(dateMappedSource).toContain('recordedAt: Date;');
    expect(dateMappedSource).toContain('requestedAt: Date;');
    expect(dateMappedSource).toContain('milestones: ReadonlyArray<Date>;');
    expect(dateMappedSource).toContain('[key: string]: Date;');
    expect(dateMappedSource).not.toContain('recordedAt: string;');

    const dayjsMappedSource = generateAccessorSource({
      document: swaggerJson,
      formatTypeMappings: {
        'date-time': 'import("dayjs").Dayjs',
      },
      source: 'swagger.json',
    });
    const diagnostics = await getTypeScriptDiagnostics({
      'consumer.ts': [
        "import type { Dayjs } from 'dayjs';",
        "import type { LookupRequest } from './generated.ts';",
        '',
        'declare const instant: Dayjs;',
        'const request: LookupRequest = {',
        '  anchor: {',
        "    id: 'alpha',",
        '    recordedAt: instant,',
        '  },',
        "  ids: ['alpha'],",
        '  milestones: [instant],',
        '  requestedAt: instant,',
        '  windows: {',
        '    start: instant,',
        '  },',
        '};',
        'request.anchor.recordedAt.toISOString();',
      ].join('\n'),
      'generated.ts': dayjsMappedSource,
      'node_modules/dayjs/index.d.ts': [
        "declare module 'dayjs' {",
        '  export interface Dayjs {',
        '    toISOString(): string;',
        '  }',
        '  const dayjs: () => Dayjs;',
        '  export default dayjs;',
        '}',
      ].join('\n'),
    });

    expect(diagnostics).toEqual([]);
  });

  it('passes format metadata to user-land Date and Dayjs serializers', async () => {
    const serializers = new Map<string, any>();
    const trySerialize = vi.fn(
      (
        value: unknown,
        format: string | undefined,
        ref: { result: unknown }
      ) => {
        if (format !== 'date-time') {
          return false;
        }
        if (value instanceof Date) {
          ref.result = value.toISOString();
          return true;
        }
        if (dayjs.isDayjs(value)) {
          ref.result = value.toISOString();
          return true;
        }
        return false;
      }
    );
    const tryDeserialize = vi.fn(
      (
        value: unknown,
        format: string | undefined,
        ref: { result: unknown }
      ) => {
        if (format === 'date-time' && typeof value === 'string') {
          ref.result = dayjs(value);
          return true;
        }
        return false;
      }
    );
    const serializer = generatedModule.createCustomJsonSerializer({
      tryDeserialize,
      trySerialize,
    });
    serializers.set('application/json', serializer);

    let serializedLookupBody: unknown;
    const sender = {
      serializers,
      send: async (request: any) => {
        if (request.operationName === 'LookupSummaries.post') {
          serializedLookupBody = JSON.parse(
            generatedModule.modestaSerializeRequestBody(request, serializers)
          );
          const lookupResponseBody =
            await generatedModule.modestaReadFetchResponseBody(
              {
                status: 200,
                headers: {
                  get: (name: string) =>
                    name === 'content-type' ? 'application/json' : null,
                },
                text: async () =>
                  JSON.stringify({
                    alpha: {
                      id: 'alpha',
                      note: null,
                      recordedAt: '2024-02-02T03:04:05.000Z',
                    },
                  }),
              },
              request.responseContentType,
              serializers,
              request.responseBodyMetadata
            );
          return generatedModule.modestaProjectResponse(request, {
            body: lookupResponseBody,
            getHeader: () => null,
          });
        }

        const listResponseBody =
          await generatedModule.modestaReadFetchResponseBody(
            {
              status: 200,
              headers: {
                get: (name: string) =>
                  name === 'content-type' ? 'application/json' : null,
              },
              text: async () =>
                JSON.stringify({
                  items: [
                    {
                      id: 'bravo',
                      note: 'ok',
                      recordedAt: '2024-03-03T04:05:06.000Z',
                    },
                  ],
                  region: 'apac',
                }),
            },
            request.responseContentType,
            serializers,
            request.responseBodyMetadata
          );
        return generatedModule.modestaProjectResponse(request, {
          body: listResponseBody,
          getHeader: () => null,
        });
      },
    };

    const lookupAccessor =
      generatedModule.create_LookupSummaries_accessor(sender);
    const lookupResult = await lookupAccessor.post({
      anchor: {
        id: {
          untouched: true,
        },
        note: 'anchor',
        recordedAt: new Date('2024-01-02T03:04:05.000Z'),
      },
      ids: ['alpha'],
      milestones: [dayjs('2024-05-06T07:08:09.000Z')],
      requestedAt: dayjs('2024-04-05T06:07:08.000Z'),
      windows: {
        start: new Date('2024-06-07T08:09:10.000Z'),
      },
    });

    expect(serializedLookupBody).toEqual({
      anchor: {
        id: {
          untouched: true,
        },
        note: 'anchor',
        recordedAt: '2024-01-02T03:04:05.000Z',
      },
      ids: ['alpha'],
      milestones: ['2024-05-06T07:08:09.000Z'],
      requestedAt: '2024-04-05T06:07:08.000Z',
      windows: {
        start: '2024-06-07T08:09:10.000Z',
      },
    });
    expect(dayjs.isDayjs(lookupResult.alpha.recordedAt)).toBe(true);
    expect(lookupResult.alpha.recordedAt.toISOString()).toBe(
      '2024-02-02T03:04:05.000Z'
    );

    const listAccessor = generatedModule.create_ListSummaries_accessor(sender);
    const listResult = await listAccessor.get({
      limit: 1,
      region: 'apac',
      xApiKey: 'key',
    });
    expect(dayjs.isDayjs(listResult.items[0].recordedAt)).toBe(true);
    expect(listResult.items[0].recordedAt.toISOString()).toBe(
      '2024-03-03T04:05:06.000Z'
    );
    expect(trySerialize).toHaveBeenCalledWith(
      expect.any(Date),
      'date-time',
      expect.any(Object)
    );
    expect(tryDeserialize).toHaveBeenCalledWith(
      '2024-03-03T04:05:06.000Z',
      'date-time',
      expect.any(Object)
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
      [
        'export function create_LookupSummaries_accessor(sender: AccessorSender): LookupSummaries;',
        'export function create_LookupSummaries_accessor<TAccessorContext>(',
        '  sender: AccessorSenderWithContext<TAccessorContext>',
        '): LookupSummaries_with_context<TAccessorContext>;',
        'export function create_LookupSummaries_accessor<TAccessorContext>(',
        '  sender: AccessorSender | AccessorSenderWithContext<TAccessorContext>',
        '): LookupSummaries | LookupSummaries_with_context<TAccessorContext> {',
      ].join('\n')
    );
    expect(generatedSource).toContain(
      [
        'export function create_ListSummaries_accessor(sender: AccessorSender): ListSummaries;',
        'export function create_ListSummaries_accessor<TAccessorContext>(',
        '  sender: AccessorSenderWithContext<TAccessorContext>',
        '): ListSummaries_with_context<TAccessorContext>;',
        'export function create_ListSummaries_accessor<TAccessorContext>(',
        '  sender: AccessorSender | AccessorSenderWithContext<TAccessorContext>',
        '): ListSummaries | ListSummaries_with_context<TAccessorContext> {',
      ].join('\n')
    );
    expect(generatedSource).toContain(
      'export const createFetchSender = (options?: CreateFetchSenderOptions | undefined): AccessorSenderInterface => {'
    );
  });

  it('does not emit asset sources as build outputs', async () => {
    await expect(
      stat(resolve(process.cwd(), 'dist/src/assets/runtime.d.ts'))
    ).rejects.toThrow();
    await expect(
      stat(resolve(process.cwd(), 'dist/src/assets/runtime.d.ts.map'))
    ).rejects.toThrow();
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
      expect(stdout).toContain(
        `// Source file: ${expectedSourceFileDisplay(swaggerPath)}`
      );
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
      [
        'export function create_LookupSummaries_accessor(sender: AccessorSender): LookupSummaries;',
        'export function create_LookupSummaries_accessor<TAccessorContext>(',
        '  sender: AccessorSenderWithContext<TAccessorContext>',
        '): LookupSummaries_with_context<TAccessorContext>;',
        'export function create_LookupSummaries_accessor<TAccessorContext>(',
        '  sender: AccessorSender | AccessorSenderWithContext<TAccessorContext>',
        '): LookupSummaries | LookupSummaries_with_context<TAccessorContext> {',
      ].join('\n')
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

    const address = await listenServer(server);

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
      expect(generatedSource).toContain(
        `// Source file: ${expectedSourceFileDisplay(inputUrl)}`
      );
    } finally {
      await new Promise<void>((resolveClose) =>
        server.close(() => resolveClose())
      );
      await rm(workingDirectory, { force: true, recursive: true });
    }
  });

  it('fails to fetch Swagger from a self-signed HTTPS URL through the CLI by default', async () => {
    const swaggerYaml = YAML.stringify(JSON.parse(swaggerJson));
    const workingDirectory = await mkdtemp(
      join(tmpdir(), 'modesta-cli-https-fail-')
    );
    const outputPath = join(workingDirectory, 'generated.ts');
    const server = createSelfSignedHttpsServer(
      (request: IncomingMessage, response: ServerResponse<IncomingMessage>) => {
        if (request.url?.startsWith('/swagger/v1/swagger.yaml') !== true) {
          response.statusCode = 404;
          response.end();
          return;
        }

        response.writeHead(200, {
          'content-type': 'application/yaml; charset=utf-8',
        });
        response.end(swaggerYaml);
      }
    );

    const address = await listenServer(server);
    const inputUrl = `https://127.0.0.1:${address.port}/swagger/v1/swagger.yaml?download=1`;

    try {
      const result = await runCommandAllowFailure(
        'node',
        [resolve(process.cwd(), 'dist/cli.mjs'), inputUrl, outputPath],
        process.cwd()
      );

      expect(result.exitCode).toBe(1);
      await expect(readFile(outputPath, 'utf8')).rejects.toThrow();
    } finally {
      await new Promise<void>((resolveClose) =>
        server.close(() => resolveClose())
      );
      await rm(workingDirectory, { force: true, recursive: true });
    }
  });

  it('accepts insecure mode for self-signed HTTPS URLs in the CLI and library file-loading APIs', async () => {
    const swaggerYaml = YAML.stringify(JSON.parse(swaggerJson));
    const workingDirectory = await mkdtemp(
      join(tmpdir(), 'modesta-cli-https-insecure-')
    );
    const outputPath = join(workingDirectory, 'generated.ts');
    const server = createSelfSignedHttpsServer(
      (request: IncomingMessage, response: ServerResponse<IncomingMessage>) => {
        if (request.url?.startsWith('/swagger/v1/swagger.yaml') !== true) {
          response.statusCode = 404;
          response.end();
          return;
        }

        response.writeHead(200, {
          'content-type': 'application/yaml; charset=utf-8',
        });
        response.end(swaggerYaml);
      }
    );

    const address = await listenServer(server);
    const inputUrl = `https://127.0.0.1:${address.port}/swagger/v1/swagger.yaml?download=1`;

    try {
      const loadedDocument = await loadOpenApiDocumentFromFile({
        insecure: true,
        source: new URL(inputUrl),
      });
      const generatedFromFile = await generateAccessorSourceFromFile({
        formatTypeMappings: {
          'date-time': 'Date',
        },
        insecure: true,
        source: inputUrl,
      });

      await runCommand(
        'node',
        [
          resolve(process.cwd(), 'dist/cli.mjs'),
          '--insecure',
          inputUrl,
          outputPath,
        ],
        process.cwd()
      );

      const generatedFromCli = await readFile(outputPath, 'utf8');
      await saveArtifactText(
        'cli-and-formats',
        'generated/from-cli-self-signed-url.ts',
        generatedFromCli
      );

      expect(loadedDocument.paths).toHaveProperty('/lookups');
      expect(generatedFromFile).toContain(
        `// Source file: ${expectedSourceFileDisplay(inputUrl)}`
      );
      expect(generatedFromFile).toContain('recordedAt: Date;');
      expect(generatedFromCli).toContain(
        `// Source file: ${expectedSourceFileDisplay(inputUrl)}`
      );
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
        'readonly post: (args: LookupRequest, options?: AccessorOptions | undefined) => Promise<LookupSummaries_post_response>;'
      );
      expect(fromJson).toContain('[key: string]: SummaryItem;');
      expect(fromJson).toContain('recordedAt: string;');
      expect(fromJson).toContain('note?: string | null;');
    });
  });

  it('accepts URL objects in generator public APIs', async () => {
    const swaggerYaml = YAML.stringify(JSON.parse(swaggerJson));
    const workingDirectory = await mkdtemp(
      join(tmpdir(), 'modesta-generator-url-object-')
    );
    try {
      const swaggerPath = join(workingDirectory, 'swagger.yaml');
      const sourceUrl = pathToFileURL(swaggerPath);
      await writeFile(swaggerPath, swaggerYaml, 'utf8');

      const loadedDocument = await loadOpenApiDocumentFromFile({
        source: sourceUrl,
      });
      const generatedFromFile = await generateAccessorSourceFromFile({
        source: sourceUrl,
      });
      const generatedFromDocument = generateAccessorSource({
        document: swaggerJson,
        source: new URL('https://example.invalid/swagger/v1/swagger.yaml'),
      });

      await saveArtifactText(
        'cli-and-formats',
        'generated/from-generator-file-url.ts',
        generatedFromFile
      );
      await saveArtifactText(
        'cli-and-formats',
        'generated/from-generator-remote-url.ts',
        generatedFromDocument
      );

      expect(loadedDocument.paths).toHaveProperty('/lookups');
      expect(generatedFromFile).toContain(
        `// Source file: ${expectedSourceFileDisplay(sourceUrl.href)}`
      );
      expect(generatedFromDocument).toContain(
        `// Source file: ${expectedSourceFileDisplay('https://example.invalid/swagger/v1/swagger.yaml')}`
      );
    } finally {
      await rm(workingDirectory, { force: true, recursive: true });
    }
  });

  it('fails explicitly for unsupported schema composition', async () => {
    const unsupportedDocument = {
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
    };
    await saveArtifactText(
      'cli-and-formats',
      'swagger/unsupported-composition.json',
      JSON.stringify(unsupportedDocument, null, 2)
    );

    expect(() =>
      generateAccessorSource({
        document: unsupportedDocument,
      })
    ).toThrow(/oneOf\/anyOf\/discriminator/);
  });
});
