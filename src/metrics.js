// src/metrics.js
const client = require('prom-client');

// register
const register = client.register;
// default scrape interval
client.collectDefaultMetrics({ register });

// --- Metrics definitions ---
// HTTP requests counter (use labels for method & endpoint)
const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'endpoint'],
});

// Total requests (simple counter)
const totalRequests = new client.Counter({
  name: 'total_requests_total',
  help: 'Total requests (all methods)',
});

// Active users gauge
const activeUsers = new client.Gauge({
  name: 'active_users',
  help: 'Number of active users',
});

// Authentication attempts (labels: result=success|failed)
const authAttempts = new client.Counter({
  name: 'auth_attempts_total',
  help: 'Authentication attempts',
  labelNames: ['result'],
});

// Pizzas sold and revenue
const pizzasSold = new client.Counter({
  name: 'pizzas_sold_total',
  help: 'Total pizzas sold',
});
const revenueTotal = new client.Counter({
  name: 'pizzas_revenue_total',
  help: 'Total revenue (currency units)',
});

// Pizza creation failures
const pizzaCreationFailures = new client.Counter({
  name: 'pizza_creation_failures_total',
  help: 'Total pizza creation failures',
});

// Pizza creation latency histogram (seconds)
const pizzaCreationLatency = new client.Histogram({
  name: 'pizza_creation_latency_seconds',
  help: 'Latency for pizza creation in seconds',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5], // adjust as needed
});

// System metrics: CPU & mem are collected by collectDefaultMetrics,
// but expose convenient gauges too (sampled on push if you want)
const cpuUsageGauge = new client.Gauge({
  name: 'cpu_usage_percent',
  help: 'CPU usage percent (approx)',
});
const memoryUsageGauge = new client.Gauge({
  name: 'memory_usage_percent',
  help: 'Memory usage percent',
});

// ----- Helpers / middleware -----
function nowSeconds() {
  return Date.now() / 1000;
}

// requestTracker middleware: increment counters and attach start time
function requestTracker(req, res, next) {
  const method = (req.method || 'UNKNOWN').toUpperCase();
  const endpoint = req.route && req.route.path ? req.route.path : req.path || req.url;
  httpRequests.inc({ method, endpoint }, 1);
  totalRequests.inc(1);
  // attach start time for latency measurements if needed
  req._metric_start = Date.now();
  next();
}

// record generic request latency (req + ms) -> optional
function recordRequestLatency(req, ms) {
  // you could route to a histogram; here we don't make a generic histogram so ignore
  // But keep function for compatibility with earlier code
  return;
}

// authAttempt(success)
function authAttempt(success) {
  const label = success ? 'success' : 'failed';
  authAttempts.inc({ result: label }, 1);
}

// activeUserAdd / Remove
function activeUserAdd(userId) {
  // userId unused, gauge stores only count
  activeUsers.inc(1);
}
function activeUserRemove(userId) {
  activeUsers.dec(1);
}

// pizzaSold(revenue)
function pizzaSold(revenue = 0) {
  pizzasSold.inc(1);
  if (Number.isFinite(revenue)) revenueTotal.inc(Number(revenue));
}

// pizzaCreationFailed()
function pizzaCreationFailed() {
  pizzaCreationFailures.inc(1);
}

// recordPizzaCreationLatency(ms)
function recordPizzaCreationLatency(ms) {
  // ms -> seconds for histogram
  const s = Number(ms) / 1000;
  pizzaCreationLatency.observe(s);
}

// CPU and memory sample (call periodically)
function sampleSystemMetrics() {
  // crude CPU load: use os.loadavg normalized to CPUs
  const os = require('os');
  const cpus = (os.cpus() || []).length || 1;
  const load = os.loadavg()[0];
  const cpuPercent = Number(((load / cpus) * 100).toFixed(2));
  cpuUsageGauge.set(cpuPercent);

  // memory
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const memPercent = Number(((used / total) * 100).toFixed(2));
  memoryUsageGauge.set(memPercent);
}

// Expose metrics endpoint data (register)
async function metricsEndpoint(req, res) {
  try {
    // sample system metrics right before scrape so Grafana/Prometheus sees up-to-date values
    sampleSystemMetrics();
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
}

// start a periodic sampler (optional)
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

// Export everything your server.js expects
module.exports = {
  // prometheus register for /metrics
  register,
  requestTracker,
  metricsEndpoint,
  recordRequestLatency,
  authAttempt,
  activeUserAdd,
  activeUserRemove,
  pizzaSold,
  pizzaCreationFailed,
  recordPizzaCreationLatency,
  startSampler,
  stopSampler,
};