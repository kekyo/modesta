// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { execFile, spawn } from 'child_process';
import { once } from 'events';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { createServer } from 'net';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { pathToFileURL } from 'url';
import ts from 'typescript';
import { expect } from 'vitest';
import { generateAccessorSource } from '../../src/generator';
import type { GenerateAccessorWarningSink } from '../../src/types';

export interface SwaggerFixtureProject {
  csprojPropertyLines?: string[];
  files: Record<string, string>;
}

export interface GenerateAccessorSourceFromProjectOptions {
  artifactName: string | undefined;
  generatedArtifactPath: string | undefined;
  project: SwaggerFixtureProject;
  warningSink?: GenerateAccessorWarningSink | undefined;
}

export const runCommand = async (
  command: string,
  args: string[],
  cwd: string,
  stdinText?: string | undefined
) => {
  return await new Promise<{ stderr: string; stdout: string }>(
    (resolveCommand, rejectCommand) => {
      const child = execFile(
        command,
        args,
        { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 * 16 },
        (error, stdout, stderr) => {
          if (error != null) {
            rejectCommand(
              new Error(
                [
                  `Command failed: ${command} ${args.join(' ')}`,
                  `cwd: ${cwd}`,
                  '',
                  stdout,
                  stderr,
                ].join('\n')
              )
            );
            return;
          }

          resolveCommand({
            stderr,
            stdout,
          });
        }
      );

      child.stdin?.end(stdinText);
    }
  );
};

export const runCommandAllowFailure = async (
  command: string,
  args: string[],
  cwd: string,
  stdinText?: string | undefined
) => {
  return await new Promise<{
    exitCode: number;
    stderr: string;
    stdout: string;
  }>((resolveCommand) => {
    const child = execFile(
      command,
      args,
      { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 * 16 },
      (error, stdout, stderr) => {
        const exitCode =
          typeof error === 'object' &&
          error != null &&
          'code' in error &&
          typeof error.code === 'number'
            ? error.code
            : 0;

        resolveCommand({
          exitCode,
          stderr,
          stdout,
        });
      }
    );

    child.stdin?.end(stdinText);
  });
};

export const allocatePort = async () => {
  const server = createServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => resolveListen());
  });

  const address = server.address();
  if (address == null || typeof address === 'string') {
    server.close();
    throw new Error('Could not allocate a local TCP port.');
  }

  const port = address.port;
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) =>
      error != null ? rejectClose(error) : resolveClose()
    );
  });

  return port;
};

const sanitizeArtifactSegment = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  return normalized.length > 0 ? normalized : 'artifact';
};

export const resolveArtifactDirectory = async (artifactName: string) => {
  const testRunId = process.env.MODESTA_TEST_RUN_ID ?? 'unknown-test-run';
  const workerId =
    process.env.VITEST_WORKER_ID ??
    process.env.VITEST_POOL_ID ??
    `${process.pid}`;
  const artifactDirectory = resolve(
    process.cwd(),
    'test-results',
    testRunId,
    `${sanitizeArtifactSegment(artifactName)}--worker-${sanitizeArtifactSegment(workerId)}`
  );

  await mkdir(artifactDirectory, { recursive: true });
  return artifactDirectory;
};

export const saveArtifactText = async (
  artifactName: string | undefined,
  relativePath: string,
  content: string
) => {
  if (artifactName == null) {
    return;
  }

  const artifactDirectory = await resolveArtifactDirectory(artifactName);
  const artifactPath = join(artifactDirectory, relativePath);
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, content, 'utf8');
};

export const saveArtifactDirectory = async (
  artifactName: string | undefined,
  relativePath: string,
  sourceDirectory: string
) => {
  if (artifactName == null) {
    return;
  }

  const artifactDirectory = await resolveArtifactDirectory(artifactName);
  const artifactPath = join(artifactDirectory, relativePath);
  await rm(artifactPath, { force: true, recursive: true });
  await cp(sourceDirectory, artifactPath, {
    force: true,
    recursive: true,
  });
};

const writeProjectFiles = async (
  rootDirectory: string,
  project: SwaggerFixtureProject
) => {
  const csproj = [
    '<Project Sdk="Microsoft.NET.Sdk.Web">',
    '  <PropertyGroup>',
    '    <TargetFramework>net8.0</TargetFramework>',
    '    <Nullable>enable</Nullable>',
    '    <ImplicitUsings>enable</ImplicitUsings>',
    ...(project.csprojPropertyLines ?? []).map((line) => `    ${line}`),
    '  </PropertyGroup>',
    '  <ItemGroup>',
    '    <PackageReference Include="Swashbuckle.AspNetCore" Version="9.0.1" />',
    '  </ItemGroup>',
    '</Project>',
    '',
  ].join('\n');

  await writeFile(join(rootDirectory, 'Fixture.csproj'), csproj, 'utf8');
  for (const [relativePath, content] of Object.entries(project.files)) {
    const absolutePath = join(rootDirectory, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');
  }
};

export const fetchSwaggerJsonFromProject = async (
  project: SwaggerFixtureProject,
  artifactName: string | undefined
) => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'modesta-swagger-'));
  try {
    await writeProjectFiles(rootDirectory, project);

    if (artifactName != null) {
      const artifactDirectory = await resolveArtifactDirectory(artifactName);
      const projectArtifactDirectory = join(
        artifactDirectory,
        'aspnetcore-project'
      );
      await rm(projectArtifactDirectory, { force: true, recursive: true });
      await cp(rootDirectory, projectArtifactDirectory, {
        force: true,
        recursive: true,
      });
    }

    await runCommand('dotnet', ['restore'], rootDirectory);
    await runCommand('dotnet', ['build', '--no-restore'], rootDirectory);

    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const child = spawn('dotnet', ['run', '--no-build', '--urls', baseUrl], {
      cwd: rootDirectory,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let log = '';
    child.stdout.on('data', (chunk: Buffer | string) => {
      log += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      log += chunk.toString();
    });

    try {
      const swaggerUrl = `${baseUrl}/swagger/v1/swagger.json`;
      const startedAt = Date.now();
      while (true) {
        if (Date.now() - startedAt > 60000) {
          await saveArtifactText(artifactName, 'logs/aspnetcore.log', log);
          throw new Error(`Timed out while waiting for Swagger.\n\n${log}`);
        }

        if (child.exitCode != null) {
          await saveArtifactText(artifactName, 'logs/aspnetcore.log', log);
          throw new Error(
            `ASP.NET Core project exited before Swagger became ready.\n\n${log}`
          );
        }

        try {
          const response = await fetch(swaggerUrl);
          if (response.ok) {
            const swaggerJson = await response.text();
            await saveArtifactText(
              artifactName,
              'swagger/swagger.json',
              swaggerJson
            );
            await saveArtifactText(artifactName, 'logs/aspnetcore.log', log);
            return swaggerJson;
          }
        } catch {}

        await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
      }
    } finally {
      child.kill('SIGTERM');
      await once(child, 'exit').catch(() => undefined);
    }
  } finally {
    await rm(rootDirectory, { force: true, recursive: true });
  }
};

export const generateAccessorSourceFromProject = async (
  options: GenerateAccessorSourceFromProjectOptions
) => {
  const swaggerJson = await fetchSwaggerJsonFromProject(
    options.project,
    options.artifactName
  );
  const generatedSource = generateAccessorSource({
    document: swaggerJson,
    source: 'swagger.json',
    warningSink: options.warningSink,
  });
  await saveArtifactText(
    options.artifactName,
    options.generatedArtifactPath ?? 'generated/generated.ts',
    generatedSource
  );
  return generatedSource;
};

export const runModestaCli = async (
  swaggerDocument: string,
  artifactName: string | undefined,
  generatedArtifactPath: string | undefined,
  inputArtifactPath: string | undefined
) => {
  const workingDirectory = await mkdtemp(join(tmpdir(), 'modesta-cli-'));
  try {
    const swaggerPath = join(workingDirectory, 'swagger.json');
    const outputPath = join(workingDirectory, 'generated.ts');
    await writeFile(swaggerPath, swaggerDocument, 'utf8');
    await saveArtifactText(
      artifactName,
      inputArtifactPath ?? 'swagger/cli-input.json',
      swaggerDocument
    );

    const args = [
      resolve(process.cwd(), 'dist/cli.mjs'),
      swaggerPath,
      outputPath,
    ];

    await runCommand('node', args, process.cwd());
    const generatedSource = await readFile(outputPath, 'utf8');
    await saveArtifactText(
      artifactName,
      generatedArtifactPath ?? 'generated/generated-from-cli.ts',
      generatedSource
    );
    return generatedSource;
  } finally {
    await rm(workingDirectory, { force: true, recursive: true });
  }
};

export const transpileGeneratedSource = async (source: string) => {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  });

  expect(result.diagnostics ?? []).toEqual([]);

  const moduleDirectory = await mkdtemp(join(tmpdir(), 'modesta-generated-'));
  const modulePath = join(moduleDirectory, 'generated.mjs');
  await writeFile(modulePath, result.outputText, 'utf8');

  const imported = await import(
    `${pathToFileURL(modulePath).href}?t=${Date.now()}`
  );
  await rm(moduleDirectory, { force: true, recursive: true });
  return imported;
};

const formatTypeScriptDiagnostic = (diagnostic: ts.Diagnostic) => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (diagnostic.file == null || diagnostic.start == null) {
    return message;
  }

  const location = diagnostic.file.getLineAndCharacterOfPosition(
    diagnostic.start
  );
  return `${diagnostic.file.fileName}:${location.line + 1}:${location.character + 1} ${message}`;
};

export const getTypeScriptDiagnostics = async (
  files: Record<string, string>
) => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'modesta-typescript-'));
  try {
    const rootNames: string[] = [];
    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = join(rootDirectory, relativePath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content, 'utf8');
      rootNames.push(absolutePath);
    }

    const compilerOptions: ts.CompilerOptions = {
      allowImportingTsExtensions: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
      types: ['node'],
    };
    const program = ts.createProgram(rootNames, compilerOptions);

    return ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) => formatTypeScriptDiagnostic(diagnostic));
  } finally {
    await rm(rootDirectory, { force: true, recursive: true });
  }
};
