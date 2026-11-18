# typed-fetch

A tiny, dependency-free typed wrapper around `fetch`.

- `request<T>()` with generics for response, query params, and body
- Supports `GET` / `POST` / `PUT` / `DELETE`, JSON bodies, custom headers
- Returns a **discriminated union** `Result<T>`. **No thrown errors leak out.**
- Timeouts, `AbortSignal`, and optional runtime validation

## Install

```bash
npm install @sekina/typed-fetch
```

Requires Node 18+ (or any runtime with global `fetch`).

## API

```ts
type Result<T> =
  | { ok: true;  data: T; status: number; headers: Headers }
  | { ok: false; error: ApiError };

type ApiError =
  | { kind: "network";    message: string; cause: unknown }
  | { kind: "timeout";    message: string; timeoutMs: number }
  | { kind: "aborted";    message: string }
  | { kind: "http";       status: number; statusText: string; body: unknown; headers: Headers }
  | { kind: "parse";      message: string; status: number; rawBody: string }
  | { kind: "validation"; message: string; status: number; data: unknown };

request<T, Q, B>(url, { method, query, body, headers, timeoutMs, signal, validate, fetch })
get<T, Q>(url, opts)   post<T, B, Q>(url, body, opts)
put<T, B, Q>(url, body, opts)   del<T, Q>(url, opts)
```

Check `result.ok` first; TypeScript then narrows to `data` or `error`.

## Example 1: GET with typed query params (success path)

```ts
import { get } from "@sekina/typed-fetch";

interface Todo { id: number; title: string; completed: boolean }

const r = await get<Todo[], { userId: number; _limit: number }>(
  "https://jsonplaceholder.typicode.com/todos",
  { query: { userId: 1, _limit: 3 }, timeoutMs: 5000 },
);

if (r.ok) console.log(r.data.map((t) => t.title)); // r.data: Todo[]
else console.error(r.error.kind);
```

Passing `{ userId: "x" }` or an unknown key is a compile error.

## Example 2: POST with JSON body and custom headers (success path)

```ts
import { post } from "@sekina/typed-fetch";
interface NewPost { title: string; body: string; userId: number }
interface Created extends NewPost { id: number }

const r = await post<Created, NewPost>(
  "https://jsonplaceholder.typicode.com/posts",
  { title: "hello", body: "world", userId: 1 },
  { headers: { Authorization: "Bearer my-token" } },
);

if (r.ok) console.log("created", r.data.id, r.status);
else console.error(r.error);
```

## Example 3: Every error path, handled exhaustively

```ts
import { get } from "@sekina/typed-fetch";

const r = await get<{ id: number }>("https://jsonplaceholder.typicode.com/todos/99999", {
  timeoutMs: 5000,
  validate: (d) => {
    if (typeof (d as { id?: unknown }).id !== "number") throw new Error("missing id");
    return d as { id: number };
  },
});

if (!r.ok) {
  switch (r.error.kind) {
    case "http":       console.log("HTTP", r.error.status, r.error.body); break;
    case "network":    console.log("Network down:", r.error.message); break;
    case "timeout":    console.log("Too slow:", r.error.timeoutMs, "ms"); break;
    case "aborted":    console.log("Cancelled"); break;
    case "parse":      console.log("Bad JSON:", r.error.rawBody.slice(0, 80)); break;
    case "validation": console.log("Unexpected shape:", r.error.message); break;
    default: { const _exhaustive: never = r.error; console.log(_exhaustive); } // compile error if a case is missed
  }
}
```

## Development

```bash
npm install
npm test     # builds, then runs tests against a local HTTP server
```

## License

MIT
