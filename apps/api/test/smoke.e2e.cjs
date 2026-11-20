const assert = require('node:assert/strict');

const baseUrl = (process.env.E2E_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

async function main() {
  const publicCatalog = await fetch(`${baseUrl}/api/public/records?page=1&pageSize=1`);
  assert.equal(publicCatalog.status, 200, 'public catalog should be reachable without a session');
  const catalog = await publicCatalog.json();
  assert.ok(Array.isArray(catalog.items), 'public catalog should return a paginated result');

  const session = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(session.status, 401, 'private session endpoint should reject an anonymous request');
  const profilePhoto = await fetch(`${baseUrl}/api/me/profile/photo`);
  assert.equal(profilePhoto.status, 401, 'profile photos should require an authenticated session');

  console.log('PASS smoke: public catalog responds; session and profile photo endpoints reject anonymous access');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
