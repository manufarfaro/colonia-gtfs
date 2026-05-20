#!/usr/bin/env node
// Healthcheck del bridge para el compose healthcheck: block.
//
// Probea GET http://localhost:$BRIDGE_PORT/healthz y matchea el status.
// "ok" o "degraded" → exit 0 (healthy desde Docker).
// "down" / cualquier otro / sin conexión → exit 1.
//
// La imagen base `node:26-alpine` no trae curl/wget/nc/bash por default;
// node está ahí ya, así que usamos él mismo para el probe en lugar de
// hinchar la imagen con `apk add bash`.

const net = require('node:net');

const port = Number.parseInt(process.env.BRIDGE_PORT || '3001', 10);
const TIMEOUT_MS = 4000;

const socket = net.createConnection(port, 'localhost');
socket.setTimeout(TIMEOUT_MS);

let body = '';

socket.on('connect', () => {
  socket.write('GET /healthz HTTP/1.0\r\nHost: localhost\r\n\r\n');
});

socket.on('data', (chunk) => {
  body += chunk.toString('utf8');
});

socket.on('end', () => {
  // Match either ok or degraded — both are healthy from Docker's perspective.
  // "down" is the server saying "I'm responding but the feed is stale" —
  // that's still a live container, but we want Docker to see it as failing
  // so something upstream picks it up.
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
