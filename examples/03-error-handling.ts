import { get } from "../src/index.js";

const r = await get<{ id: number }>("https://jsonplaceholder.typicode.com/todos/99999", {
  timeoutMs: 5000,
  validate: (d) => {
    if (typeof (d as { id?: unknown }).id !== "number") throw new Error("missing id");
    return d as { id: number };
  },
});

if (!r.ok) {
  // Exhaustive: TypeScript errors here if a new error kind is added and not handled.
  switch (r.error.kind) {
    case "http":       console.log("HTTP", r.error.status, r.error.body); break;
    case "network":    console.log("Network down:", r.error.message); break;
    case "timeout":    console.log("Too slow:", r.error.timeoutMs, "ms"); break;
    case "aborted":    console.log("Cancelled"); break;
    case "parse":      console.log("Bad JSON:", r.error.rawBody.slice(0, 80)); break;
    case "validation": console.log("Unexpected shape:", r.error.message); break;
    default: { const _exhaustive: never = r.error; console.log(_exhaustive); }
  }
}
