// test/testUtils.js
const { DB } = require('../database/database.js'); // 

function randomName() {
  return Math.random().toString(36).slice(2, 12);
}

async function createAdminUser() {
  const name = randomName();
  const email = 'admin-' + name + '@jwt.com';
  const password = 'admin';
  const user = await DB.addUser({ 
    name, 
    email, 
    password, 
    roles: [{ role: 'admin' }]   // <-- object shape with `role` prop
  });
  return { ...user, password };
}

async function createDinerUser() {
  const name = randomName();
  const email = 'diner-' + name + '@test.com';
  const password = 'a';
  const user = await DB.addUser({ 
    name, 
    email, 
    password, 
    roles: [{ role: 'diner' }]   // <-- object shape with `role` prop
  });
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

module.exports = { createAdminUser, createDinerUser, createMenuItem };