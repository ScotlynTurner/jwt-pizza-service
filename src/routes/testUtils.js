// src/routes/testUtils.js
const { DB, Role } = require('../database/database.js');

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';
    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecrets' };
}

async function createDinerUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Diner }] };
    user.name = randomName();
    user.email = user.name + '@diner.com';
    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecrets' };
}

module.exports = { createAdminUser, createDinerUser };
