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
  /** Expected response content type selected from the OpenAPI response definition. */
  readonly responseContentType: string | undefined;
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
export interface AccessorOptionsBase {
  /** Abort signal used to cancel the request. */
  readonly signal?: AbortSignal | undefined;
}

/** Additional options accepted by accessors that do not use per-call context values. */
export interface AccessorOptions extends AccessorOptionsBase {
  /** Per-call context values are not accepted by this accessor shape. */
  readonly context?: never;
}

/**
 * Additional options accepted by accessors that require a per-call context value.
 * @typeParam TAccessorContext Per-call context value type passed to the sender.
 */
export interface AccessorOptionsWithContext<TAccessorContext>
  extends AccessorOptionsBase {
  /** Context value passed to the sender for this accessor call. */
  readonly context: TAccessorContext;
}

/**
 * Serialized transport payload data shape used by serializers.
 */
export type PayloadType = 'string' | 'ArrayBuffer';

/**
 * Serialization hooks used by sender implementations.
 */
export interface AccessorSenderSerializer {
  /** Serialized payload data shape used by this serializer. */
  readonly payloadType: PayloadType;
  /**
   * Serializes a request body value into transport data.
   * @param value Target value
   * @returns Serialized payload data
   */
  readonly serialize: (value: unknown) => unknown;
  /**
   * Deserializes transport data into a response body value.
   * @param payloadData Serialized payload data
   * @returns Retrieved value
   */
  readonly deserialize: (payloadData: unknown) => unknown;
}

/**
 * @deprecated Use `AccessorSenderInterface` instead.
 */
export type AccessorSenderFunction = <TResponse>(
  request: AccessorRequestDescriptor,
  options: AccessorOptions | undefined) => Promise<TResponse>;

/**
 * Sender object used by generated accessors that do not require per-call context values.
 */
export interface AccessorSenderInterface {
  /** Serialization hooks keyed by normalized media type. */
  readonly serializers: ReadonlyMap<string, AccessorSenderSerializer>;
  /**
   * Executes a prepared request.
   * @typeParam TResponse Response payload type.
   * @param request Prepared request descriptor.
   * @param options Additional accessor call options without per-call context.
   * @returns Promise that resolves to the typed response payload.
   */
  readonly send: <TResponse>(
    request: AccessorRequestDescriptor,
    options: AccessorOptions | undefined) => Promise<TResponse>;
}

/**
 * Sender implementation used by generated accessors that do not require per-call context values.
 */
export type AccessorSender = AccessorSenderFunction | AccessorSenderInterface;

/**
 * @deprecated Use `AccessorSenderInterfaceWithContext` instead.
 */
export type AccessorSenderFunctionWithContext<TAccessorContext> = <TResponse>(
  request: AccessorRequestDescriptor,
  options: AccessorOptionsWithContext<TAccessorContext>) => Promise<TResponse>;

/**
 * Sender object used by generated accessors that require per-call context values.
 * @typeParam TAccessorContext Per-call context value type passed to the sender.
 */
export interface AccessorSenderInterfaceWithContext<TAccessorContext> {
  /** Serialization hooks keyed by normalized media type. */
  readonly serializers: ReadonlyMap<string, AccessorSenderSerializer>;
  /**
   * Executes a prepared request.
   * @typeParam TResponse Response payload type.
   * @param request Prepared request descriptor.
   * @param options Additional accessor call options with per-call context.
   * @returns Promise that resolves to the typed response payload.
   */
  readonly send: <TResponse>(
    request: AccessorRequestDescriptor,
    options: AccessorOptionsWithContext<TAccessorContext>) => Promise<TResponse>;
}

/**
 * Sender implementation used by generated accessors that require per-call context values.
 * @typeParam TAccessorContext Per-call context value type passed to the sender.
 */
export type AccessorSenderWithContext<TAccessorContext> =
  | AccessorSenderFunctionWithContext<TAccessorContext>
  | AccessorSenderInterfaceWithContext<TAccessorContext>;

/** Options that configure the fetch-based sender. */
export interface CreateFetchSenderOptions {
  /** Base URL used to resolve generated accessor request URLs. Defaults to globalThis.location.origin when available. */
  readonly baseUrl?: string | URL | undefined;
  /** Fetch implementation to use. Defaults to globalThis.fetch. */
  readonly fetch?: typeof fetch | undefined;
  /** Default headers merged with per-request headers. */
  readonly headers?: Record<string, string> | undefined;
  /** Additional RequestInit values merged into every request. Generated accessors continue to control body, headers, method, and signal. */
  readonly init?: Omit<RequestInit, 'body' | 'headers' | 'method' | 'signal'> | undefined;
  /** Serialization hooks keyed by media type. Defaults to `modestaDefaultSerializers`. */
  readonly serializers?: ReadonlyMap<string, AccessorSenderSerializer> | undefined;
}

/**
 * Options that configure request preparation for custom sender implementations.
 */
export interface ModestaPrepareRequestOptions {
  /** Base URL used to resolve generated accessor request URLs. Defaults to globalThis.location.origin when available. */
  readonly baseUrl?: string | URL | undefined;
  /** Default headers merged with per-request headers. */
  readonly headers?: Record<string, string> | undefined;
}

/**
 * Transport-neutral request values prepared for a sender implementation.
 */
export interface ModestaPreparedRequest {
  /** Absolute request URL resolved against the active base URL. */
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

const modestaNormalizeMediaType = (contentType: string | undefined) => {
  if (contentType == null) {
    return undefined;
  }

  const mediaTypeDelimiter = contentType.indexOf(';');
  const mediaType = (
    mediaTypeDelimiter >= 0
      ? contentType.slice(0, mediaTypeDelimiter)
      : contentType
  )
    .trim()
    .toLowerCase();
  return mediaType.length > 0 ? mediaType : undefined;
};

const modestaFindSerializer = (
  serializers: ReadonlyMap<string, AccessorSenderSerializer>,
  contentType: string | undefined
) => {
  const mediaType = modestaNormalizeMediaType(contentType);
  if (!mediaType) {
    return undefined;
  }

  return (
    serializers.get(mediaType) ??
    (mediaType.endsWith('+json') ? serializers.get('application/json') : undefined)
  );
};

const modestaSerializeFetchBody = (
  body: unknown,
  contentType: string | undefined,
  serializers: ReadonlyMap<string, AccessorSenderSerializer>
) => {
  const serializer = modestaFindSerializer(serializers, contentType);
  return serializer != null ? serializer.serialize(body) : body;
};

const modestaCreateSerializers = (
  serializers: ReadonlyMap<string, AccessorSenderSerializer> | undefined
): ReadonlyMap<string, AccessorSenderSerializer> => {
  if (serializers == null) {
    return modestaDefaultSerializers;
  }

  const resolvedSerializers = new Map(modestaDefaultSerializers);
  serializers.forEach((serializer, contentType) => {
    const mediaType = modestaNormalizeMediaType(contentType);
    if (mediaType != null) {
      resolvedSerializers.set(mediaType, serializer);
    }
  });
  return resolvedSerializers;
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

const modestaGetDefaultBaseUrl = () => {
  const globalScope = globalThis as typeof globalThis & {
    readonly location?: {
      readonly origin?: string | undefined;
    } | undefined;
  };
  const origin = globalScope.location?.origin;
  if (origin != null && origin.length > 0) {
    return origin;
  }

  throw new Error(
    'Base URL is not available. Pass baseUrl explicitly outside browser-like environments.'
  );
};

const modestaResolveBaseUrl = (baseUrl: string | URL | undefined) =>
  baseUrl ?? modestaGetDefaultBaseUrl();

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

const modestaSend = <TResponse>(
  sender: unknown, // AccessorSender | AccessorSenderWithContext<TAccessorContext>
  request: AccessorRequestDescriptor,
  options: unknown
) => {
  if (typeof sender === 'function') {
    return (sender as <TResult>(
      request: AccessorRequestDescriptor,
      options: unknown
    ) => Promise<TResult>)<TResponse>(request, options);
  }

  return (sender as {
    readonly send: <TResult>(
      request: AccessorRequestDescriptor,
      options: unknown
    ) => Promise<TResult>;
  }).send<TResponse>(request, options);
};

/////////////////////////////////////////////////////////////////////////////////

/**
 * Default JSON serializer.
 * @remarks It is a facade that `JSON` object.
 */
export const modestaDefaultJsonSerializer: AccessorSenderSerializer = {
  payloadType: 'string',
  serialize: (value: unknown) => !!value ? JSON.stringify(value) : undefined,
  deserialize: (payloadData: unknown) => JSON.parse(String(payloadData)),
};

/** Default serializers keyed by media type. */
export const modestaDefaultSerializers: ReadonlyMap<string, AccessorSenderSerializer> = new Map([
  ['application/json', modestaDefaultJsonSerializer],
]);

/**
 * Prepares transport-neutral request values for a sender implementation.
 * @param request Prepared request descriptor emitted by the generated accessor.
 * @param accessorOptions Additional accessor call options passed to the sender.
 * @param options Options that configure request preparation.
 * @returns Request values resolved against the active base URL.
 * @remarks The returned `body` is not serialized. Use `modestaSerializeRequestBody()` when a transport expects a serialized payload.
 */
export const modestaPrepareRequest = (
  request: AccessorRequestDescriptor,
  accessorOptions: AccessorOptions | undefined,
  options: ModestaPrepareRequestOptions | undefined
): ModestaPreparedRequest => ({
  url: new URL(request.url, modestaResolveBaseUrl(options?.baseUrl)),
  method: request.method,
  headers: modestaMergeRequestHeaders(options?.headers, request.headers),
  body: request.body,
  signal: accessorOptions?.signal,
});

/**
 * Serializes a request body using the accessor request content type.
 * @param request Prepared request descriptor emitted by the generated accessor.
 * @param serializers Serialization hooks keyed by media type.
 * @returns Serialized body value for fetch-style transports, or undefined when the request has no body.
 * @remarks A body is serialized when a serializer matches the request content type. Other body values are returned as-is.
 */
export const modestaSerializeRequestBody = (
  request: AccessorRequestDescriptor,
  serializers: ReadonlyMap<string, AccessorSenderSerializer>
) =>
  modestaSerializeFetchBody(
    request.body,
    request.headers['content-type'],
    serializers
  );

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
 * @param contentType Expected response content type used when the response omits the content-type header.
 * @param serializers Serialization hooks keyed by media type.
 * @returns Parsed response body value, or undefined for empty responses.
 * @remarks A body is deserialized when a serializer matches the response content type. Other bodies are read with `response.text()`.
 */
export const modestaReadFetchResponseBody = (
  response: Response,
  contentType: string | undefined,
  serializers: ReadonlyMap<string, AccessorSenderSerializer>
) => {
  if (
    response.status === 204 ||
    response.status === 205 ||
    response.status === 304 ||
    response.headers.get('content-length') === '0'
  ) {
    return Promise.resolve(undefined);
  }

  const responseContentType = response.headers.get('content-type') ?? contentType;
  const serializer = modestaFindSerializer(serializers, responseContentType);
  if (serializer != null) {
    // HACK: Fast path for default JSON serializer:
    if (serializer === modestaDefaultJsonSerializer) {
      return response.json();
    }
    const payloadData =
      serializer.payloadType === 'ArrayBuffer'
        ? response.arrayBuffer()
        : response.text();
    return payloadData.then((data) => serializer.deserialize(data));
  }

  return response.text();
};

/////////////////////////////////////////////////////////////////////////////////

/**
 * Result holder passed to custom JSON conversion hooks.
 */
export interface CustomJsonSerializerResult {
  /** Converted value returned from a hook when the hook reports that it handled the input. */
  result: unknown;
}

/**
 * Options that configure custom JSON value conversions.
 */
export interface CustomJsonSerializerOptions {
  /**
   * Tries to convert a body value before JSON serialization.
   * @param value Candidate value.
   * @param ref Result holder that receives the converted value.
   * @returns true when the hook handled the value; otherwise false.
   */
  readonly trySerialize: (value: unknown, ref: CustomJsonSerializerResult) => boolean;
  /**
   * Tries to convert a parsed JSON value after JSON deserialization.
   * @param value Candidate parsed JSON value.
   * @param ref Result holder that receives the converted value.
   * @returns true when the hook handled the value; otherwise false.
   */
  readonly tryDeserialize: (value: unknown, ref: CustomJsonSerializerResult) => boolean;
}

const modestaApplyCustomJsonSerialization = (
  value: unknown,
  options: CustomJsonSerializerOptions,
  scratchBuffer: CustomJsonSerializerResult,
  parents: WeakSet<object>
): unknown => {
  scratchBuffer.result = undefined;
  if (options.trySerialize(value, scratchBuffer)) {
    return scratchBuffer.result;
  }

  if (value == null || typeof value !== 'object') {
    return value;
  }
  if (typeof (value as { readonly toJSON?: unknown }).toJSON === 'function') {
    return value;
  }
  if (parents.has(value)) {
    throw new TypeError('Converting circular structure to JSON');
  }

  parents.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) =>
        modestaApplyCustomJsonSerialization(
          item,
          options,
          scratchBuffer,
          parents
        )
      );
    }

    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      result[key] = modestaApplyCustomJsonSerialization(
        source[key],
        options,
        scratchBuffer,
        parents
      );
    }
    return result;
  } finally {
    parents.delete(value);
  }
};

/**
 * Creates a JSON serializer with custom value conversion hooks.
 * @param options Options that configure custom JSON value conversions.
 * @returns JSON serializer that can be registered for JSON-compatible media types.
 * @remarks A hook handles a value by writing `ref.result` and returning true. Returning false keeps the original value.
 */
export const createCustomJsonSerializer = (options: CustomJsonSerializerOptions): AccessorSenderSerializer => {
  const scratchBuffer: CustomJsonSerializerResult = {
    result: undefined,
  };
  const deserializeValue = (_key: string, value: unknown): unknown => {
    scratchBuffer.result = undefined;
    return options.tryDeserialize(value, scratchBuffer)
      ? scratchBuffer.result
      : value;
  };

  return {
    payloadType: 'string',
    serialize: (value: unknown) =>
      JSON.stringify(
        modestaApplyCustomJsonSerialization(
          value,
          options,
          scratchBuffer,
          new WeakSet()
        )
      ),
    deserialize: (payloadData: unknown) =>
      JSON.parse(String(payloadData), deserializeValue),
  };
};

/////////////////////////////////////////////////////////////////////////////////

/**
 * Creates a sender implementation backed by the fetch API.
 * @param options Options that configure the fetch-based sender.
 * @returns Sender implementation that executes requests via the fetch API.
 * @remarks When `options.fetch` is omitted, `globalThis.fetch` must be available.
 * When `options.baseUrl` is omitted, `globalThis.location.origin` must be available.
 * Per-call context values are not accepted by this sender implementation.
 */
export const createFetchSender = (options?: CreateFetchSenderOptions | undefined): AccessorSenderInterface => {
  const fetchImplementation = options?.fetch ?? globalThis.fetch;
  if (typeof fetchImplementation !== 'function') {
    throw new Error(
      'Fetch implementation is not available. Pass CreateFetchSenderOptions.fetch explicitly.'
    );
  }

  const serializers = modestaCreateSerializers(options?.serializers);

  return {
    serializers,
    send: async (request, accessorOptions) => {
      const preparedRequest = modestaPrepareRequest(
        request,
        accessorOptions,
        options
      );
      const body = modestaSerializeRequestBody(request, serializers);
      const requestInit: RequestInit =
        options?.init
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

      const response = await fetchImplementation(
        preparedRequest.url,
        requestInit
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

      const responseBody = await modestaReadFetchResponseBody(
        response,
        request.responseContentType,
        serializers
      );

      return modestaProjectResponse(request, {
        body: responseBody,
        getHeader: (name) => response.headers.get(name),
      });
    },
  };
};

/////////////////////////////////////////////////////////////////////////////////
