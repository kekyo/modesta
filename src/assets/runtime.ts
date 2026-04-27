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
  /** Schema metadata for the request body payload. */
  readonly requestBodyMetadata?: AccessorSchemaMetadata | undefined;
  /** Expected response content type selected from the OpenAPI response definition. */
  readonly responseContentType: string | undefined;
  /** Schema metadata for the response body payload. */
  readonly responseBodyMetadata?: AccessorSchemaMetadata | undefined;
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
 * Schema metadata passed to serializers.
 */
export interface AccessorSchemaMetadata {
  /** OpenAPI schema format for the current value. */
  readonly format?: string | undefined;
  /** Object property metadata keyed by JSON property name. */
  readonly properties?: Readonly<Record<string, AccessorSchemaMetadata>> | undefined;
  /** Array item metadata. */
  readonly items?: AccessorSchemaMetadata | undefined;
  /** Dictionary value metadata for additional object properties. */
  readonly additionalProperties?: AccessorSchemaMetadata | undefined;
}

/**
 * Serialization hooks used by sender implementations.
 */
export interface AccessorSenderSerializer {
  /**
   * Serialized payload data shape used by this serializer.
   */
  readonly payloadType: PayloadType;
  /**
   * Serializes a request body value into transport data.
   * @param value Target value
   * @param metadata Schema metadata for the target value
   * @returns Serialized payload data
   */
  readonly serialize: (value: unknown, metadata?: AccessorSchemaMetadata | undefined) => unknown;
  /**
   * Deserializes transport data into a response body value.
   * @param payloadData Serialized payload data
   * @param metadata Schema metadata for the target value
   * @returns Retrieved value
   */
  readonly deserialize: (payloadData: unknown, metadata?: AccessorSchemaMetadata | undefined) => unknown;
}

/**
 * Sender object used by generated accessors that do not require per-call context values.
 */
export interface AccessorSenderInterface {
  /**
   * Executes a prepared request.
   * @typeParam TResponse Response payload type.
   * @param request Prepared request descriptor.
   * @param requestValue Request value, before serialization.
   * @param accessorOptions Additional accessor call options without per-call context.
   * @returns Promise that resolves to the typed response value after serialization.
   */
  readonly send: <TResponse>(
    request: AccessorRequestDescriptor,
    requestValue: unknown,
    accessorOptions: AccessorOptions | undefined) => Promise<TResponse | undefined>;
}

/**
 * Sender object used by generated accessors that require per-call context values.
 * @typeParam TAccessorContext Per-call context value type passed to the sender.
 */
export interface AccessorSenderInterfaceWithContext<TAccessorContext> {
  /**
   * Executes a prepared request.
   * @typeParam TResponse Response payload type.
   * @param request Prepared request descriptor.
   * @param requestValue Request value, before serialization.
   * @param accessorOptions Additional accessor call options with per-call context.
   * @returns Promise that resolves to the typed response value after serialization.
   */
  readonly send: <TResponse>(
    request: AccessorRequestDescriptor,
    requestValue: unknown,
    accessorOptions: AccessorOptionsWithContext<TAccessorContext>) => Promise<TResponse | undefined>;
}

/**
 * Source used to resolve generated accessor request URLs when `baseUrl` is omitted.
 */
export type ModestaBaseUrlSource = 'auto' | 'origin' | 'swagger';

/** Options that configure the fetch-based sender. */
export interface CreateFetchSenderOptions {
  /** Explicit base URL used to resolve generated accessor request URLs. */
  readonly baseUrl?: string | URL | undefined;
  /** Base URL source used when `baseUrl` is omitted. Defaults to `auto`. */
  readonly baseUrlSource?: ModestaBaseUrlSource | undefined;
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
  /** Explicit base URL used to resolve generated accessor request URLs. */
  readonly baseUrl?: string | URL | undefined;
  /** Base URL source used when `baseUrl` is omitted. Defaults to `auto`. */
  readonly baseUrlSource?: ModestaBaseUrlSource | undefined;
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
  /** Abort signal forwarded from the accessor call options. */
  readonly signal: AbortSignal | undefined;
}

/**
 * Transport response values supplied to response projection helpers.
 */
export interface ModestaResponseSource {
  /** Function that reads a response header value by its wire name. */
  readonly getHeader: (name: string) => string | null | undefined;
}

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

/////////////////////////////////////////////////////////////////////////////////

const modestaEmptyResponseHeaders: readonly AccessorResponseHeaderDescriptor[] = [];

const modestaGeneratedSwaggerBaseUrl: string | undefined = undefined;

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

const modestaResolveBaseUrl = (
  baseUrl: string | URL | undefined,
  baseUrlSource: ModestaBaseUrlSource | undefined
) => {
  if (baseUrl != null && baseUrlSource != null) {
    throw new Error(
      'baseUrl and baseUrlSource cannot be specified together.'
    );
  }

  if (baseUrl != null) {
    return baseUrl;
  }

  switch (baseUrlSource ?? 'auto') {
    case 'origin':
      return modestaGetDefaultBaseUrl();
    case 'swagger':
      if (modestaGeneratedSwaggerBaseUrl == null) {
        throw new Error(
          'Swagger base URL is not available. Choose baseUrlSource: "origin" or pass baseUrl explicitly.'
        );
      }
      return modestaGeneratedSwaggerBaseUrl;
    case 'auto':
    default:
      return modestaGeneratedSwaggerBaseUrl ?? modestaGetDefaultBaseUrl();
  }
};

const modestaResolveRequestUrl = (
  requestUrl: string,
  baseUrl: string | URL | undefined,
  baseUrlSource: ModestaBaseUrlSource | undefined
) => {
  const resolvedBaseUrl = String(modestaResolveBaseUrl(baseUrl, baseUrlSource));
  const directoryBaseUrl = resolvedBaseUrl.endsWith('/')
    ? resolvedBaseUrl
    : `${resolvedBaseUrl}/`;
  const relativeRequestUrl = requestUrl.replace(/^\/+/u, '');
  try {
    return new URL(relativeRequestUrl, directoryBaseUrl);
  } catch {
    return new URL(
      relativeRequestUrl,
      new URL(directoryBaseUrl, modestaGetDefaultBaseUrl())
    );
  }
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

/////////////////////////////////////////////////////////////////////////////////

/**
 * Prepares transport-neutral request values for a sender implementation.
 * @param request Prepared request descriptor emitted by the generated accessor.
 * @param accessorOptions Additional accessor call options passed to the sender.
 * @param options Options that configure request preparation.
 * @returns Request values resolved against the active base URL.
 * @remarks The returned request does not include request body data. Sender implementations receive the request value separately.
 */
export const modestaPrepareRequest = (
  request: AccessorRequestDescriptor,
  accessorOptions: AccessorOptions | undefined,
  options: ModestaPrepareRequestOptions | undefined
): ModestaPreparedRequest => ({
  url: modestaResolveRequestUrl(
    request.url,
    options?.baseUrl,
    options?.baseUrlSource
  ),
  method: request.method,
  headers: modestaMergeRequestHeaders(options?.headers, request.headers),
  signal: accessorOptions?.signal,
});

/**
 * Serializes a request value using the accessor request content type.
 * @param request Prepared request descriptor emitted by the generated accessor.
 * @param requestValue Request value before serialization.
 * @param serializers Serialization hooks keyed by media type.
 * @returns Serialized body value for fetch-style transports, or undefined when the request has no body.
 * @remarks A body is serialized when a serializer matches the request content type. Other body values are returned as-is.
 */
export const modestaSerializeRequestValue = (
  request: AccessorRequestDescriptor,
  requestValue: unknown,
  serializers: ReadonlyMap<string, AccessorSenderSerializer>
) => {
  const contentType = request.headers['content-type'];
  const serializer = modestaFindSerializer(serializers, contentType);
  if (serializer == null) {
    return requestValue;
  }
  return request.requestBodyMetadata != null
    ? serializer.serialize(requestValue, request.requestBodyMetadata)
    : serializer.serialize(requestValue);
};

/**
 * Projects a transport response into the generated accessor response value shape.
 * @typeParam TResponse Response value type.
 * @param request Prepared request descriptor emitted by the generated accessor.
 * @param response Transport response values used to project response headers.
 * @param responseValue Response value after deserialization.
 * @returns Response value that matches the generated accessor contract.
 * @remarks Response headers defined by the accessor are parsed and merged into the returned body shape.
 */
export const modestaProjectResponse = <TResponse>(
  request: AccessorRequestDescriptor,
  response: ModestaResponseSource,
  responseValue: unknown
) => {
  const projectedHeaders = modestaReadResponseHeaders(
    response.getHeader,
    request.responseHeaders);

  if (projectedHeaders == null) {
    return responseValue == null ?
      undefined :
      (responseValue as TResponse);
  }

  if (responseValue == null) {
    return projectedHeaders as TResponse;
  }

  if (request.wrapResponseBody) {
    return modestaAssignProperties(
      {
        body: responseValue,
      },
      projectedHeaders
    ) as TResponse;
  }

  if (typeof responseValue === 'object' && Array.isArray(responseValue) === false) {
    return modestaAssignProperties(
      responseValue as Record<string, unknown>,
      projectedHeaders
    ) as TResponse;
  }

  return modestaAssignProperties(
    { ...(responseValue as Record<string, unknown>) },
    projectedHeaders
  ) as TResponse;
}

/**
 * Reads a response value.
 * @param response Response source.
 * @param responsePayload Response payload data before deserialization.
 * @param contentType Expected response content type used when the response omits the content-type header.
 * @param serializers Serialization hooks keyed by media type.
 * @param metadata Schema metadata for the response body payload.
 * @returns Deserialized response value, or the payload coerced to string when no serializer matches.
 * @remarks A body is deserialized when a serializer matches the response content type. The payload is passed to the serializer as-is, including `undefined`.
 */
export const modestaDeserializeResponsePayload = (
  response: ModestaResponseSource,
  responsePayload: unknown,
  contentType: string | undefined,
  serializers: ReadonlyMap<string, AccessorSenderSerializer>,
  metadata: AccessorSchemaMetadata | undefined
) => {
  const responseContentType = response.getHeader('content-type') ?? contentType;
  const serializer = modestaFindSerializer(serializers, responseContentType);
  if (serializer != null) {
    return metadata != null
        ? serializer.deserialize(responsePayload, metadata)
        : serializer.deserialize(responsePayload);
  }
  return String(responsePayload);
};

/**
 * Fetch API specialized: Reads a response value from a fetch-compatible response object.
 * @param response Fetch-compatible response object.
 * @param contentType Expected response content type used when the response omits the content-type header.
 * @param serializers Serialization hooks keyed by media type.
 * @param metadata Schema metadata for the response body payload.
 * @returns Parsed response body deserialized value, or undefined for empty responses.
 * @remarks A body is deserialized when a serializer matches the response content type.
 */
export const modestaReadFetchResponseValue = (
  response: Response,
  contentType: string | undefined,
  serializers: ReadonlyMap<string, AccessorSenderSerializer>,
  metadata?: AccessorSchemaMetadata | undefined
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
    return payloadData.then((data) =>
      metadata != null
        ? serializer.deserialize(data, metadata)
        : serializer.deserialize(data)
    );
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
   * @param format OpenAPI schema format for the candidate value.
   * @param ref Result holder that receives the converted value.
   * @returns true when the hook handled the value; otherwise false.
   */
  readonly trySerialize: (
    value: unknown,
    format: string | undefined,
    ref: CustomJsonSerializerResult
  ) => boolean;
  /**
   * Tries to convert a parsed JSON value after JSON deserialization.
   * @param value Candidate parsed JSON value.
   * @param format OpenAPI schema format for the candidate value.
   * @param ref Result holder that receives the converted value.
   * @returns true when the hook handled the value; otherwise false.
   */
  readonly tryDeserialize: (
    value: unknown,
    format: string | undefined,
    ref: CustomJsonSerializerResult
  ) => boolean;
}

const modestaGetCustomJsonPropertyMetadata = (
  metadata: AccessorSchemaMetadata | undefined,
  key: string
) => {
  const propertyMetadata = metadata?.properties?.[key];
  return propertyMetadata ?? metadata?.additionalProperties;
};

const modestaApplyCustomJsonSerialization = (
  value: unknown,
  options: CustomJsonSerializerOptions,
  scratchBuffer: CustomJsonSerializerResult,
  metadata: AccessorSchemaMetadata | undefined,
  parents: WeakSet<object>
): unknown => {
  scratchBuffer.result = undefined;
  if (
    options.trySerialize(
      value,
      metadata?.format,
      scratchBuffer
    )
  ) {
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
          metadata?.items,
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
        modestaGetCustomJsonPropertyMetadata(metadata, key),
        parents
      );
    }
    return result;
  } finally {
    parents.delete(value);
  }
};

const modestaApplyCustomJsonDeserialization = (
  value: unknown,
  options: CustomJsonSerializerOptions,
  scratchBuffer: CustomJsonSerializerResult,
  metadata: AccessorSchemaMetadata | undefined
): unknown => {
  let convertedValue = value;
  if (value != null && typeof value === 'object') {
    if (Array.isArray(value)) {
      convertedValue = value.map((item) =>
        modestaApplyCustomJsonDeserialization(
          item,
          options,
          scratchBuffer,
          metadata?.items
        )
      );
    } else {
      const source = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(source)) {
        result[key] = modestaApplyCustomJsonDeserialization(
          source[key],
          options,
          scratchBuffer,
          modestaGetCustomJsonPropertyMetadata(metadata, key)
        );
      }
      convertedValue = result;
    }
  }

  scratchBuffer.result = undefined;
  return options.tryDeserialize(
    convertedValue,
    metadata?.format,
    scratchBuffer
  )
    ? scratchBuffer.result
    : convertedValue;
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

  return {
    payloadType: 'string',
    serialize: (
      value: unknown,
      metadata?: AccessorSchemaMetadata | undefined
    ) =>
      JSON.stringify(
        modestaApplyCustomJsonSerialization(
          value,
          options,
          scratchBuffer,
          metadata,
          new WeakSet()
        )
      ),
    deserialize: (
      payloadData: unknown,
      metadata?: AccessorSchemaMetadata | undefined
    ) =>
      modestaApplyCustomJsonDeserialization(
        JSON.parse(String(payloadData)),
        options,
        scratchBuffer,
        metadata
      ),
  };
};

/////////////////////////////////////////////////////////////////////////////////

/**
 * Creates a sender implementation backed by the fetch API.
 * @param options Options that configure the fetch-based sender.
 * @returns Sender implementation that executes requests via the fetch API.
 * @remarks When `options.fetch` is omitted, `globalThis.fetch` must be available.
 * When `options.baseUrl` is omitted, `options.baseUrlSource` selects the generated Swagger server URL, `globalThis.location.origin`, or both with Swagger first.
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
    send: async (request, requestValue, accessorOptions) => {
      const requestPayload = modestaSerializeRequestValue(
        request,
        requestValue,
        serializers);
      const preparedRequest = modestaPrepareRequest(
        request,
        accessorOptions,
        options
      );

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
      if (requestPayload !== undefined) {
        requestInit.body = requestPayload as RequestInit['body'];
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

      const responseValue = await modestaReadFetchResponseValue(
        response,
        request.responseContentType,
        serializers,
        request.responseBodyMetadata
      );

      return modestaProjectResponse(request, {
        getHeader: (name) => response.headers.get(name),
      },
      responseValue);
    },
  };
};

/////////////////////////////////////////////////////////////////////////////////
