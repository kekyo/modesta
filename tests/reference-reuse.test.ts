// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { describe, expect, it } from 'vitest';
import { generateAccessorSource } from '../src/generator';
import { getTypeAliasStatement } from './support/source-assertions';

const generatedSource = generateAccessorSource({
  document: {
    openapi: '3.0.3',
    info: {
      title: 'Reference Reuse',
      version: '1.0.0',
    },
    paths: {
      '/users': {
        get: {
          operationId: 'GetUsers',
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/UserCollection',
                  },
                },
              },
            },
          },
        },
      },
      '/wrapped': {
        get: {
          operationId: 'GetWrappedUser',
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/WrappedUser',
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        User: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: {
              type: 'string',
            },
            name: {
              type: 'string',
            },
          },
        },
        UserAlias: {
          $ref: '#/components/schemas/User',
        },
        UserCollection: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/User',
          },
        },
        WrappedUserAlias: {
          allOf: [
            {
              $ref: '#/components/schemas/User',
            },
          ],
        },
        WrappedUser: {
          allOf: [
            {
              $ref: '#/components/schemas/User',
            },
            {
              type: 'object',
              required: ['role'],
              properties: {
                role: {
                  type: 'string',
                },
              },
            },
          ],
        },
      },
    },
  },
  source: 'swagger.json',
});

describe('reference reuse generation', () => {
  it('reuses component aliases instead of expanding them inline', () => {
    expect(getTypeAliasStatement(generatedSource, 'UserAlias')).toBe(
      'export type UserAlias = User;'
    );
  });

  it('reuses shared schema references inside component array items', () => {
    expect(getTypeAliasStatement(generatedSource, 'UserCollection')).toBe(
      'export type UserCollection = Array<User>;'
    );
  });

  it('reuses single-reference allOf wrappers as aliases', () => {
    expect(getTypeAliasStatement(generatedSource, 'WrappedUserAlias')).toBe(
      'export type WrappedUserAlias = User;'
    );
  });

  it('preserves shared schema references inside allOf intersections', () => {
    const wrappedUser = getTypeAliasStatement(generatedSource, 'WrappedUser');

    expect(wrappedUser).toContain('export type WrappedUser = User & {');
    expect(wrappedUser).toContain('role: string;');
  });

  it('uses shared schema references directly in operation response signatures', () => {
    expect(generatedSource).toContain(
      'readonly get: (options?: AccessorOptionsWithoutContext | undefined) => Promise<UserCollection>;'
    );
    expect(generatedSource).toContain(
      'readonly get: (options?: AccessorOptionsWithoutContext | undefined) => Promise<WrappedUser>;'
    );
    expect(generatedSource).not.toContain('GetUsers_get_response');
    expect(generatedSource).not.toContain('GetWrappedUser_get_response');
  });
});
