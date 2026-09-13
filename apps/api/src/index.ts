import { createServer } from "node:http";
import { fetch, Headers, Request, Response } from "undici";
import { createApp } from "./app.ts";
import { defaultSqlitePath, openDatabase } from "./db.ts";

if (!globalThis.fetch) {
  Object.assign(globalThis, { fetch, Headers, Request, Response });
}

const sqlitePath = defaultSqlitePath();
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

const db = openDatabase(sqlitePath);
const app = createApp({ db });

const server = createServer(async (req, res) => {
  const host = req.headers.host ?? `127.0.0.1:${port}`;
  const url = `http://${host}${req.url ?? "/"}`;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const method = req.method ?? "GET";
  const request = new Request(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
  const response = await app.fetch(request);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
});

server.listen(port, host, () => {
  process.stdout.write(`ArrowFlow API http://${host}:${port}  sqlite=${sqlitePath}\n`);
});
