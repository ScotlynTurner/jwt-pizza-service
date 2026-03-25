const config = require('./config');
const os = require('os');

// http requests
const requests = {};

function requestTracker(req, res, next) {
  const endpoint = `[${req.method}] ${req.path}`;
  requests[endpoint] = (requests[endpoint] || 0) + 1;
  next();
}

// latency tracking
let requestLatency = [];
let pizzaLatency = [];

function recordRequestLatency(ms, endpoint = '/') {
  requestLatency.push({ value: ms, endpoint });
}

function recordPizzaCreationLatency(ms, endpoint = '/') {
  pizzaLatency.push({ value: ms, endpoint });
}

// auth attempts
let authSuccessCount = 0;
let authFailCount = 0;

// function authSuccessAdd() { authSuccessCount++; }
// function authFailAdd() { authFailCount++; }

// active users
let activeUsersCount = 0;

function activeUserAdd() { activeUsersCount++; }
function activeUserRemove() { activeUsersCount--; }

// pizza creation
let pizzasSoldCount = 0;
let pizzaFailureCount = 0;
let revenueTotalAmount = 0;

function pizzaCreationFailed(reason = 'unknown') {
  pizzaFailureCount[reason] = (pizzaFailureCount[reason] || 0) + 1;
}

// function pizzaPurchase(success, latency, price = 0) {
//   recordRequestLatency(latency, '/orderRouter.');
//   if (success) {
//     revenueTotalAmount += Number(price) || 0;
//     pizzasSoldCount++;
//   } else {
//     pizzaFailureCount++;
//   }
// }

// cpu and memory usage
function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

// This will periodically send metrics to Grafana
setInterval(() => {
  const metrics = [];
  Object.entries(requests).forEach(([key, count]) => {
    const [method, path] = key.split('|');

    metrics.push(createMetric('http_requests_total', count, '1', 'sum', 'asInt', { method, path }));
  });

  metrics.push(createMetric('active_users', activeUsersCount, '1', 'gauge', 'asInt', {}));
  metrics.push(createMetric('auth_attempts', authSuccessCount, '1', 'sum', 'asInt', { result: 'success' }));
  metrics.push(createMetric('auth_attempts', authFailCount, '1', 'sum', 'asInt', { result: 'failed' }));
  metrics.push(createMetric('pizzas_sold_total', pizzasSoldCount, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('revenue_total', revenueTotalAmount, 'usd', 'sum', 'asDouble', {}));

  // failures by reason
  Object.entries(pizzaFailureCounts).forEach(([reason, count]) => {
    metrics.push(createMetric('pizza_creation_failures', count, '1', 'sum', 'asInt', { reason }));
  });

  pizzaLatency.forEach((entry) => {
    metrics.push(createMetric('pizza_creation_latency', entry.value / 1000, 's', 'gauge', 'asDouble', { endpoint: entry.endpoint }));
  });

  sendMetricToGrafana(metrics);
}, 10000);

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
  attributes = { ...attributes, source: config.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function sendMetricToGrafana(metrics) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(`${config.endpointUrl}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${config.accountId}:${config.apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

module.exports = {
  getCpuUsagePercentage,
  getMemoryUsagePercentage,
  requestTracker,
  activeUserAdd,
  activeUserRemove,
  pizzaCreationFailed,
  recordPizzaCreationLatency
};