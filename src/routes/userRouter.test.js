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

  // Create a diner user and login
  const diner = await createDinerUser();
  const dinerLogin = await request(app)
    .put('/api/auth')
    .send({ email: diner.email, password: diner.password });
  dinerToken = dinerLogin.body.token;
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
  expect(res.body.message).toBe('user deleted');
});


// ------------------------
// GET / (list users)
// ------------------------
test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
  const [user, userToken] = await registerUser(request(app));
  console.log('Registered user:', user);
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);
  expect(listUsersRes.status).toBe(200);
});

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}