// modesta - Simplest zero-dependency swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { expect } from 'vitest';

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const findDocumentationBeforeIndex = (
  source: string,
  index: number,
  label: string
) => {
  const documentationEnd = source.lastIndexOf('*/', index);
  if (documentationEnd < 0) {
    throw new Error(`Could not find documentation for ${label}.`);
  }

  const documentationStart = source.lastIndexOf('/**', documentationEnd);
  if (documentationStart < 0) {
    throw new Error(`Could not find documentation start for ${label}.`);
  }

  const betweenDocumentationAndTarget = source.slice(
    documentationEnd + 2,
    index
  );
  if (/^\s*$/u.test(betweenDocumentationAndTarget) === false) {
    throw new Error(
      `Found non-whitespace content between documentation and ${label}.`
    );
  }

  return source.slice(documentationStart, documentationEnd + 2);
};

const findInterfaceDeclaration = (source: string, interfaceName: string) => {
  const pattern = new RegExp(
    `export interface ${escapeRegExp(interfaceName)}(?:<[^\\n{]+>)?(?:\\s+extends[^{]+)?\\s*\\{`,
    'u'
  );
  const match = pattern.exec(source);
  if (match == null || match.index == null) {
    throw new Error(`Could not find interface '${interfaceName}'.`);
  }

  return {
    declaration: match[0],
    startIndex: match.index,
  };
};

const findTypeAliasDeclaration = (source: string, typeName: string) => {
  const pattern = new RegExp(
    `export type ${escapeRegExp(typeName)}(?:<[^\\n]+?>)? = `,
    'u'
  );
  const match = pattern.exec(source);
  if (match == null || match.index == null) {
    throw new Error(`Could not find type alias '${typeName}'.`);
  }

  return {
    declaration: match[0],
    startIndex: match.index,
  };
};

const extractBalancedBlock = (source: string, startIndex: number) => {
  let depth = 0;
  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') {
      depth += 1;
      continue;
    }
    if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  throw new Error('Could not find the end of the block.');
};

export const getInterfaceBlock = (source: string, interfaceName: string) => {
  const { declaration, startIndex } = findInterfaceDeclaration(
    source,
    interfaceName
  );
  const braceIndex = source.indexOf('{', startIndex);
  if (braceIndex < 0) {
    throw new Error(`Could not find interface body for '${interfaceName}'.`);
  }

  return (
    source.slice(startIndex, startIndex + declaration.indexOf('{')) +
    extractBalancedBlock(source, braceIndex)
  );
};

export const getTypeAliasStatement = (source: string, typeName: string) => {
  const { declaration, startIndex } = findTypeAliasDeclaration(
    source,
    typeName
  );

  let angleDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (
    let index = startIndex + declaration.length;
    index < source.length;
    index += 1
  ) {
    const character = source[index];
    if (character === '<') {
      angleDepth += 1;
      continue;
    }
    if (character === '>') {
      angleDepth -= 1;
      continue;
    }
    if (character === '{') {
      braceDepth += 1;
      continue;
    }
    if (character === '}') {
      braceDepth -= 1;
      continue;
    }
    if (character === '[') {
      bracketDepth += 1;
      continue;
    }
    if (character === ']') {
      bracketDepth -= 1;
      continue;
    }
    if (character === '(') {
      parenDepth += 1;
      continue;
    }
    if (character === ')') {
      parenDepth -= 1;
      continue;
    }
    if (
      character === ';' &&
      angleDepth === 0 &&
      braceDepth === 0 &&
      bracketDepth === 0 &&
      parenDepth === 0
    ) {
      return source.slice(startIndex, index + 1);
    }
  }

  throw new Error(`Could not find the end of type alias '${typeName}'.`);
};

export const getInterfaceDocumentation = (
  source: string,
  interfaceName: string
) => {
  const { startIndex } = findInterfaceDeclaration(source, interfaceName);
  return findDocumentationBeforeIndex(
    source,
    startIndex,
    `interface '${interfaceName}'`
  );
};

export const getTypeAliasDocumentation = (source: string, typeName: string) => {
  const { startIndex } = findTypeAliasDeclaration(source, typeName);

  return findDocumentationBeforeIndex(source, startIndex, `type '${typeName}'`);
};

export const getConstDocumentation = (source: string, constName: string) => {
  const marker = `export const ${constName} = `;
  const constIndex = source.indexOf(marker);
  if (constIndex < 0) {
    throw new Error(`Could not find const '${constName}'.`);
  }

  return findDocumentationBeforeIndex(
    source,
    constIndex,
    `const '${constName}'`
  );
};

export const getFunctionDocumentation = (
  source: string,
  functionName: string
) => {
  const marker = `export function ${functionName}`;
  const functionIndex = source.indexOf(marker);
  if (functionIndex < 0) {
    throw new Error(`Could not find function '${functionName}'.`);
  }

  return findDocumentationBeforeIndex(
    source,
    functionIndex,
    `function '${functionName}'`
  );
};

export const expectMemberDocumentation = (
  block: string,
  memberName: string,
  expectedDocumentation: string
) => {
  const pattern = new RegExp(
    `${escapeRegExp(expectedDocumentation)}\\n\\s+(?:readonly\\s+)?${escapeRegExp(memberName)}(?:\\?|):`,
    'u'
  );
  expect(block).toMatch(pattern);
};

export const expectMethodDocumentation = (
  block: string,
  methodName: string,
  expectedDocumentation: string
) => {
  const pattern = new RegExp(
    `${escapeRegExp(expectedDocumentation)}\\n\\s+(?:readonly\\s+)?${escapeRegExp(methodName)}:`,
    'u'
  );
  expect(block).toMatch(pattern);
};
