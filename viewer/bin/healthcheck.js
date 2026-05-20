#!/usr/bin/env node
// Viewer healthcheck for the Docker compose healthcheck: block.
// Probes GET /api/healthz on $VIEWER_PORT and treats aggregate status
// "ok" or "degraded" as healthy. "down" or unreachable → exit 1.
//
// node:26-alpine ships no curl/wget/bash; we use Node itself.

const net = require('node:net');

const port = Number.parseInt(process.env.VIEWER_PORT || '8080', 10);
const TIMEOUT_MS = 4000;

const socket = net.createConnection(port, 'localhost');
socket.setTimeout(TIMEOUT_MS);

let body = '';

socket.on('connect', () => {
  socket.write('GET /api/healthz HTTP/1.0\r\nHost: localhost\r\n\r\n');
});

socket.on('data', (chunk) => {
  body += chunk.toString('utf8');
});

socket.on('end', () => {
  if (/"status"\s*:\s*"(ok|degraded)"/.test(body)) {
    process.exit(0);
  }
  process.exit(1);
});

socket.on('timeout', () => {
  socket.destroy();
  process.exit(1);
});

socket.on('error', () => {
  process.exit(1);
});
