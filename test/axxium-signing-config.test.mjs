import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectSigningConfig} from '../scripts/check-axxium-signing-config.mjs';

const expected = {environment: 'staging', origin: 'https://staging.axxium.promethean.rest'};
const cli = fileURLToPath(new URL('../scripts/check-axxium-signing-config.mjs', import.meta.url));
function fixture() {
  return {services: {axxium: {environment: {
    NODE_ENV: 'production', AXXIUM_PUBLIC_BASE_URL: expected.origin,
    AXXIUM_ISS: expected.origin, AXXIUM_SERVICE: 'promethean', AXXIUM_ENV: 'staging',
    AXXIUM_SIGNING_KEY_FILE: '/run/axxium/signing-key.pem',
    AXXIUM_IDENTITY_KEY_FILE: '/run/axxium/identity-private.json',
    DB_PASSWORD: 'synthetic-secret-do-not-print'
  }, volumes: [
    {type: 'bind', source: '/isolated/staging/signing-key.pem', target: '/run/axxium/signing-key.pem', read_only: true, bind: {create_host_path: false}},
    {type: 'bind', source: '/isolated/staging/identity-private.json', target: '/run/axxium/identity-private.json', read_only: true}
  ]}}};
}
function rejects(name, code, edit, policy = expected) {
  test(name, () => {
    const config = fixture(); edit(config);
    const result = inspectSigningConfig(config, policy);
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes(code), JSON.stringify(result));
    assert.ok(!JSON.stringify(result).includes('synthetic-secret-do-not-print'));
  });
}
test('explicit staging signing metadata passes without exposing configuration', () => {
  const config = fixture(), original = structuredClone(config);
  assert.deepEqual(inspectSigningConfig(config, expected), {ok: true, scope: 'configuration-only', errors: []});
  assert.deepEqual(config, original);
});
test('testing environment is independent of production NODE_ENV', () => {
  const config = fixture(), origin = 'https://testing.axxium.promethean.rest';
  Object.assign(config.services.axxium.environment, {AXXIUM_ENV: 'testing', AXXIUM_ISS: origin, AXXIUM_PUBLIC_BASE_URL: origin});
  assert.equal(inspectSigningConfig(config, {environment: 'testing', origin}).ok, true);
});
rejects('old template lacks signing file', 'signing-path', c => delete c.services.axxium.environment.AXXIUM_SIGNING_KEY_FILE);
rejects('implicit NODE_ENV cannot select token audience', 'instance-environment', c => delete c.services.axxium.environment.AXXIUM_ENV);
rejects('wrong environment is rejected', 'instance-environment', c => c.services.axxium.environment.AXXIUM_ENV = 'production');
rejects('wrong issuer is rejected', 'instance-issuer', c => c.services.axxium.environment.AXXIUM_ISS = 'https://axxium.promethean.rest');
rejects('wrong public origin is rejected', 'public-origin', c => c.services.axxium.environment.AXXIUM_PUBLIC_BASE_URL = 'https://other.invalid');
rejects('audience service must be explicit', 'instance-service', c => delete c.services.axxium.environment.AXXIUM_SERVICE);
rejects('old bare JWT audience is rejected', 'configured-audience', c => c.services.axxium.environment.JWT_AUDIENCE = 'promethean');
test('matching explicit legacy audience is accepted', () => {
  const c = fixture(); c.services.axxium.environment.JWT_AUDIENCE = 'promethean+staging';
  assert.equal(inspectSigningConfig(c, expected).ok, true);
});
rejects('transfer JWK path cannot be signing PEM path', 'signing-path', c => c.services.axxium.environment.AXXIUM_SIGNING_KEY_FILE = '/run/axxium/identity-private.json');
rejects('signing mount must exist', 'signing-mount', c => c.services.axxium.volumes.shift());
rejects('signing mount must be read-only', 'signing-read-only', c => c.services.axxium.volumes[0].read_only = false);
rejects('signing mount must be a bind', 'signing-bind', c => c.services.axxium.volumes[0].type = 'volume');
rejects('missing PEM must not create a directory', 'signing-create-host-path', c => delete c.services.axxium.volumes[0].bind);
rejects('same signing and transfer source is rejected', 'separate-key-sources', c => c.services.axxium.volumes[0].source = c.services.axxium.volumes[1].source);
rejects('identity exposed through a directory bind cannot share the signing source', 'separate-key-sources', c => {
  c.services.axxium.volumes[0].source = '/isolated/staging/identity-private.json';
  c.services.axxium.volumes[1] = {type: 'bind', source: '/isolated/staging', target: '/run/axxium'};
});
rejects('relative rendered source is rejected', 'signing-source', c => c.services.axxium.volumes[0].source = './key.pem');
rejects('duplicate signing targets are rejected', 'signing-mount', c => c.services.axxium.volumes.push({...c.services.axxium.volumes[0]}));
rejects('unrendered short mount syntax is rejected', 'signing-mount', c => c.services.axxium.volumes = ['a:b:ro']);
rejects('non-object environment is rejected', 'environment-map', c => c.services.axxium.environment = []);
rejects('production is outside this candidate diagnostic', 'expected-environment', () => {}, {...expected, environment: 'production'});
rejects('credential-bearing expected origin is refused', 'expected-origin', () => {}, {...expected, origin: 'https://user:pass@staging.invalid'});
rejects('path-bearing expected origin is refused', 'expected-origin', () => {}, {...expected, origin: 'https://staging.invalid/subpath'});
test('absent or malformed structures return bounded errors', () => {
  for (const value of [null, [], 42, {}, {services: {axxium: null}}]) {
    assert.deepEqual(inspectSigningConfig(value, expected), {ok: false, scope: 'configuration-only', errors: ['axxium-service']});
  }
});
test('CLI redacts malformed JSON and exits nonzero', () => {
  const r = spawnSync(process.execPath, [cli, 'staging', expected.origin], {input: '{"secret":"synthetic-secret-do-not-print",', encoding: 'utf8'});
  assert.equal(r.status, 1);
  assert.deepEqual(JSON.parse(r.stdout).errors, ['invalid-input']);
  assert.equal(r.stderr, '');
  assert.ok(!r.stdout.includes('synthetic-secret-do-not-print'));
});
test('CLI reads JSON from stdin and prints only bounded diagnostic', () => {
  const r = spawnSync(process.execPath, [cli, 'staging', expected.origin], {input: JSON.stringify(fixture()), encoding: 'utf8'});
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout), {ok: true, scope: 'configuration-only', errors: []});
  assert.equal(r.stderr, '');
});
test('CLI input limit fails without echoing bytes', () => {
  const r = spawnSync(process.execPath, [cli, 'staging', expected.origin], {input: 'x'.repeat(2 * 1024 * 1024 + 1), encoding: 'utf8'});
  assert.equal(r.status, 1);
  assert.deepEqual(JSON.parse(r.stdout).errors, ['invalid-input']);
  assert.equal(r.stderr, '');
});

rejects('non-string audience is not an absent override', 'configured-audience', c => c.services.axxium.environment.JWT_AUDIENCE = 7);
rejects('NUL signing path is refused', 'signing-path', c => c.services.axxium.environment.AXXIUM_SIGNING_KEY_FILE = '/run/axxium/key\0.pem');
rejects('NUL host path is refused', 'signing-source', c => c.services.axxium.volumes[0].source = '/isolated/key\0.pem');
test('legacy staging projection exhibits the known signing mismatch', () => {
  const c = fixture(), env = c.services.axxium.environment;
  for (const name of ['AXXIUM_ISS', 'AXXIUM_ENV', 'AXXIUM_SERVICE', 'AXXIUM_SIGNING_KEY_FILE']) delete env[name];
  env.JWT_ISSUER = expected.origin; env.JWT_SECRET = 'synthetic-secret-do-not-print';
  c.services.axxium.volumes.shift();
  assert.deepEqual(inspectSigningConfig(c, expected).errors,
    ['instance-environment', 'instance-issuer', 'instance-service', 'signing-path', 'signing-mount']);
});
