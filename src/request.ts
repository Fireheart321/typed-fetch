import type { ApiError, RequestOptions, Result } from "./types.js";

export function buildUrl(url: string, query?: object): string {
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const values: unknown[] = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (v === undefined || v === null) continue;
      params.append(key, String(v));
    }
  }
  const qs = params.toString();
  if (!qs) return url;
  return url + (url.includes("?") ? "&" : "?") + qs;
}

const fail = (error: ApiError): Result<never> => ({ ok: false, error });

/**
 * Typed request. Always resolves; never throws.
 *
 *   const r = await request<User[], { page: number }>("/users", { query: { page: 1 } });
 *   if (r.ok) r.data;      // User[]
 *   else r.error.kind;     // "network" | "timeout" | "http" | ...
 */
export async function request<T, Q extends object = Record<string, never>, B = unknown>(
  url: string,
  options: RequestOptions<T, Q, B> = {},
): Promise<Result<T>> {
  const { method = "GET", query, body, headers = {}, timeoutMs, signal, validate } = options;
  const doFetch = options.fetch ?? globalThis.fetch;

  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onCallerAbort = () => controller.abort();

  if (signal) {
    if (signal.aborted) return fail({ kind: "aborted", message: "Request aborted before start" });
    signal.addEventListener("abort", onCallerAbort, { once: true });
  }
  if (timeoutMs !== undefined) {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  };

  const finalHeaders: Record<string, string> = { Accept: "application/json", ...headers };
  let payload: string | undefined;
  if (body !== undefined) {
    try {
      payload = JSON.stringify(body);
    } catch {
      cleanup();
      return fail({ kind: "validation", message: "Request body is not JSON-serializable", status: 0, data: body });
    }
    if (!Object.keys(finalHeaders).some((h) => h.toLowerCase() === "content-type")) {
      finalHeaders["Content-Type"] = "application/json";
    }
  }

  let res: Response;
  let text: string;
  try {
    res = await doFetch(buildUrl(url, query), {
      method,
      headers: finalHeaders,
      body: payload,
      signal: controller.signal,
    });
    text = await res.text();
  } catch (cause) {
    cleanup();
    if (timedOut) return fail({ kind: "timeout", message: `Timed out after ${timeoutMs}ms`, timeoutMs: timeoutMs! });
    if (controller.signal.aborted) return fail({ kind: "aborted", message: "Request aborted" });
    return fail({ kind: "network", message: cause instanceof Error ? cause.message : String(cause), cause });
  }
  cleanup();

  let json: unknown = undefined;
  let parseFailed = false;
  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      parseFailed = true;
    }
  }

  if (!res.ok) {
    return fail({
      kind: "http",
      status: res.status,
      statusText: res.statusText,
      body: parseFailed ? text : json,
      headers: res.headers,
    });
  }

  if (parseFailed) {
    return fail({ kind: "parse", message: "Response body is not valid JSON", status: res.status, rawBody: text });
  }

  if (validate) {
    try {
      return { ok: true, data: validate(json), status: res.status, headers: res.headers };
    } catch (e) {
      return fail({
        kind: "validation",
        message: e instanceof Error ? e.message : "Validation failed",
        status: res.status,
        data: json,
      });
    }
  }

  return { ok: true, data: json as T, status: res.status, headers: res.headers };
}

type Opts<T, Q extends object, B = unknown> = Omit<RequestOptions<T, Q, B>, "method" | "body">;

export const get = <T, Q extends object = Record<string, never>>(url: string, options: Opts<T, Q> = {}) =>
  request<T, Q>(url, { ...options, method: "GET" });

export const post = <T, B = unknown, Q extends object = Record<string, never>>(
  url: string,
  body: B,
  options: Opts<T, Q, B> = {},
) => request<T, Q, B>(url, { ...options, method: "POST", body });

export const put = <T, B = unknown, Q extends object = Record<string, never>>(
  url: string,
  body: B,
  options: Opts<T, Q, B> = {},
) => request<T, Q, B>(url, { ...options, method: "PUT", body });

export const del = <T, Q extends object = Record<string, never>>(url: string, options: Opts<T, Q> = {}) =>
  request<T, Q>(url, { ...options, method: "DELETE" });
