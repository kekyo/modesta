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
}

/** Additional options accepted by generated accessor methods. */
export interface AccessorOptions {
  /** Abort signal used to cancel the request. */
  readonly signal?: AbortSignal | undefined;
}

/**
 * Sender function used by generated accessors.
 * @typeParam TResponse Response payload type.
 * @typeParam TRequestBody Request body payload type.
 * @typeParam TAccessorInterfaceContext Accessor interface context value type passed to the sender.
 * @param request Prepared request descriptor.
 * @param context Context value bound when creating the accessor implementation.
 * @param options Additional accessor call options.
 * @returns Promise that resolves to the typed response payload.
 */
export type AccessorSender<TAccessorInterfaceContext> = <TResponse, TRequestBody>(
  request: AccessorRequestDescriptor<TRequestBody>,
  context: TAccessorInterfaceContext | undefined,
  options: AccessorOptions | undefined) => Promise<TResponse>;

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

const modestaUrlBase = 'http://modesta.invalid';
const modestaJsonMediaTypePattern = /json/i;

const modestaBuildUrl = (
  path: string,
  pathParameters: Record<string, unknown>,
  queryParameters: Record<string, unknown>
) => {
  let resolvedPath = path;
  for (const [key, value] of Object.entries(pathParameters)) {
    resolvedPath = resolvedPath.replaceAll(`{${key}}`, encodeURIComponent(String(value)));
  }
  const url = new URL(resolvedPath, modestaUrlBase);
  for (const [key, value] of Object.entries(queryParameters)) {
    if (value != null) {
      url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
};

const modestaBuildHeaders = (
  headerParameters: Record<string, unknown>,
  contentType: string | undefined,
  accept: string | undefined
) => {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(headerParameters)) {
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

/////////////////////////////////////////////////////////////////////////////////

/**
 * Creates a sender implementation backed by the fetch API.
 * @param options Options that configure the fetch-based sender.
 * @returns Sender implementation that executes requests via the fetch API.
 * @remarks When `options.fetch` is omitted, `globalThis.fetch` must be available.
 * Accessor context values are ignored by this sender implementation.
 */
export const createFetchSender = (options: CreateFetchSenderOptions): AccessorSender<undefined> => {
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  if (typeof fetchImplementation !== 'function') {
    throw new Error(
      'Fetch implementation is not available. Pass CreateFetchSenderOptions.fetch explicitly.'
    );
  }

  return async <TResponse, TRequestBody>(
    request: AccessorRequestDescriptor<TRequestBody>,
    _context: undefined,
    accessorOptions: AccessorOptions | undefined
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

    const responseText = await response.text();
    if (responseText.length === 0) {
      return undefined as TResponse;
    }

    const responseContentType = response.headers.get('content-type');
    return (
      responseContentType != null &&
      modestaJsonMediaTypePattern.test(responseContentType)
      ? JSON.parse(responseText)
        : responseText
    ) as TResponse;
  };
};

/////////////////////////////////////////////////////////////////////////////////
