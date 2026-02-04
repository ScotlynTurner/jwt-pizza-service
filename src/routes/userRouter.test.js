const request = require('supertest');
const app = require('../service');
const { createAdminUser, createDinerUser } = require('./testUtils.js');

let adminToken;
let dinerToken;
let adminUser;
let dinerUser;

beforeAll(async () => {
  // Create admin user and login
  adminUser = await createAdminUser();
  const adminLoginRes = await request(app)
    .put('/api/auth')
    .send({ email: adminUser.email, password: adminUser.password });
  adminToken = adminLoginRes.body.token;

  // Create a regular diner user
  dinerUser = await createDinerUser();
  const dinerRes = await request(app)
    .post('/api/auth')
    .send(dinerUser);
  dinerToken = dinerRes.body.token;
});


// ------------------------
// GET /me
// ------------------------
test('get current user', async () => {
  const res = await request(app)
    .get('/api/user/me')
    .set('Authorization', `Bearer ${dinerToken}`);

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    id: expect.any(Number),
    name: dinerUser.name,
    email: dinerUser.email,
    roles: [{ role: 'diner' }],
  });
});

// ------------------------
// PUT /:userId allows admin to update any user
// ------------------------
test('allow admin to update another user', async () => {
  const newName = 'Admin Updated Diner';
  const res = await request(app)
    .put(`/api/user/${dinerUser.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: newName, email: dinerUser.email, password: dinerUser.password });

  expect(res.status).toBe(200);
  expect(res.body.user.name).toBe(newName);
  expect(res.body.token).toBeDefined();
});


// ------------------------
// PUT /:userId blocks non-admin from updating others
// ------------------------
test('block diner updating another user', async () => {
  const res = await request(app)
    .put(`/api/user/${adminUser.id}`)
    .set('Authorization', `Bearer ${dinerToken}`)
    .send({ name: 'Hacker', email: adminUser.email, password: adminUser.password });

  expect(res.status).toBe(403);
});


// ------------------------
// DELETE /:userId
// ------------------------
test('delete user', async () => {
  const res = await request(app)
    .delete(`/api/user/${dinerUser.id}`)
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  expect(res.body.message).toBe('not implemented');
});


// ------------------------
// GET / (list users)
// ------------------------
test('list users', async () => {
  const res = await request(app)
    .get('/api/user')
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  expect(res.body.users).toEqual([]);
  expect(res.body.more).toBe(false);
});
