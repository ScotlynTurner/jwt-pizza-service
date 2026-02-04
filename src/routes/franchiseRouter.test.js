const request = require('supertest');
const app = require('../service');
const { createAdminUser, createDinerUser } = require('./testUtils.js');

let adminToken;
let dinerToken;
let adminUser;
let dinerUser;
let franchise;
let store;

beforeAll(async () => {
  // Create a diner user
  dinerUser = await createDinerUser();
  const dinerRes = await request(app)
    .post('/api/auth')
    .send(dinerUser);
  dinerToken = dinerRes.body.token;

  // Create admin and login
  adminUser = await createAdminUser();
  const adminLogin = await request(app)
    .put('/api/auth')
    .send(adminUser);
  adminToken = adminLogin.body.token;

  // Create franchise as admin
  const res = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Test Franchise',
      admins: [{ email: adminUser.email }],
    });

  franchise = res.body;
});

// test('admin can create franchise', async () => {
//   const res = await request(app)
//     .post('/api/franchise')
//     .set('Authorization', `Bearer ${adminToken}`)
//     .send({
//       name: 'Admin Franchise',
//       admins: [{ 'email': `${adminUser.email}` }],
//     });

//   expect(res.status).toBe(200);

//   expect(res.body).toEqual(
//     expect.objectContaining({
//       name: 'Admin Franchise',
//     })
//   );
// });

test('non-admin cannot create franchise', async () => {
  const res = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${dinerToken}`)
    .send({
      name: 'Bad Franchise',
      admins: [],
    });

  expect(res.status).toBe(403);
});

test('get franchises', async () => {
  const res = await request(app).get('/api/franchise');

  expect(res.status).toBe(200);

  expect(res.body).toEqual(
    expect.objectContaining({
      franchises: expect.any(Array),
      more: expect.any(Boolean),
    })
  );
});

// test('user can see own franchises', async () => {
//   const res = await request(app)
//     .get(`/api/franchise/${adminUser.id}`)
//     .set('Authorization', `Bearer ${adminToken}`);

//   expect(res.status).toBe(200);

//   expect(res.body).toEqual(
//     expect.arrayContaining([
//       expect.objectContaining({
//         name: 'Test Franchise',
//       }),
//     ])
//   );
// });

test('admin can create store', async () => {
  const res = await request(app)
    .post(`/api/franchise/${franchise.id}/store`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Main Store',
    });

  expect(res.status).toBe(200);

  expect(res.body).toEqual(
    expect.objectContaining({
      name: 'Main Store',
    })
  );

  store = res.body;
});

test('unauthorized cannot create store', async () => {
  const res = await request(app)
    .post(`/api/franchise/${franchise.id}/store`)
    .set('Authorization', `Bearer ${dinerToken}`)
    .send({
      name: 'Illegal Store',
    });

  expect(res.status).toBe(403);
});

test('admin can delete store', async () => {
  const res = await request(app)
    .delete(`/api/franchise/${franchise.id}/store/${store.id}`)
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);

  expect(res.body).toEqual({
    message: 'store deleted',
  });
});

test('admin can delete franchise', async () => {
  const res = await request(app)
    .delete(`/api/franchise/${franchise.id}`);

  expect(res.status).toBe(200);

  expect(res.body).toEqual({
    message: 'franchise deleted',
  });
});
