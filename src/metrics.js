// src/metrics.js
const client = require('prom-client');
const os = require('os');

// Register & default metrics (node process metrics)
const register = client.register;
client.collectDefaultMetrics({ register });

// --- Metrics (minimal set) ---
const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'endpoint'],
});

const totalRequests = new client.Counter({
  name: 'total_requests_total',
  help: 'Total requests (all methods)',
});

const activeUsers = new client.Gauge({
  name: 'active_users',
  help: 'Number of active users',
});

const authAttempts = new client.Counter({
  name: 'auth_attempts_total',
  help: 'Authentication attempts',
  labelNames: ['result'], // result = success|failed
});

const pizzasSold = new client.Counter({
  name: 'pizzas_sold_total',
  help: 'Total pizzas sold',
});

const revenueTotal = new client.Counter({
  name: 'pizzas_revenue_total',
  help: 'Total revenue (currency units)',
});

const pizzaCreationFailures = new client.Counter({
  name: 'pizza_creation_failures_total',
  help: 'Total pizza creation failures',
});

const pizzaCreationLatency = new client.Histogram({
  name: 'pizza_creation_latency_seconds',
  help: 'Latency for pizza creation (seconds)',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

// Optional system gauges (sampled)
const cpuUsage = new client.Gauge({ name: 'cpu_usage_percent', help: 'Approx CPU %' });
const memoryUsage = new client.Gauge({ name: 'memory_usage_percent', help: 'Memory %' });

// --- Middleware & helpers ---

// Middleware: count requests and attach start time
function requestTracker(req, res, next) {
  const method = (req.method || 'UNKNOWN').toUpperCase();
  // Use route path if present (better grouping), fallback to req.path
  const endpoint = (req.route && req.route.path) || req.path || req.url || 'unknown';
  httpRequests.inc({ method, endpoint }, 1);
  totalRequests.inc(1);
  req._metric_start = Date.now();
  next();
}

// authAttempt(successBool)
function authAttempt(success) {
  const label = success ? 'success' : 'failed';
  authAttempts.inc({ result: label }, 1);
}

// active users
function activeUserAdd() { activeUsers.inc(1); }
function activeUserRemove() { activeUsers.dec(1); }

// pizzas sold (pass revenue number)
function pizzaSold(revenue = 0) {
  pizzasSold.inc(1);
  if (Number.isFinite(revenue)) revenueTotal.inc(Number(revenue));
}

// pizza creation failure
function pizzaCreationFailed() { pizzaCreationFailures.inc(1); }

// record pizza creation latency in ms
function recordPizzaCreationLatency(ms) {
  if (ms == null) return;
  pizzaCreationLatency.observe(Number(ms) / 1000); // histogram is in seconds
}

// sample CPU & memory immediately (call before scrape or periodically)
function sampleSystemMetrics() {
  const cpus = (os.cpus() || []).length || 1;
  const load = os.loadavg()[0];
  const cpuPercent = Number(((load / cpus) * 100).toFixed(2));
  cpuUsage.set(cpuPercent);

  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const memPercent = Number(((used / total) * 100).toFixed(2));
  memoryUsage.set(memPercent);
}

// Express handler for Prometheus scrape
async function metricsEndpoint(req, res) {
  try {
    sampleSystemMetrics(); // ensure cpu/mem are fresh
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
}

// optional sampler control
let samplerHandle = null;
function startSampler(intervalMs = 10000) {
  if (samplerHandle) return;
  samplerHandle = setInterval(sampleSystemMetrics, intervalMs);
}
function stopSampler() {
  if (!samplerHandle) return;
  clearInterval(samplerHandle);
  samplerHandle = null;
}

// exports
module.exports = {
  // middleware & endpoint
  requestTracker,
  metricsEndpoint,

  // helpers
  authAttempt,
  activeUserAdd,
  activeUserRemove,
  pizzaSold,
  pizzaCreationFailed,
  recordPizzaCreationLatency,

  // system
  sampleSystemMetrics,
  startSampler,
  stopSampler,

  // for debug/tests
  register,
};