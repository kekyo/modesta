// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { spawn } from 'child_process';
import { once } from 'events';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

import { generateAccessorSource } from '../../../src/generator';
import type { GenerateAccessorWarningSink } from '../../../src/types';
import {
  allocatePort,
  runCommandAllowFailure,
  saveArtifactDirectory,
  saveArtifactText,
} from '../../support/harness';

export interface PlatformServerFixture {
  readonly artifactName: string;
  readonly containerPort: number;
  readonly fixtureDirectory: string;
  readonly generatedArtifactPath?: string | undefined;
  readonly openApiArtifactPath?: string | undefined;
  readonly openApiPath: string;
  readonly platformName: string;
  readonly warningSink?: GenerateAccessorWarningSink | undefined;
}

export interface PlatformServerResult {
  readonly generatedSource: string;
  readonly openApiDocument: string;
}

const sanitizeContainerSegment = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  return normalized.length > 0 ? normalized : 'platform';
};

const appendLog = (current: string, label: string, value: string) => {
  if (value.length === 0) {
    return current;
  }

  return `${current}${current.length > 0 ? '\n' : ''}# ${label}\n${value}`;
};

const failCommand = (
  command: string,
  args: readonly string[],
  cwd: string,
  stdout: string,
  stderr: string
) => {
  throw new Error(
    [
      `Command failed: ${command} ${args.join(' ')}`,
      `cwd: ${cwd}`,
      '',
      stdout,
      stderr,
    ].join('\n')
  );
};

export const fetchOpenApiFromPlatformServer = async (
  fixture: PlatformServerFixture
): Promise<PlatformServerResult> => {
  const rootDirectory = resolve(process.cwd());
  const fixtureDirectory = resolve(rootDirectory, fixture.fixtureDirectory);
  await saveArtifactDirectory(
    fixture.artifactName,
    'fixture',
    fixtureDirectory
  );

  const buildContextDirectory = await mkdtemp(
    join(tmpdir(), `modesta-${fixture.platformName}-`)
  );
  const imageTag = [
    'localhost/modesta-platform',
    sanitizeContainerSegment(fixture.platformName),
    sanitizeContainerSegment(process.env.MODESTA_TEST_RUN_ID ?? 'manual'),
    `${process.pid}`,
    `${Date.now()}`,
  ].join('-');
  const containerName = imageTag.replace(/[^a-zA-Z0-9_.-]+/gu, '-');
  let podmanLog = '';

  try {
    const copyResult = await runCommandAllowFailure(
      'cp',
      ['-R', `${fixtureDirectory}/.`, buildContextDirectory],
      rootDirectory
    );
    podmanLog = appendLog(
      appendLog(podmanLog, 'copy stdout', copyResult.stdout),
      'copy stderr',
      copyResult.stderr
    );
    if (copyResult.exitCode !== 0) {
      await saveArtifactText(
        fixture.artifactName,
        'logs/podman.log',
        podmanLog
      );
      failCommand(
        'cp',
        ['-R', `${fixtureDirectory}/.`, buildContextDirectory],
        rootDirectory,
        copyResult.stdout,
        copyResult.stderr
      );
    }

    const buildArgs = ['build', '-t', imageTag, buildContextDirectory];
    const buildResult = await runCommandAllowFailure(
      'podman',
      buildArgs,
      rootDirectory
    );
    podmanLog = appendLog(
      appendLog(podmanLog, 'podman build stdout', buildResult.stdout),
      'podman build stderr',
      buildResult.stderr
    );
    await saveArtifactText(fixture.artifactName, 'logs/podman.log', podmanLog);
    if (buildResult.exitCode !== 0) {
      failCommand(
        'podman',
        buildArgs,
        rootDirectory,
        buildResult.stdout,
        buildResult.stderr
      );
    }

    const port = await allocatePort();
    const child = spawn(
      'podman',
      [
        'run',
        '--rm',
        '--name',
        containerName,
        '-p',
        `127.0.0.1:${port}:${fixture.containerPort}`,
        imageTag,
      ],
      {
        cwd: rootDirectory,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let containerLog = '';
    child.stdout.on('data', (chunk: Buffer | string) => {
      containerLog += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      containerLog += chunk.toString();
    });

    try {
      const openApiUrl = `http://127.0.0.1:${port}${fixture.openApiPath}`;
      const startedAt = Date.now();
      while (true) {
        if (Date.now() - startedAt > 120000) {
          await saveArtifactText(
            fixture.artifactName,
            'logs/container.log',
            containerLog
          );
          throw new Error(
            `Timed out while waiting for ${fixture.platformName} OpenAPI.\n\n${containerLog}`
          );
        }

        if (child.exitCode != null) {
          await saveArtifactText(
            fixture.artifactName,
            'logs/container.log',
            containerLog
          );
          throw new Error(
            `${fixture.platformName} container exited before OpenAPI became ready.\n\n${containerLog}`
          );
        }

        try {
          const response = await fetch(openApiUrl);
          if (response.ok) {
            const openApiDocument = await response.text();
            await saveArtifactText(
              fixture.artifactName,
              fixture.openApiArtifactPath ?? 'openapi/openapi.json',
              openApiDocument
            );
            const generatedSource = generateAccessorSource({
              document: openApiDocument,
              source: 'openapi.json',
              warningSink: fixture.warningSink,
            });
            await saveArtifactText(
              fixture.artifactName,
              fixture.generatedArtifactPath ?? 'generated/generated.ts',
              generatedSource
            );
            await saveArtifactText(
              fixture.artifactName,
              'logs/container.log',
              containerLog
            );
            return {
              generatedSource,
              openApiDocument,
            };
          }
        } catch {}

        await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
      }
    } finally {
      if (child.exitCode == null) {
        await runCommandAllowFailure(
          'podman',
          ['stop', '--time', '2', containerName],
          rootDirectory
        );
        await once(child, 'exit').catch(() => undefined);
      }
      await saveArtifactText(
        fixture.artifactName,
        'logs/container.log',
        containerLog
      );
    }
  } finally {
    const removeImageResult = await runCommandAllowFailure(
      'podman',
      ['rmi', '--force', imageTag],
      rootDirectory
    );
    if (
      removeImageResult.stdout.length > 0 ||
      removeImageResult.stderr.length > 0
    ) {
      podmanLog = appendLog(
        appendLog(podmanLog, 'podman rmi stdout', removeImageResult.stdout),
        'podman rmi stderr',
        removeImageResult.stderr
      );
      await saveArtifactText(
        fixture.artifactName,
        'logs/podman.log',
        podmanLog
      );
    }
    await rm(buildContextDirectory, { force: true, recursive: true });
  }
};
