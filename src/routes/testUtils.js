// test/testUtils.js
const { DB } = require('../src/database/database'); // adapt path

async function createAdminUser() {
  const email = process.env.TEST_ADMIN_EMAIL || 'a@jwt.com';
  const name = 'Test Admin';
  const password = process.env.TEST_ADMIN_PW || 'admin';

  // Try find first
  let user = await DB.findUserByEmail(email);
  if (user) {
    console.log('[createAdminUser] existing admin id=' + user.id);
    return { ...user, password }; // return password so tests can login
  }

  // Create user (wrap to handle race unique-violation)
  try {
    user = await DB.createUser({ name, email, password, roles: ['admin'] });
    return { ...user, password };
  } catch (err) {
    // If race produced duplicate, re-query and return that row
    if (err.code === '23505' /* Postgres unique_violation */ || /duplicate/i.test(err.message)) {
      user = await DB.findUserByEmail(email);
      if (user) return { ...user, password };
    }
    throw err;
  }
}

async function createDinerUser() {
  const email = `diner+${Date.now()}@test.com`; // unique per call to avoid collisions
  const name = 'Test Diner';
  const password = 'a';
  const user = await DB.createUser({ name, email, password, roles: ['diner'] });
  return { ...user, password };
}

module.exports = { createAdminUser, createDinerUser };