import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const exec = promisify(execFile);
const cli = path.resolve('bin/gongxu.js');
const source = path.resolve('.');

test('CLI parses repeated, short, and equals profile and Extra options', async (t) => {
  const parent = await mkdtemp(path.join(tmpdir(), 'gongxu-cli-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const target = path.join(parent, 'project');
  const { stdout } = await exec(process.execPath, [
    cli,
    'add',
    source,
    '--target',
    target,
    '--profile',
    'mysql-strict',
    '--profile=human-owned-testing',
    '-e',
    'using-git-worktrees',
    '--extra=writing-design-doc',
  ]);
  assert.match(stdout, /mysql-strict, human-owned-testing/);
  assert.match(stdout, /using-git-worktrees, writing-design-doc/);
  const config = JSON.parse(await readFile(path.join(target, '.gongxu/config.json'), 'utf8'));
  assert.deepEqual(config.enabledProfiles, ['mysql-strict', 'human-owned-testing']);
  assert.deepEqual(config.enabledExtras, ['using-git-worktrees', 'writing-design-doc']);

  const list = await exec(process.execPath, [cli, 'profile', 'list', '--target', target]);
  assert.match(list.stdout, /enabled mysql-strict/);
  await exec(process.execPath, [cli, 'profile', 'disable', 'mysql-strict', '--source', source, '--target', target]);
  const disabled = await exec(process.execPath, [cli, 'profile', 'list', '--target', target]);
  assert.match(disabled.stdout, /disabled mysql-strict/);
  await assert.rejects(readFile(path.join(target, 'rules/profiles/mysql-strict/database-ddl.md')), /ENOENT/);

  const extras = await exec(process.execPath, [cli, 'extra', 'list', '--target', target]);
  assert.match(extras.stdout, /enabled using-git-worktrees/);
  await exec(process.execPath, [cli, 'extra', 'disable', 'using-git-worktrees', '--source', source, '--target', target]);
  const disabledExtras = await exec(process.execPath, [cli, 'extra', 'list', '--target', target]);
  assert.match(disabledExtras.stdout, /disabled using-git-worktrees/);
  await assert.rejects(readFile(path.join(target, '.agents/skills/using-git-worktrees/SKILL.md')), /ENOENT/);
});

test('CLI enforces command-specific option grammar', async () => {
  await assert.rejects(exec(process.execPath, [cli, 'doctor', '--force']), /不适用于此命令/);
  await assert.rejects(exec(process.execPath, [cli, 'update', '--profile', 'mysql-strict']), /不适用于此命令/);
  await assert.rejects(exec(process.execPath, [cli, 'update', '--extra', 'using-git-worktrees']), /不适用于此命令/);
  await assert.rejects(exec(process.execPath, [cli, 'profile', 'list', '--dry-run']), /不适用于此命令/);
  await assert.rejects(exec(process.execPath, [cli, 'extra', 'list', '--dry-run']), /不适用于此命令/);
  await assert.rejects(exec(process.execPath, [cli, 'doctor', '--target=']), /非空值/);
});

test('profile and Extra help work without an action', async () => {
  const profile = await exec(process.execPath, [cli, 'profile', '--help']);
  assert.match(profile.stdout, /gongxu profile enable <name>/);
  const extra = await exec(process.execPath, [cli, 'extra', '--help']);
  assert.match(extra.stdout, /gongxu extra enable <name>/);
});
