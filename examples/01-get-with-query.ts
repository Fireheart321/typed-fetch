import { get } from "../src/index.js";

interface Todo { id: number; title: string; completed: boolean }

const r = await get<Todo[], { userId: number; _limit: number }>(
  "https://jsonplaceholder.typicode.com/todos",
  { query: { userId: 1, _limit: 3 }, timeoutMs: 5000 },
);

if (r.ok) {
  console.log(r.data.map((t) => t.title)); // Todo[]
} else {
  console.error(r.error.kind);
}
