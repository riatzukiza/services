#!/usr/bin/env node
// Opt-in diagnostic for rendered Compose JSON. No host reads, writes or deployment.
import {isAbsolute, normalize, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const absolutePath = value => nonempty(value) && !value.includes('\0') && isAbsolute(value);
const result = errors => ({ok: errors.length === 0, scope: 'configuration-only', errors});

function origin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && url.origin === value;
  } catch { return false; }
}

/**
 * Check only public instance fields and signing-mount metadata.
 * @param {unknown} config Rendered `docker compose config --format json` value.
 * @param {{environment?: string, origin?: string}} expected Operator-selected target.
 * @returns {{ok: boolean, scope: string, errors: string[]}} Fixed codes, never input values.
 */
export function inspectSigningConfig(config, expected = {}) {
  const errors = [];
  const require = (condition, code) => { if (!condition) errors.push(code); };
  require(['testing', 'staging'].includes(expected.environment), 'expected-environment');
  require(origin(expected.origin), 'expected-origin');
  if (errors.length) return result(errors);
  const service = object(config) && object(config.services) ? config.services.axxium : null;
  if (!object(service)) return result(['axxium-service']);
  const env = service.environment;
  if (!object(env)) return result(['environment-map']);
  require(env.AXXIUM_ENV === expected.environment, 'instance-environment');
  require(env.AXXIUM_ISS === expected.origin, 'instance-issuer');
  require(env.AXXIUM_PUBLIC_BASE_URL === expected.origin, 'public-origin');
  require(env.AXXIUM_SERVICE === 'promethean', 'instance-service');
  require(env.JWT_AUDIENCE == null || (typeof env.JWT_AUDIENCE === 'string' && (!env.JWT_AUDIENCE.trim() || env.JWT_AUDIENCE === `promethean+${expected.environment}`)), 'configured-audience');
  const signingPath = env.AXXIUM_SIGNING_KEY_FILE;
  const identityPath = env.AXXIUM_IDENTITY_KEY_FILE;
  const validPath = absolutePath(signingPath);
  require(validPath && (!nonempty(identityPath) || normalize(signingPath) !== normalize(identityPath)), 'signing-path');
  const mounts = Array.isArray(service.volumes) ? service.volumes.filter(object) : [];
  const selected = validPath ? mounts.filter(mount => mount.target === signingPath) : [];
  require(selected.length === 1, 'signing-mount');
  if (selected.length === 1) {
    const mount = selected[0];
    require(mount.type === 'bind', 'signing-bind');
    require(mount.read_only === true, 'signing-read-only');
    require(object(mount.bind) && mount.bind.create_host_path === false, 'signing-create-host-path');
    require(absolutePath(mount.source), 'signing-source');
    const transfers = mounts.filter(item => nonempty(identityPath) && item.target === identityPath);
    require(!transfers.some(item => nonempty(item.source) && nonempty(mount.source)
      && normalize(item.source) === normalize(mount.source)), 'separate-key-sources');
  }
  return result(errors);
}

async function main() {
  let report;
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2) throw new Error('input');
    let bytes = 0;
    const chunks = [];
    for await (const chunk of process.stdin) {
      bytes += chunk.length;
      if (bytes > 2 * 1024 * 1024) throw new Error('input');
      chunks.push(chunk);
    }
    const config = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    report = inspectSigningConfig(config, {environment: args[0], origin: args[1]});
  } catch {
    // Parser exceptions can include credential-bearing source; never print them.
    report = result(['invalid-input']);
  }
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
