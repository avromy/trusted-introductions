const { test: base } = require('@playwright/test');

const roles = ['seeker', 'helper', 'steward'];

function buildTestUser(role = 'seeker') {
  if (!roles.includes(role)) throw new Error(`Unsupported E2E role: ${role}`);
  return {
    id: `e2e-${role}-user`,
    email: `e2e+${role}@example.test`,
    role,
  };
}

async function seedAuthenticatedSession(context, role = 'seeker') {
  const user = buildTestUser(role);
  await context.addInitScript((sessionUser) => {
    window.localStorage.setItem('trusted-introductions:e2e-user', JSON.stringify(sessionUser));
  }, user);
  return user;
}

async function clearE2ESession(context) {
  await context.addInitScript(() => {
    window.localStorage.removeItem('trusted-introductions:e2e-user');
  });
}

const test = base.extend({
  e2eUser: async ({ context }, use) => {
    const user = await seedAuthenticatedSession(context, 'seeker');
    await use(user);
    await clearE2ESession(context);
  },
  authenticatedPage: async ({ page, context }, use) => {
    await seedAuthenticatedSession(context, 'seeker');
    await use(page);
  },
});

module.exports = {
  test,
  expect: base.expect,
  buildTestUser,
  seedAuthenticatedSession,
  clearE2ESession,
};
