export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

/** Primitive values allowed in a query string. null/undefined are skipped. */
export type QueryValue = string | number | boolean | null | undefined;

/** Every way a request can fail. Switch on `kind` to narrow. */
export type ApiError =
  | { kind: "network"; message: string; cause: unknown }
  | { kind: "timeout"; message: string; timeoutMs: number }
  | { kind: "aborted"; message: string }
  | { kind: "http"; status: number; statusText: string; body: unknown; headers: Headers }
  | { kind: "parse"; message: string; status: number; rawBody: string }
  | { kind: "validation"; message: string; status: number; data: unknown };

export type Success<T> = { ok: true; data: T; status: number; headers: Headers };
export type Failure = { ok: false; error: ApiError };

/** Discriminated union on `ok`. `request` never throws; it always returns this. */
export type Result<T> = Success<T> | Failure;

export interface RequestOptions<T, Q extends object = Record<string, never>, B = unknown> {
  /** Defaults to "GET". */
  method?: HttpMethod;
  /** Typed query params, serialized onto the URL. Arrays become repeated keys. */
  query?: Q;
  /** JSON body (POST/PUT/DELETE). Serialized with JSON.stringify. */
  body?: B;
  /** Custom headers. Merged over the defaults. */
  headers?: Record<string, string>;
  /** Abort after this many ms. */
  timeoutMs?: number;
  /** Caller-provided AbortSignal. */
  signal?: AbortSignal;
  /**
   * Optional runtime validator. Throw to reject; return the narrowed value to accept.
   * If it throws, you get a `validation` error instead of an unchecked cast.
   */
  validate?: (data: unknown) => T;
  /** Inject a fetch implementation (handy for tests). Defaults to global fetch. */
  fetch?: typeof fetch;
}
