import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const packageJsonUrl = new URL('../package.json', import.meta.url);
const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(await readFile(packageJsonUrl, 'utf8'));

test('package metadata and required notice files are internally consistent', async () => {
  assert.equal(packageJson.version, '0.1.0');
  assert.equal(packageJson.author, 'gnahzil');
  assert.deepEqual(packageJson.repository, { type: 'git', url: 'git+https://github.com/gnahzil/gongxu.git' });
  assert.equal(packageJson.homepage, 'https://github.com/gnahzil/gongxu#readme');
  assert.equal(packageJson.bugs.url, 'https://github.com/gnahzil/gongxu/issues');
  assert.equal(packageJson.license, 'MIT');
  assert.deepEqual(packageJson.publishConfig, { access: 'public' });
  assert.equal(packageJson.scripts.prepublishOnly, 'npm test && npm run check');
  for (const file of ['SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md']) {
    assert.ok(packageJson.files.includes(file));
    await access(new URL(`../${file}`, import.meta.url));
  }
});

test('license and notices contain no unresolved translation exclusion', async () => {
  const notices = await readFile(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
  const license = await readFile(new URL('../LICENSE', import.meta.url), 'utf8');
  assert.doesNotMatch(`${license}\n${notices}`, /anthropic-best-practices|尚未确认获得翻译|不主张许可/i);
  assert.match(notices, /mattpocock\/skills/);
  assert.match(notices, /skills\/grilling\/SKILL\.md/);
});

test('pack manifest excludes local-sensitive and development-only files', async () => {
  const { stdout } = await execFileAsync('npm', ['pack', '--dry-run', '--json'], {
    cwd: packageRoot,
    maxBuffer: 10 * 1024 * 1024,
  });
  const [packed] = JSON.parse(stdout);
  const files = packed.files.map(({ path }) => path);
  assert.equal(packed.files.find((file) => file.path === 'bin/gongxu.js').mode & 0o111, 0o111);
  assert.ok(files.includes('THIRD_PARTY_NOTICES.md'));
  assert.ok(files.includes('docs/assets/gongxu-harness.svg'));
  assert.ok(files.includes('docs/assets/gongxu-harness.mmd'));
  assert.ok(files.includes('skills/harness-orchestration/SKILL.md'));
  for (const extra of [
    'chinese-commit-conventions',
    'production-incident-triage',
    'using-git-worktrees',
    'writing-design-doc',
  ]) assert.ok(files.includes(`extras/${extra}/SKILL.md`));
  assert.equal(files.some((file) => /skills\/(?:writing-skills|executing-plans|contract-first-design)\//.test(file)), false);
  assert.equal(files.some((file) => /(^|\/)(?:test|\.github|\.gongxu|\.private-journal)(\/|$)/.test(file)), false);
  assert.equal(files.some((file) => /(^|\/)(?:\.env(?:\..*)?|credentials\.json|secrets\.local\..*|.*\.(?:pem|key|p12|pfx|keystore))$/.test(file)), false);
});

test('published tarball installs and runs the full bundled Extra flow', { timeout: 120_000 }, async (t) => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'gongxu-packed-'));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const npmEnvironment = {
    ...process.env,
    npm_config_dry_run: 'false',
    NPM_CONFIG_DRY_RUN: 'false',
  };

  const { stdout: packOutput } = await execFileAsync('npm', [
    'pack',
    '--json',
    '--pack-destination',
    temporaryRoot,
  ], {
    cwd: packageRoot,
    env: npmEnvironment,
    maxBuffer: 10 * 1024 * 1024,
  });
  const [packed] = JSON.parse(packOutput);
  const tarball = path.join(temporaryRoot, packed.filename);
  const installRoot = path.join(temporaryRoot, 'install');
  await mkdir(installRoot);
  await execFileAsync('npm', [
    'install',
    '--prefix',
    installRoot,
    '--ignore-scripts',
    tarball,
  ], {
    env: npmEnvironment,
    maxBuffer: 10 * 1024 * 1024,
  });

  const cli = path.join(installRoot, 'node_modules', 'gongxu', 'bin', 'gongxu.js');
  const target = path.join(temporaryRoot, 'project');
  await execFileAsync(process.execPath, [
    cli,
    'add',
    '--target',
    target,
    '--extra',
    'using-git-worktrees',
    '--extra',
    'writing-design-doc',
    '--extra',
    'production-incident-triage',
    '--extra',
    'chinese-commit-conventions',
  ], { maxBuffer: 10 * 1024 * 1024 });
  const { stdout: doctorOutput } = await execFileAsync(process.execPath, [
    cli,
    'doctor',
    '--target',
    target,
  ]);

  assert.match(doctorOutput, /Gongxu 安装完整/);
  const config = JSON.parse(await readFile(path.join(target, '.gongxu', 'config.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(path.join(target, '.gongxu', 'manifest.json'), 'utf8'));
  assert.deepEqual(config.enabledExtras, [
    'chinese-commit-conventions',
    'production-incident-triage',
    'using-git-worktrees',
    'writing-design-doc',
  ]);
  assert.equal(manifest.skills.length, 15);
  assert.deepEqual(manifest.source, {
    type: 'bundled',
    input: null,
    resolved: 'npm:gongxu@0.1.0',
  });
});

test('brainstorm server rejects non-loopback binding', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ['skills/brainstorming/scripts/server.cjs'], {
      cwd: packageRoot,
      env: { ...process.env, BRAINSTORM_HOST: '0.0.0.0' },
    }),
    /only permits loopback hosts/,
  );
});
