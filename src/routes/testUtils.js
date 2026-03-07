// test/testUtils.js
const { DB } = require('../database/database'); // adapt path

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  const name = randomName();
  const email = 'admin-' + name + '@jwt.com';
  const password = 'admin';

  // Create user (wrap to handle race unique-violation)
  try {
    user = await DB.addUser({ name, email, password, roles: ['admin'] });
    return { ...user, password };
  } catch (err) {
    // If race produced duplicate, re-query and return that row
    if (err.code === '23505' /* Postgres unique_violation */ || /duplicate/i.test(err.message)) {
      user = await DB.getUser(email, password);
      if (user) return { ...user, password };
    }
    throw err;
  }
}

async function createDinerUser() {
  const name = randomName();
  const email = 'diner-' + name + '@test.com'; // unique per call to avoid collisions
  const password = 'a';
  const user = await DB.addUser({ name, email, password, roles: ['diner'] });
  return { ...user, password };
}

async function createMenuItem() {
  const item = {
    title: randomName(),
    description: 'Test Desc',
    image: 'test.png',
    price: 0.01,
  };
  const menu = await DB.addMenuItem(item);
  return menu[menu.length - 1]; // return the item we just added
}

module.exports = { createAdminUser, createDinerUser };