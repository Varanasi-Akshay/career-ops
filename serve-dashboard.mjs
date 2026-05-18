#!/usr/bin/env node
/**
 * serve-dashboard.mjs - Generate and serve the static dashboard from the repo root.
 *
 * This keeps report/PDF links working because the server exposes the same
 * relative paths the generated HTML uses.
 */

import { createServer } from 'http';
import { existsSync, readFileSync, statSync } from 'fs';
import { extname, join, normalize, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { networkInterfaces } from 'os';
import { spawnSync } from 'child_process';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function regenerateDashboard() {
  const result = spawnSync(process.execPath, ['generate-dashboard.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const requested = decoded === '/' ? '/static-dashboard/index.html' : decoded;
  const fullPath = resolve(ROOT, '.' + normalize(requested));
  if (!fullPath.startsWith(ROOT)) return null;
  return fullPath;
}

function localUrls() {
  const urls = [`http://localhost:${PORT}`];
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        urls.push(`http://${address.address}:${PORT}`);
      }
    }
  }
  return urls;
}

regenerateDashboard();

const server = createServer((request, response) => {
  const fullPath = safePath(request.url || '/');
  if (!fullPath || !existsSync(fullPath) || !statSync(fullPath).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  const ext = extname(fullPath).toLowerCase();
  response.writeHead(200, {
    'content-type': mimeTypes[ext] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  response.end(readFileSync(fullPath));
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try PORT=4174 npm run dashboard:mobile`);
  } else if (error.code === 'EPERM') {
    console.error(`Could not listen on ${HOST}:${PORT}. Try HOST=127.0.0.1 npm run dashboard:mobile, or run from a normal terminal.`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log('Career-Ops dashboard is live:');
  for (const url of localUrls()) console.log(`  ${url}`);
  console.log(`Serving ${relative(process.cwd(), ROOT)}. Press Ctrl-C to stop.`);
});
