import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CORE_SKILLS,
  SUPPORTED_EXTRAS,
  doctorHarness,
  getUpdateConfiguration,
  installHarness,
  listExtras,
  listProfiles,
  readConfiguration,
  setExtra,
  setProfile,
  validateConfiguration,
  validateManifest,
} from '../src/installer.js';

const sourceRoot = path.resolve('.');
const expectedCoreSkills = [
  'brainstorming',
  'dispatching-parallel-agents',
  'domain-modeling',
  'finishing-a-development-branch',
  'grilling',
  'harness-orchestration',
  'mapping-workspace',
  'systematic-debugging',
  'using-gongxu',
  'verification-before-completion',
  'wayfinder',
];
const expectedExtras = [
  'chinese-commit-conventions',
  'production-incident-triage',
  'using-git-worktrees',
  'writing-design-doc',
];

async function temporaryDirectory(name) {
  return mkdtemp(path.join(tmpdir(), `gongxu-${name}-`));
}

async function exists(file) {
  try { await readFile(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

test('default install writes the exact core contract, safe config, and no optional content', async (t) => {
  assert.deepEqual(CORE_SKILLS, expectedCoreSkills);
  assert.deepEqual(SUPPORTED_EXTRAS, expectedExtras);
  const parent = await temporaryDirectory('default');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const target = path.join(parent, 'project');
  const result = await installHarness({ source: sourceRoot, target });
  assert.deepEqual(result.profiles, []);
  assert.deepEqual(result.extras, []);
  assert.equal(result.skillCount, CORE_SKILLS.length);
  assert.equal(await exists(path.join(target, 'rules', 'testing.md')), true);
  assert.equal(await exists(path.join(target, 'rules', 'profiles', 'mysql-strict', 'database-ddl.md')), false);
  assert.equal(await exists(path.join(target, '.agents', 'rules', 'profiles', 'human-owned-testing', 'no-agent-tests.md')), false);
  assert.equal(await exists(path.join(target, '.gongxu', 'templates', 'context.local.md.example')), true);
  assert.equal(await exists(path.join(target, '.gongxu', 'context.local.md')), false);
  const config = JSON.parse(await readFile(path.join(target, '.gongxu', 'config.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(path.join(target, '.gongxu', 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.source, { type: 'local', input: null, resolved: 'local' });
  assert.equal(await exists(path.join(target, 'AGENTS.md')), true);
  assert.equal(await exists(path.join(target, 'CLAUDE.md')), true);
  assert.deepEqual(config.enabledProfiles, []);
  assert.deepEqual(config.enabledExtras, []);
  assert.deepEqual(manifest.extras, []);
  assert.deepEqual(manifest.skills, [...CORE_SKILLS].sort());
  assert.equal(await exists(path.join(target, '.agents/skills/using-git-worktrees/SKILL.md')), false);
  const parallelContract = await readFile(
    path.join(target, '.agents/skills/dispatching-parallel-agents/SKILL.md'),
    'utf8',
  );
  assert.match(parallelContract, /不能在共享可写工作区中并行修改代码/);
  assert.match(parallelContract, /没有隔离能力时不得静默改为共享目录并行写/);
  const executorContract = await readFile(path.join(target, '.claude/agents/executor.md'), 'utf8');
  assert.match(executorContract, /不得继续分派实现 subagent/);
  assert.match(executorContract, /workspace_assignment/);
  const plannerContract = await readFile(path.join(target, '.claude/agents/planner.md'), 'utf8');
  assert.match(plannerContract, /owned_scope/);
  assert.match(plannerContract, /mutable_runtime_scope/);
  const evaluatorContract = await readFile(path.join(target, '.claude/agents/evaluator.md'), 'utf8');
  assert.match(evaluatorContract, /executor_results/);
  assert.equal(config.artifactRoot, 'docs/gongxu');
  assert.equal(JSON.stringify(config).includes(sourceRoot), false);
  assert.match(await readFile(path.join(target, '.gongxu', '.gitignore'), 'utf8'), /context\.local\.md\ntriage-private\//);
  const doctor = await doctorHarness({ target });
  assert.deepEqual(doctor.errors, []);
});

test('profile selection installs only registered files in all mirrors', async (t) => {
  const parent = await temporaryDirectory('profiles');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const mysqlTarget = path.join(parent, 'mysql');
  await installHarness({ source: sourceRoot, target: mysqlTarget, profiles: ['mysql-strict'] });
  for (const prefix of ['rules', '.agents/rules', '.claude/rules']) {
    assert.equal(await exists(path.join(mysqlTarget, prefix, 'profiles/mysql-strict/database-ddl.md')), true);
    assert.equal(await exists(path.join(mysqlTarget, prefix, 'profiles/human-owned-testing/no-agent-tests.md')), false);
  }
  const bothTarget = path.join(parent, 'both');
  await installHarness({ source: sourceRoot, target: bothTarget, profiles: ['mysql-strict', 'human-owned-testing'] });
  assert.equal(await exists(path.join(bothTarget, 'rules/profiles/human-owned-testing/manual-e2e-case.md')), true);
  const manifest = JSON.parse(await readFile(path.join(bothTarget, '.gongxu/manifest.json'), 'utf8'));
  assert.deepEqual(manifest.profiles, ['mysql-strict', 'human-owned-testing']);
  assert.equal(new Set(manifest.files.map((file) => file.path)).size, manifest.files.length);
});

test('Extra selection installs only named optional skills in all mirrors', async (t) => {
  const parent = await temporaryDirectory('extras');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const target = path.join(parent, 'project');
  const result = await installHarness({
    source: sourceRoot,
    target,
    extras: ['writing-design-doc', 'using-git-worktrees'],
  });
  assert.deepEqual(result.extras, ['using-git-worktrees', 'writing-design-doc']);
  assert.equal(result.skillCount, CORE_SKILLS.length + 2);
  for (const prefix of ['.agents/skills', '.claude/skills']) {
    assert.equal(await exists(path.join(target, prefix, 'using-git-worktrees/SKILL.md')), true);
    assert.equal(await exists(path.join(target, prefix, 'writing-design-doc/SKILL.md')), true);
    assert.equal(await exists(path.join(target, prefix, 'production-incident-triage/SKILL.md')), false);
  }
  const manifest = JSON.parse(await readFile(path.join(target, '.gongxu/manifest.json'), 'utf8'));
  const worktreeContract = await readFile(
    path.join(target, '.agents/skills/using-git-worktrees/SKILL.md'),
    'utf8',
  );
  assert.match(worktreeContract, /git worktree add --detach/);
  assert.match(worktreeContract, /mode: parallel-execution-unit/);
  assert.match(worktreeContract, /integration_mode: patch/);
  assert.deepEqual(manifest.extras, ['using-git-worktrees', 'writing-design-doc']);
  assert.deepEqual(manifest.skills, [...CORE_SKILLS, 'using-git-worktrees', 'writing-design-doc'].sort());
  assert.deepEqual(await listExtras(target), SUPPORTED_EXTRAS.map((name) => ({
    name,
    enabled: ['using-git-worktrees', 'writing-design-doc'].includes(name),
  })));
});

test('Extra changes are atomic, require nonpersistent source, and back up forced removals', async (t) => {
  const parent = await temporaryDirectory('extra-reconcile');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const target = path.join(parent, 'project');
  const skillFile = path.join(target, '.agents/skills/using-git-worktrees/SKILL.md');
  await installHarness({ source: sourceRoot, target, extras: ['using-git-worktrees'] });
  await assert.rejects(setExtra({ target, extra: 'using-git-worktrees', enabled: false }), /--source/);
  await writeFile(skillFile, 'local change\n');
  await assert.rejects(
    setExtra({ target, extra: 'using-git-worktrees', enabled: false, source: sourceRoot }),
    /本地修改|文件冲突/,
  );
  assert.deepEqual((await readConfiguration(target)).parsed.enabledExtras, ['using-git-worktrees']);
  assert.equal(await readFile(skillFile, 'utf8'), 'local change\n');

  const forced = await setExtra({
    target,
    extra: 'using-git-worktrees',
    enabled: false,
    source: sourceRoot,
    force: true,
  });
  assert.equal(forced.changed, true);
  assert.ok(forced.result.backupRoot);
  assert.equal(await exists(skillFile), false);
  assert.equal(
    await readFile(path.join(forced.result.backupRoot, '.agents/skills/using-git-worktrees/SKILL.md'), 'utf8'),
    'local change\n',
  );
  assert.deepEqual((await readConfiguration(target)).parsed.enabledExtras, []);
  assert.deepEqual((await doctorHarness({ target })).errors, []);
});

test('profile configuration is idempotent and reconciles files atomically', async (t) => {
  const parent = await temporaryDirectory('reconcile');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const target = path.join(parent, 'project');
  await installHarness({ source: sourceRoot, target, profiles: ['mysql-strict'] });
  const changed = await setProfile({ target, profile: 'mysql-strict', enabled: false, source: sourceRoot });
  assert.equal(changed.changed, true);
  assert.ok(changed.result.summary.remove >= 3);
  assert.equal((await setProfile({ target, profile: 'mysql-strict', enabled: false })).changed, false);
  assert.deepEqual(await listProfiles(target), [
    { name: 'mysql-strict', enabled: false },
    { name: 'human-owned-testing', enabled: false },
  ]);
  assert.equal(await exists(path.join(target, 'rules/profiles/mysql-strict/database-ddl.md')), false);
  const doctor = await doctorHarness({ target });
  assert.deepEqual(doctor.errors, []);
  assert.equal(doctor.warnings.some((warning) => /待 update|仍有文件/.test(warning)), false);
});

test('profile changes require the nonpersistent source and stop atomically on conflicts', async (t) => {
  const parent = await temporaryDirectory('conflict');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const target = path.join(parent, 'project');
  const profileFile = path.join(target, 'rules/profiles/mysql-strict/database-ddl.md');
  await installHarness({ source: sourceRoot, target, profiles: ['mysql-strict'] });
  await assert.rejects(setProfile({ target, profile: 'mysql-strict', enabled: false }), /--source/);
  await writeFile(profileFile, 'local change\n');
  await assert.rejects(
    setProfile({ target, profile: 'mysql-strict', enabled: false, source: sourceRoot }),
    /本地修改|文件冲突/,
  );
  assert.equal(await readFile(profileFile, 'utf8'), 'local change\n');
  assert.equal((await readConfiguration(target)).parsed.enabledProfiles.includes('mysql-strict'), true);
});

test('dry run plans config without writing target', async (t) => {
  const parent = await temporaryDirectory('dry');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const target = path.join(parent, 'not-created');
  const result = await installHarness({ source: sourceRoot, target, dryRun: true, profiles: ['human-owned-testing'] });
  assert.equal(result.dryRun, true);
  assert.equal(await exists(path.join(target, '.gongxu/config.json')), false);
});

test('custom sources require every core skill and only selected Extras', async (t) => {
  const parent = await temporaryDirectory('source-skills');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const copySource = async (name) => {
    const destination = path.join(parent, name);
    await cp(sourceRoot, destination, {
      recursive: true,
      filter: (entry) => !entry.includes(`${path.sep}.git`) && !entry.includes(`${path.sep}node_modules`),
    });
    return destination;
  };

  const missingCore = await copySource('missing-core');
  await rm(path.join(missingCore, 'skills/brainstorming'), { recursive: true, force: true });
  await assert.rejects(
    installHarness({ source: missingCore, target: path.join(parent, 'core-target') }),
    /缺少核心 Skill：brainstorming/,
  );

  const missingExtra = await copySource('missing-extra');
  await rm(path.join(missingExtra, 'extras/using-git-worktrees'), { recursive: true, force: true });
  await installHarness({ source: missingExtra, target: path.join(parent, 'core-only') });
  await assert.rejects(
    installHarness({
      source: missingExtra,
      target: path.join(parent, 'extra-target'),
      extras: ['using-git-worktrees'],
    }),
    /缺少Extra Skill：using-git-worktrees/,
  );
});

test('legacy config and manifest without Extra fields update in place', async (t) => {
  const parent = await temporaryDirectory('legacy-extras');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const target = path.join(parent, 'project');
  await installHarness({ source: sourceRoot, target });
  const configPath = path.join(target, '.gongxu/config.json');
  const manifestPath = path.join(target, '.gongxu/manifest.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  delete config.enabledExtras;
  const legacyConfig = `${JSON.stringify(config, null, 2)}\n`;
  await writeFile(configPath, legacyConfig);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  delete manifest.extras;
  manifest.skills.push('executing-plans');
  manifest.skills.sort();
  const staleFiles = [
    ['.agents/skills/executing-plans/SKILL.md', 'skill:executing-plans'],
    ['.claude/skills/executing-plans/SKILL.md', 'skill:executing-plans'],
    ['.claude/agents/code-reviewer.md', 'agent:claude-code'],
    ['.codex/agents/code-reviewer.toml', 'agent:codex'],
  ];
  const staleContent = 'legacy managed file\n';
  const { mkdir } = await import('node:fs/promises');
  for (const [relative, kind] of staleFiles) {
    const destination = path.join(target, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, staleContent);
    manifest.files.push({
      path: relative,
      kind,
      sha256: createHash('sha256').update(staleContent).digest('hex'),
    });
  }
  manifest.files.find((file) => file.path === '.gongxu/config.json').sha256 = createHash('sha256').update(legacyConfig).digest('hex');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const update = await getUpdateConfiguration(target);
  assert.deepEqual(update.extras, []);
  assert.deepEqual(update.configuration.enabledExtras, []);
  await installHarness({
    source: sourceRoot,
    target,
    agents: update.agents,
    profiles: update.profiles,
    extras: update.extras,
    configuration: update.configuration,
  });
  assert.deepEqual(JSON.parse(await readFile(configPath, 'utf8')).enabledExtras, []);
  assert.deepEqual(JSON.parse(await readFile(manifestPath, 'utf8')).extras, []);
  for (const [relative] of staleFiles) assert.equal(await exists(path.join(target, relative)), false);
});

test('configuration rejects malformed shapes, unknown profiles, duplicates, and unsafe paths', async () => {
  const valid = {
    schemaVersion: 1,
    enabledProfiles: [],
    enabledExtras: [],
    artifactRoot: 'docs/gongxu',
    sourceRoots: [],
    visual: { provider: 'auto' },
    testing: { targeted: 'auto', fullSuite: 'ask' },
    models: { planner: 'auto', executor: 'auto', evaluator: 'auto' },
  };
  assert.equal(validateConfiguration(valid), valid);
  assert.throws(() => validateConfiguration({ ...valid, extra: true }), /字段/);
  assert.throws(() => validateConfiguration({ ...valid, enabledProfiles: ['unknown'] }), /不支持/);
  assert.throws(() => validateConfiguration({ ...valid, enabledProfiles: ['mysql-strict', 'mysql-strict'] }), /排列|重复/);
  assert.throws(() => validateConfiguration({ ...valid, enabledExtras: ['unknown'] }), /不支持/);
  assert.throws(() => validateConfiguration({ ...valid, enabledExtras: ['using-git-worktrees', 'using-git-worktrees'] }), /排列|重复/);
  assert.throws(() => validateConfiguration({ ...valid, artifactRoot: '../private' }), /artifactRoot/);
  const { enabledExtras, ...legacy } = valid;
  assert.deepEqual(validateConfiguration(legacy).enabledExtras, []);
});

test('configuration refuses symlink ancestors and malformed JSON', async (t) => {
  const parent = await temporaryDirectory('config-safety');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const target = path.join(parent, 'project');
  const outside = path.join(parent, 'outside');
  await import('node:fs/promises').then(({ mkdir }) => Promise.all([mkdir(target), mkdir(outside)]));
  await symlink(outside, path.join(target, '.gongxu'));
  await assert.rejects(readConfiguration(target), /符号链接/);

  const target2 = path.join(parent, 'malformed');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(path.join(target2, '.gongxu'), { recursive: true }));
  await writeFile(path.join(target2, '.gongxu/config.json'), '{bad');
  await assert.rejects(readConfiguration(target2), /无法读取/);
});

test('manifest schema 1 is intentionally rejected', () => {
  assert.throws(() => validateManifest({ schemaVersion: 1 }), /重新安装/);
});

test('manifest Extras must match the exact installed Skill set', async (t) => {
  const parent = await temporaryDirectory('manifest-extras');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const target = path.join(parent, 'project');
  await installHarness({ source: sourceRoot, target });
  const manifest = JSON.parse(await readFile(path.join(target, '.gongxu/manifest.json'), 'utf8'));
  assert.throws(() => validateManifest({ ...manifest, extras: 'using-git-worktrees' }), /Extra 清单/);
  assert.throws(
    () => validateManifest({ ...manifest, extras: ['using-git-worktrees'] }),
    /Skill 清单与核心及 Extras 不一致/,
  );
  assert.throws(
    () => validateManifest({ ...manifest, skills: manifest.skills.filter((name) => name !== 'brainstorming') }),
    /缺少核心 Skill/,
  );
});

test('manifest cannot claim or remove paths outside Gongxu-owned locations', async (t) => {
  const parent = await temporaryDirectory('manifest-ownership');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const target = path.join(parent, 'project');
  await installHarness({ source: sourceRoot, target });
  const manifestPath = path.join(target, '.gongxu/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const victimPath = path.join(target, 'package.json');
  const victim = '{"private":true}\n';
  await writeFile(victimPath, victim);
  manifest.files.push({
    path: 'package.json',
    kind: 'rule',
    sha256: createHash('sha256').update(victim).digest('hex'),
  });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  await assert.rejects(installHarness({ source: sourceRoot, target, force: true }), /非 Gongxu 管理路径|kind 不匹配/);
  assert.equal(await readFile(victimPath, 'utf8'), victim);

  manifest.files.pop();
  manifest.files[0] = { ...manifest.files[0], kind: 'metadata' };
  assert.throws(() => validateManifest(manifest), /非 Gongxu 管理路径|kind 不匹配/);
});

test('arbitrary git source persists opaque metadata and clone errors redact endpoint', async (t) => {
  const parent = await temporaryDirectory('git-source');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const bin = path.join(parent, 'bin');
  const clonedSource = path.join(parent, 'fixture');
  await cp(sourceRoot, clonedSource, { recursive: true, filter: (entry) => !entry.includes(`${path.sep}.git`) && !entry.includes(`${path.sep}node_modules`) });
  await import('node:fs/promises').then(({ mkdir }) => mkdir(bin));
  const git = path.join(bin, 'git');
  await writeFile(git, '#!/bin/sh\nlast=""\nfor arg in "$@"; do last="$arg"; done\ncp -R "$GONGXU_TEST_SOURCE" "$last"\n', { mode: 0o755 });
  await chmod(git, 0o755);
  const oldPath = process.env.PATH;
  process.env.PATH = `${bin}:${oldPath}`;
  process.env.GONGXU_TEST_SOURCE = clonedSource;
  t.after(() => { process.env.PATH = oldPath; delete process.env.GONGXU_TEST_SOURCE; });
  const endpoint = 'https://gitlab.example.com/private/team/repo.git';
  const target = path.join(parent, 'target');
  await installHarness({ source: endpoint, target });
  const manifestRaw = await readFile(path.join(target, '.gongxu/manifest.json'), 'utf8');
  assert.deepEqual(JSON.parse(manifestRaw).source, { type: 'git', input: null, resolved: 'git' });
  assert.equal(manifestRaw.includes('gitlab.example.com'), false);
  assert.equal((await getUpdateConfiguration(target)).requiresExplicitSource, true);

  const githubTarget = path.join(parent, 'github-target');
  await installHarness({ source: 'ExampleOwner/example-repo#main', target: githubTarget });
  const githubManifest = JSON.parse(await readFile(path.join(githubTarget, '.gongxu/manifest.json'), 'utf8'));
  assert.deepEqual(githubManifest.source, {
    type: 'github',
    input: 'ExampleOwner/example-repo#main',
    resolved: 'ExampleOwner/example-repo#main',
  });
  assert.equal((await getUpdateConfiguration(githubTarget)).requiresExplicitSource, false);

  process.env.PATH = '/nonexistent';
  const secretEndpoint = 'https://secret.example.com/private/repo.git';
  await assert.rejects(installHarness({ source: secretEndpoint, target: path.join(parent, 'fail') }), (error) => {
    assert.equal(error.message.includes('secret.example.com'), false);
    assert.equal(error.message.includes('/private/repo'), false);
    return true;
  });
});

test('unsafe URLs are rejected without echoing source', async (t) => {
  const parent = await temporaryDirectory('url');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const userInfoSource = ['https://user', ':placeholder@example.com/repo.git'].join('');
  const querySource = ['https://example.com/repo.git?', ['credential', 'placeholder'].join('=')].join('');
  for (const source of [
    'http://example.com/team/repo.git',
    userInfoSource,
    querySource,
    'https://example.com/repo.git#main',
    'git@example.com:team/repo.git#main',
  ]) {
    await assert.rejects(installHarness({ source, target: path.join(parent, Math.random().toString(16).slice(2)) }), (error) => {
      assert.equal(error.message.includes(source), false);
      assert.equal(error.message.includes('placeholder'), false);
      if (source.startsWith('http://')) assert.match(error.message, /HTTPS|SSH/);
      return true;
    });
  }
});
