const express = require('express');
const { authRouter, setAuthUser } = require('./routes/authRouter.js');
const orderRouter = require('./routes/orderRouter.js');
const franchiseRouter = require('./routes/franchiseRouter.js');
const userRouter = require('./routes/userRouter.js');
const version = require('./version.json');
const config = require('./config.js');
const metrics = require('./metrics.js');

const app = express();
app.use(express.json());
app.use(setAuthUser);
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

const apiRouter = express.Router();
app.use('/api', apiRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/user', userRouter);
apiRouter.use('/order', orderRouter);
apiRouter.use('/franchise', franchiseRouter);

apiRouter.use('/docs', (req, res) => {
  res.json({
    version: version.version,
    endpoints: [...authRouter.docs, ...userRouter.docs, ...orderRouter.docs, ...franchiseRouter.docs],
    config: { factory: config.factory.url, db: config.db.connection.host },
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'welcome to JWT Pizza',
    version: version.version,
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    message: 'unknown endpoint',
  });
});

// Default error handler for all exceptions and errors.
app.use((err, req, res, next) => {
  res.status(err.statusCode ?? 500).json({ message: err.message, stack: err.stack });
  next();
});


// 1) global metrics middleware - counts all requests
app.use(metrics.requestTracker);

// 2) generic latency capture for each request
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const latencyMs = Date.now() - start;
    // record pizza-creation latency only in pizza route (we also measure it manually)
    // keep this function available if needed
    if (typeof metrics.recordRequestLatency === 'function') metrics.recordRequestLatency(req, latencyMs);
  });
  next();
});

// login (authAttempt & active users)
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  let success = false;
  let userId = null;
  try {
    // replace with real auth; this is quick fake for demo
    await new Promise(r => setTimeout(r, 10));
    if (username && password && username === password) {
      success = true;
      userId = `user-${username}`;
      metrics.activeUserAdd(userId);
      res.status(200).json({ ok: true, userId });
    } else {
      res.status(401).json({ ok: false });
    }
  } catch (e) {
    res.status(500).json({ ok: false });
  } finally {
    metrics.authAttempt(success);
  }
});

app.post('/logout', (req, res) => {
  const { userId } = req.body;
  if (userId) metrics.activeUserRemove(userId);
  res.json({ ok: true });
});

// pizza creation (critical)
app.post('/pizza', async (req, res) => {
  const start = Date.now();
  try {
    // fake create/charge call
    await new Promise(r => setTimeout(r, Math.random() * 200 + 20));
    // random failure 10% for demo
    if (Math.random() < 0.1) throw new Error('create failed');

    const revenue = Math.round(Math.random() * 20 + 5);
    metrics.pizzaSold(revenue);
    const latencyMs = Date.now() - start;
    metrics.recordPizzaCreationLatency(latencyMs);
    res.status(201).json({ ok: true, revenue });
  } catch (err) {
    metrics.pizzaCreationFailed();
    const latencyMs = Date.now() - start;
    metrics.recordPizzaCreationLatency(latencyMs);
    res.status(500).json({ ok: false });
  }
});

app.get('/pizzas', async (req, res) => {
  res.json([{ id: 'p1', name: 'Margherita' }]);
});

// Prometheus scrape endpoint
app.get('/metrics', metrics.metricsEndpoint);

// start sampler & server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
  metrics.startSampler(10000); // sample CPU/mem every 10s
});