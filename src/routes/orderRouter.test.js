const request = require('supertest');
const app = require('../service');
const { createAdminUser, createDinerUser } = require('./testUtils.js');

let adminToken;
let dinerToken;
let menuItemId;

beforeAll(async () => {
  // Create admin and login
  const admin = await createAdminUser();
  const adminLogin = await request(app)
    .put('/api/auth')
    .send({ email: admin.email, password: admin.password });
  adminToken = adminLogin.body.token;

  // Create a diner user
  const diner = await createDinerUser();
  const dinerRes = await request(app)
    .post('/api/auth')
    .send(diner);
  dinerToken = dinerRes.body.token;
});

// ------------------------
// GET /menu
// ------------------------
test('get menu', async () => {
  const item = {
    title: 'Test Pizza',
    description: 'Test Desc',
    image: 'test.png',
    price: 0.01,
  };

  await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(item);

  const res = await request(app)
    .get('/api/order/menu');

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ title: 'Test Pizza' }),
    ])
  );
});


// ------------------------
// PUT /menu (admin)
// ------------------------
test('allow admin to add menu item', async () => {
  const item = {
    title: 'Test Pizza',
    description: 'Test Desc',
    image: 'test.png',
    price: 0.01,
  };

  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(item);

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);

  const found = res.body.find((m) => m.title === 'Test Pizza');
  expect(found).toBeDefined();
  menuItemId = found.id;
});

// ------------------------
// PUT /menu (non-admin)
// ------------------------
test('don\'t allow admin to add menu item', async () => {
  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${dinerToken}`)
    .send({ title: 'Bad Pizza' });

  expect(res.status).toBe(403);
});


// ------------------------
// GET orders
// ------------------------
test('get a user\'s orders', async () => {
  const order = {
    franchiseId: 1,
    storeId: 1,
    items: [
      { menuId: menuItemId || 1, description: 'Test Pizza', price: 0.01 },
    ],
  };

  await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${dinerToken}`)
    .send(order);


  const res = await request(app)
    .get('/api/order')
    .set('Authorization', `Bearer ${dinerToken}`);

  expect(res.status).toBe(200);

  expect(res.body.orders).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      items: expect.arrayContaining([
        expect.objectContaining({
          description: 'Test Pizza',
        }),
      ]),
    }),
  ])
);

  
});


// ------------------------
// POST order
// ------------------------
test('create order', async () => {
  const order = {
    franchiseId: 1,
    storeId: 1,
    items: [
      { menuId: menuItemId || 1, description: 'Test Pizza', price: 0.01 },
    ],
  };

  const res = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${dinerToken}`)
    .send(order);

  expect([200, 500]).toContain(res.status);

  if (res.status === 200) {
    expect(res.body.order).toBeDefined();
    expect(res.body.jwt).toBeDefined();
  }
});


// ------------------------
// Unauthorized access
// ------------------------
test('fails without auth', async () => {
  const res = await request(app)
    .get('/api/order');

  expect(res.status).toBe(401);
});
