import { post } from "../src/index.js";

interface NewPost { title: string; body: string; userId: number }
interface Created extends NewPost { id: number }

const r = await post<Created, NewPost>(
  "https://jsonplaceholder.typicode.com/posts",
  { title: "hello", body: "world", userId: 1 },
  { headers: { Authorization: "Bearer my-token" } },
);

if (r.ok) console.log("created", r.data.id, "status", r.status);
else console.error(r.error);
