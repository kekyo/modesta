/////////////////////////////////////////////////////////////////////////////////

/**
 * Prepared request descriptor used by generated accessors.
 */
export interface AccessorRequestDescriptor {
  /** Stable operation name used for diagnostics and tracing. */
  readonly operationName: string;
  /** HTTP method sent to the endpoint. */
  readonly method: string;
  /** Relative request URL including path and query string. */
  readonly url: string;
  /** HTTP headers applied to the outgoing request. */
  readonly headers: Record<string, string>;
  /** Request body payload passed to the sender. */
  readonly body: unknown;
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
 * @param request Prepared request descriptor.
 * @param options Additional accessor call options without per-call context.
 * @returns Promise that resolves to the typed response payload.
 */
export type AccessorSenderWithoutContext = <TResponse>(
  request: AccessorRequestDescriptor,
  options: AccessorOptionsWithoutContext | undefined) => Promise<TResponse>;

/**
 * Sender function used by generated accessors that require per-call context values.
 * @typeParam TResponse Response payload type.
 * @typeParam TAccessorContext Per-call context value type passed to the sender.
 * @param request Prepared request descriptor.
 * @param options Additional accessor call options with per-call context.
 * @returns Promise that resolves to the typed response payload.
 */
export type AccessorSenderWithContext<TAccessorContext> = <TResponse>(
  request: AccessorRequestDescriptor,
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

/**
 * Options that configure request preparation for custom sender implementations.
 */
export interface ModestaPrepareRequestOptions {
  /** Base URL used to resolve generated accessor request URLs. */
  readonly baseUrl: string | URL;
  /** Default headers merged with per-request headers. */
  readonly headers?: Record<string, string> | undefined;
}

/**
 * Transport-neutral request values prepared for a sender implementation.
 */
export interface ModestaPreparedRequest {
  /** Absolute request URL resolved against the configured base URL. */
  readonly url: URL;
  /** HTTP method sent to the endpoint. */
  readonly method: string;
  /** Merged request headers, or undefined when no headers are present. */
  readonly headers: Record<string, string> | undefined;
  /** Original request body payload before transport-specific serialization. */
  readonly body: unknown;
  /** Abort signal forwarded from the accessor call options. */
  readonly signal: AbortSignal | undefined;
}

/**
 * Transport response values supplied to response projection helpers.
 */
export interface ModestaResponseSource {
  /** Function that reads a response header value by its wire name. */
  readonly getHeader: (name: string) => string | null | undefined;
  /** Parsed or transport-native response body value. */
  readonly body: unknown;
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

const modestaHasOwnProperties = (value: object) => {
  for (const key in value) {
    if (Object.hasOwn(value, key)) {
      return true;
    }
  }
  return false;
};

const modestaMergeRequestHeaders = (
  defaultHeaders: Record<string, string> | undefined,
  requestHeaders: Record<string, string>
) => {
  const hasDefaultHeaders =
    !!defaultHeaders && modestaHasOwnProperties(defaultHeaders);
  const hasRequestHeaders = modestaHasOwnProperties(requestHeaders);

  if (hasDefaultHeaders) {
    return hasRequestHeaders
      ? {
          ...defaultHeaders,
          ...requestHeaders,
        }
      : defaultHeaders;
  }

  return hasRequestHeaders ? requestHeaders : undefined;
};

const modestaAssignProperties = (
  target: Record<string, unknown>,
  source: Record<string, unknown>
) => {
  for (const key in source) {
    if (Object.hasOwn(source, key)) {
      target[key] = source[key];
    }
  }
  return target;
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

const modestaParseResponseHeaderArrayValue = (
  value: string,
  itemValueType: AccessorResponseHeaderDescriptor['itemValueType']
) => {
  const values: unknown[] = [];
  let entryStart = 0;

  for (let index = 0; index <= value.length; index += 1) {
    if (index !== value.length && value.charCodeAt(index) !== 44) {
      continue;
    }

    values.push(
      modestaParseResponseHeaderScalar(
        value.slice(entryStart, index).trim(),
        itemValueType ?? 'unknown'
      )
    );
    entryStart = index + 1;
  }

  return values;
};

const modestaParseResponseHeaderValue = (
  value: string,
  descriptor: AccessorResponseHeaderDescriptor
) => {
  if (descriptor.valueType === 'array') {
    return modestaParseResponseHeaderArrayValue(
      value,
      descriptor.itemValueType
    );
  }

  return modestaParseResponseHeaderScalar(value, descriptor.valueType);
};

const modestaReadResponseHeaders = (
  getHeader: (name: string) => string | null | undefined,
  descriptors: readonly AccessorResponseHeaderDescriptor[]
) => {
  if (descriptors.length === 0) {
    return undefined;
  }

  let projectedHeaders: Record<string, unknown> | undefined;
  for (const descriptor of descriptors) {
    const headerValue = getHeader(descriptor.name);
    if (headerValue == null) {
      continue;
    }
    projectedHeaders ??= {};
    projectedHeaders[descriptor.propertyName] = modestaParseResponseHeaderValue(
      headerValue,
      descriptor
    );
  }
  return projectedHeaders;
};

const modestaComposeResponse = (
  body: unknown,
  projectedHeaders: Record<string, unknown> | undefined,
  wrapResponseBody: boolean
) => {
  if (projectedHeaders == null) {
    return body == null ? undefined : body;
  }
  if (body == null) {
    return projectedHeaders;
  }
  if (wrapResponseBody) {
    return modestaAssignProperties(
      {
        body,
      },
      projectedHeaders
    );
  }
  if (typeof body === 'object' && Array.isArray(body) === false) {
    return modestaAssignProperties(
      body as Record<string, unknown>,
      projectedHeaders
    );
  }
  return modestaAssignProperties(
    { ...(body as Record<string, unknown>) },
    projectedHeaders
  );
};

/////////////////////////////////////////////////////////////////////////////////

/**
 * Prepares transport-neutral request values for a sender implementation.
 * @param request Prepared request descriptor emitted by the generated accessor.
 * @param accessorOptions Additional accessor call options passed to the sender.
 * @param options Options that configure request preparation.
 * @returns Request values resolved against the configured base URL.
 * @remarks The returned `body` is not serialized. Use `modestaSerializeRequestBody()` when a transport expects a serialized payload.
 */
export const modestaPrepareRequest = (
  request: AccessorRequestDescriptor,
  accessorOptions: AccessorOptions | undefined,
  options: ModestaPrepareRequestOptions
): ModestaPreparedRequest => ({
  url: new URL(request.url, options.baseUrl),
  method: request.method,
  headers: modestaMergeRequestHeaders(options.headers, request.headers),
  body: request.body,
  signal: accessorOptions?.signal,
});

/**
 * Serializes a request body using the accessor request content type.
 * @param request Prepared request descriptor emitted by the generated accessor.
 * @returns Serialized body value for fetch-style transports, or undefined when the request has no body.
 * @remarks JSON media types are stringified. Other body values are returned as-is.
 */
export const modestaSerializeRequestBody = (
  request: AccessorRequestDescriptor
) => modestaSerializeFetchBody(request.body, request.headers['content-type']);

/**
 * Projects a transport response into the generated accessor response shape.
 * @typeParam TResponse Response payload type.
 * @param request Prepared request descriptor emitted by the generated accessor.
 * @param response Transport response values used to project response headers and body.
 * @returns Response value that matches the generated accessor contract.
 * @remarks Response headers defined by the accessor are parsed and merged into the returned body shape.
 */
export const modestaProjectResponse = <TResponse>(
  request: AccessorRequestDescriptor,
  response: ModestaResponseSource
) =>
  modestaComposeResponse(
    response.body,
    modestaReadResponseHeaders(response.getHeader, request.responseHeaders),
    request.wrapResponseBody
  ) as TResponse;

/**
 * Reads a response body from a fetch-compatible response object.
 * @param response Fetch-compatible response object.
 * @returns Parsed response body value, or undefined for empty responses.
 * @remarks JSON media types are parsed with `response.json()`. Other bodies are read with `response.text()`.
 */
export const modestaReadFetchResponseBody = (response: Response) => {
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
 * Per-call context values are not accepted by this sender implementation.
 */
export const createFetchSender = (options: CreateFetchSenderOptions): AccessorSenderWithoutContext => {
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  if (typeof fetchImplementation !== 'function') {
    throw new Error(
      'Fetch implementation is not available. Pass CreateFetchSenderOptions.fetch explicitly.'
    );
  }

  return async (request, accessorOptions) => {
    const preparedRequest = modestaPrepareRequest(
      request,
      accessorOptions,
      options
    );
    const body = modestaSerializeRequestBody(request);
    const requestInit: RequestInit =
      options.init
        ? {
            ...options.init,
            method: preparedRequest.method,
          }
        : {
            method: preparedRequest.method,
          };

    if (preparedRequest.headers) {
      requestInit.headers = preparedRequest.headers;
    }
    if (body !== undefined) {
      requestInit.body = body as RequestInit['body'];
    }
    if (preparedRequest.signal) {
      requestInit.signal = preparedRequest.signal;
    }

    const response = await fetchImplementation(preparedRequest.url, requestInit);

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

    const responseBody = await modestaReadFetchResponseBody(response);

    return modestaProjectResponse(request, {
      body: responseBody,
      getHeader: (name) => response.headers.get(name),
    });
  };
};

/////////////////////////////////////////////////////////////////////////////////
