import express from 'express';

const app = express();
const PORT = process.env.PORT || 8080;
const VERSION = process.env.VERSION || 'v1';
const MESSAGE = process.env.MESSAGE || 'Hello from Docker/Kubernetes demo';

app.get('/', (req, res) => {
  res.json({ message: MESSAGE, version: VERSION, timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// CPU intensive endpoint for HPA demos
app.get('/cpu', (req, res) => {
  const ms = Math.max(0, Math.min(10000, parseInt(req.query.ms, 10) || 100));
  const start = Date.now();
  // Busy-wait to consume CPU for ms milliseconds
  while (Date.now() - start < ms) {
    // simple ops to avoid being optimized away
    Math.sqrt(Math.random());
  }
  res.json({ ok: true, burnedMs: ms, timestamp: new Date().toISOString() });
});

// Graceful shutdown logging
function shutdown(signal) {
  console.log(`[${new Date().toISOString()}] Received ${signal}. Shutting down...`);
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
