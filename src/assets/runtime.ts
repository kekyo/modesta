/////////////////////////////////////////////////////////////////////////////////

/**
 * Prepared request descriptor used by generated accessors.
 * @typeParam TRequestBody Request body payload type.
 */
export interface AccessorRequestDescriptor<TRequestBody> {
  /** Stable operation name used for diagnostics and tracing. */
  readonly operationName: string;
  /** HTTP method sent to the endpoint. */
  readonly method: string;
  /** Relative request URL including path and query string. */
  readonly url: string;
  /** HTTP headers applied to the outgoing request. */
  readonly headers: Record<string, string>;
  /** Request body payload passed to the sender. */
  readonly body: TRequestBody | undefined;
  /** Response header definitions used to project the sender result. */
  readonly responseHeaders: readonly AccessorResponseHeaderDescriptor[];
  /** Indicates that primitive or array response bodies must be exposed through a `body` member when response headers are also defined. */
  readonly wrapResponseBody: boolean;
}

/**
 * Response header projection metadata used by generated accessors.
 */
export interface AccessorResponseHeaderDescriptor {
  /** Header name as it appears on the wire. */
  readonly name: string;
  /** Property name exposed by the generated return type. */
  readonly propertyName: string;
  /** Simplified scalar shape used to parse the HTTP header string value. */
  readonly valueType: 'string' | 'number' | 'boolean' | 'array' | 'unknown';
  /** Item scalar shape when `valueType` is `array`. */
  readonly itemValueType?: 'string' | 'number' | 'boolean' | 'unknown' | undefined;
}

/** Shared options accepted by generated accessor methods. */
export interface AccessorOptions {
  /** Abort signal used to cancel the request. */
  readonly signal?: AbortSignal | undefined;
}

/** Additional options accepted by accessors that do not use per-call context values. */
export interface AccessorOptionsWithoutContext extends AccessorOptions {
  /** Per-call context values are not accepted by this accessor shape. */
  readonly context?: never;
}

/**
 * Additional options accepted by accessors that require a per-call context value.
 * @typeParam TAccessorContext Per-call context value type passed to the sender.
 */
export interface AccessorOptionsWithContext<TAccessorContext>
  extends AccessorOptions {
  /** Context value passed to the sender for this accessor call. */
  readonly context: TAccessorContext;
}

/**
 * Sender function used by generated accessors that do not require per-call context values.
 * @typeParam TResponse Response payload type.
 * @typeParam TRequestBody Request body payload type.
 * @typeParam TAccessorInterfaceContext Accessor interface context value type passed to the sender.
 * @param request Prepared request descriptor.
 * @param interfaceContext Context value bound when creating the accessor implementation.
 * @param options Additional accessor call options without per-call context.
 * @returns Promise that resolves to the typed response payload.
 */
export type AccessorSenderWithoutContext<TAccessorInterfaceContext> = <TResponse, TRequestBody>(
  request: AccessorRequestDescriptor<TRequestBody>,
  interfaceContext: TAccessorInterfaceContext | undefined,
  options: AccessorOptionsWithoutContext | undefined) => Promise<TResponse>;

/**
 * Sender function used by generated accessors that require per-call context values.
 * @typeParam TResponse Response payload type.
 * @typeParam TRequestBody Request body payload type.
 * @typeParam TAccessorInterfaceContext Accessor interface context value type passed to the sender.
 * @typeParam TAccessorContext Per-call context value type passed to the sender.
 * @param request Prepared request descriptor.
 * @param interfaceContext Context value bound when creating the accessor implementation.
 * @param options Additional accessor call options with per-call context.
 * @returns Promise that resolves to the typed response payload.
 */
export type AccessorSenderWithContext<TAccessorInterfaceContext, TAccessorContext> = <TResponse, TRequestBody>(
  request: AccessorRequestDescriptor<TRequestBody>,
  interfaceContext: TAccessorInterfaceContext | undefined,
  options: AccessorOptionsWithContext<TAccessorContext>) => Promise<TResponse>;

/** Options that configure the fetch-based sender. */
export interface CreateFetchSenderOptions {
  /** Base URL used to resolve generated accessor request URLs. */
  readonly baseUrl: string | URL;
  /** Fetch implementation to use. Defaults to globalThis.fetch. */
  readonly fetch?: typeof fetch | undefined;
  /** Default headers merged with per-request headers. */
  readonly headers?: Record<string, string> | undefined;
  /** Additional RequestInit values merged into every request. Generated accessors continue to control body, headers, method, and signal. */
  readonly init?: Omit<RequestInit, 'body' | 'headers' | 'method' | 'signal'> | undefined;
}

/////////////////////////////////////////////////////////////////////////////////

const modestaJsonMediaTypePattern = /json/i;
const modestaEmptyResponseHeaders: readonly AccessorResponseHeaderDescriptor[] = [];

const modestaEncodeQueryComponent = (value: string) =>
  encodeURIComponent(value).replaceAll('%20', '+');

const modestaBuildUrl = (
  path: string,
  pathParameters: Record<string, unknown>,
  queryParameters: Record<string, unknown>
) => {
  let resolvedPath = path;
  for (const key in pathParameters) {
    if (Object.hasOwn(pathParameters, key) === false) {
      continue;
    }

    resolvedPath = resolvedPath.replaceAll(
      `{${key}}`,
      encodeURIComponent(String(pathParameters[key]))
    );
  }

  let query = '';
  let queryPrefix = resolvedPath.includes('?') ? '&' : '?';
  for (const key in queryParameters) {
    if (Object.hasOwn(queryParameters, key) === false) {
      continue;
    }

    const value = queryParameters[key];
    if (value != null) {
      query += queryPrefix;
      queryPrefix = '&';
      query += modestaEncodeQueryComponent(key);
      query += '=';
      query += modestaEncodeQueryComponent(String(value));
    }
  }
  return `${resolvedPath}${query}`;
};

const modestaBuildHeaders = (
  headerParameters: Record<string, unknown>,
  contentType: string | undefined,
  accept: string | undefined
) => {
  const headers: Record<string, string> = {};
  for (const key in headerParameters) {
    if (Object.hasOwn(headerParameters, key) === false) {
      continue;
    }

    const value = headerParameters[key];
    if (value != null) {
      headers[key] = String(value);
    }
  }
  if (contentType != null) {
    headers['content-type'] = contentType;
  }
  if (accept != null) {
    headers.accept = accept;
  }
  return headers;
};

const modestaSerializeFetchBody = (
  body: any,
  contentType: string | undefined
) => {
  if (body == null) {
    return undefined;
  }
  return contentType != null && modestaJsonMediaTypePattern.test(contentType)
    ? JSON.stringify(body)
    : body;
};

const modestaHasPropertyName = (
  propertyNames: readonly string[],
  propertyName: string
) => {
  for (let index = 0; index < propertyNames.length; index += 1) {
    if (propertyNames[index] === propertyName) {
      return true;
    }
  }
  return false;
};

const modestaExcludeProperties = (
  value: unknown,
  propertyNames: readonly string[]
) => {
  if (value == null || typeof value !== 'object') {
    return value;
  }

  if (propertyNames.length === 0) {
    return value;
  }

  if (Array.isArray(value)) {
    const clonedValue = value.slice();
    for (let index = 0; index < propertyNames.length; index += 1) {
      delete (clonedValue as unknown as Record<string, unknown>)[
        propertyNames[index]
      ];
    }
    return clonedValue;
  }

  const sourceValue = value as Record<string, unknown>;
  const projectedValue: Record<string, unknown> = {};
  for (const key in sourceValue) {
    if (
      Object.hasOwn(sourceValue, key) &&
      modestaHasPropertyName(propertyNames, key) === false
    ) {
      projectedValue[key] = sourceValue[key];
    }
  }
  return projectedValue;
};

const modestaParseResponseHeaderScalar = (
  value: string,
  valueType:
    | AccessorResponseHeaderDescriptor['valueType']
    | AccessorResponseHeaderDescriptor['itemValueType']
) => {
  switch (valueType) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'string':
    case 'unknown':
    case 'array':
    default:
      return value;
  }
};

const modestaParseResponseHeaderValue = (
  value: string,
  descriptor: AccessorResponseHeaderDescriptor
) => {
  if (descriptor.valueType === 'array') {
    return value
      .split(',')
      .map((entry) =>
        modestaParseResponseHeaderScalar(
          entry.trim(),
          descriptor.itemValueType ?? 'unknown'
        )
      );
  }

  return modestaParseResponseHeaderScalar(value, descriptor.valueType);
};

const modestaReadResponseHeaders = (
  response: Response,
  descriptors: readonly AccessorResponseHeaderDescriptor[]
) => {
  const projectedHeaders: Record<string, unknown> = {};
  for (const descriptor of descriptors) {
    const headerValue = response.headers.get(descriptor.name);
    if (headerValue == null) {
      continue;
    }
    projectedHeaders[descriptor.propertyName] = modestaParseResponseHeaderValue(
      headerValue,
      descriptor
    );
  }
  return projectedHeaders;
};

const modestaProjectResponse = (
  body: unknown,
  projectedHeaders: Record<string, unknown>,
  wrapResponseBody: boolean
) => {
  if (body == null) {
    return Object.keys(projectedHeaders).length === 0
      ? undefined
      : projectedHeaders;
  }
  if (Object.keys(projectedHeaders).length === 0) {
    return body;
  }
  if (wrapResponseBody) {
    return {
      body,
      ...projectedHeaders,
    };
  }
  return {
    ...(body as Record<string, unknown>),
    ...projectedHeaders,
  };
};

const modestaReadResponseBody = (response: Response) => {
  if (
    response.status === 204 ||
    response.status === 205 ||
    response.status === 304 ||
    response.headers.get('content-length') === '0'
  ) {
    return Promise.resolve(undefined);
  }

  const responseContentType = response.headers.get('content-type');
  if (
    responseContentType != null &&
    modestaJsonMediaTypePattern.test(responseContentType)
  ) {
    return response.json();
  }

  return response.text();
};

/////////////////////////////////////////////////////////////////////////////////

/**
 * Creates a sender implementation backed by the fetch API.
 * @param options Options that configure the fetch-based sender.
 * @returns Sender implementation that executes requests via the fetch API.
 * @remarks When `options.fetch` is omitted, `globalThis.fetch` must be available.
 * Accessor interface context values are ignored by this sender implementation.
 */
export const createFetchSender = (options: CreateFetchSenderOptions): AccessorSenderWithoutContext<undefined> => {
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  if (typeof fetchImplementation !== 'function') {
    throw new Error(
      'Fetch implementation is not available. Pass CreateFetchSenderOptions.fetch explicitly.'
    );
  }

  return async <TResponse, TRequestBody>(
    request: AccessorRequestDescriptor<TRequestBody>,
    _interfaceContext: undefined,
    accessorOptions: AccessorOptionsWithoutContext | undefined
  ) => {
    const response = await fetchImplementation(
      new URL(request.url, options.baseUrl),
      {
        ...(options.init ?? {}),
        method: request.method,
        headers: {
          ...(options.headers ?? {}),
          ...request.headers,
        },
        body: modestaSerializeFetchBody(request.body, request.headers['content-type']),
        signal: accessorOptions?.signal,
      }
    );

    if (response.ok === false) {
      const responseText = await response.text();
      const statusText = response.statusText.length > 0
        ? ` ${response.statusText}`
        : '';
      throw new Error(
        responseText.length > 0
          ? `Fetch request failed with ${response.status}${statusText}: ${responseText}`
          : `Fetch request failed with ${response.status}${statusText}.`
      );
    }

    const projectedHeaders = modestaReadResponseHeaders(
      response,
      request.responseHeaders
    );
    const responseBody = await modestaReadResponseBody(response);

    return modestaProjectResponse(
      responseBody,
      projectedHeaders,
      request.wrapResponseBody
    ) as TResponse;
  };
};

/////////////////////////////////////////////////////////////////////////////////
