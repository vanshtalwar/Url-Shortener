// Static server with SPA fallback and gzip for text (like Vercel): node serve.mjs <dir> <port>
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
const [dir, port] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.md': 'text/markdown', '.txt': 'text/plain' };
createServer(async (req, res) => {
  let f = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try { if (!(await stat(f)).isFile()) throw 0; } catch { f = join(dir, 'index.html'); }
  const body = await readFile(f);
  const type = types[extname(f)] ?? 'application/octet-stream';
  const gzip = /gzip/.test(req.headers['accept-encoding'] ?? '') && type !== 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, ...(gzip ? { 'content-encoding': 'gzip' } : {}), 'cache-control': /\.[0-9a-f]{16}\./.test(f) ? 'public, max-age=31536000, immutable' : 'no-cache' });
  res.end(gzip ? gzipSync(body) : body);
}).listen(Number(port));
