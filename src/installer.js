import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PACKAGE_JSON = JSON.parse(await readFile(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));

export const VERSION = PACKAGE_JSON.version;
export const SUPPORTED_AGENTS = ['claude-code', 'codex'];
export const SUPPORTED_PROFILES = ['mysql-strict', 'human-owned-testing'];
export const CORE_SKILLS = [
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
export const SUPPORTED_EXTRAS = [
  'chinese-commit-conventions',
  'production-incident-triage',
  'using-git-worktrees',
  'writing-design-doc',
];

const LEGACY_MANAGED_SKILLS = [
  ...CORE_SKILLS,
  ...SUPPORTED_EXTRAS,
  'chinese-code-review',
  'chinese-documentation',
  'chinese-git-workflow',
  'contract-first-design',
  'executing-plans',
  'mcp-builder',
  'receiving-code-review',
  'requesting-code-review',
  'subagent-driven-development',
  'writing-plans',
  'writing-skills',
];

const PROFILE_FILES = Object.freeze({
  'mysql-strict': ['database-ddl.md'],
  'human-owned-testing': ['manual-e2e-case.md', 'no-agent-tests.md'],
});
const EXCLUDED_NAMES = new Set(['.DS_Store', '.git', '.serena', 'project.local.yml']);
const CONFIG_KEYS = [
  'schemaVersion',
  'enabledProfiles',
  'enabledExtras',
  'artifactRoot',
  'sourceRoots',
  'visual',
  'testing',
  'models',
];

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function toPortablePath(value) {
  return value.split(path.sep).join('/');
}

function targetRelative(targetRoot, destination) {
  const relative = path.relative(targetRoot, destination);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('安装目标越过项目目录。');
  }
  return toPortablePath(relative);
}

function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0 || path.isAbsolute(value)) return false;
  const segments = value.replaceAll('\\', '/').split('/');
  return !segments.some((segment) => segment === '' || segment === '.' || segment === '..');
}

function isInstallerOwnedManifestEntry(file, agents, profiles, skills, allowLegacy = false) {
  const relative = file.path;
  const kind = file.kind;
  if (kind === 'rule') return /^rules\/[^/]+$/.test(relative);
  if (kind === 'rule-mirror') {
    return /^\.agents\/rules\/[^/]+$/.test(relative) ||
      (agents.includes('claude-code') && /^\.claude\/rules\/[^/]+$/.test(relative));
  }
  for (const profile of profiles) {
    if (kind === `rule-profile:${profile}`) {
      return PROFILE_FILES[profile].some((name) => relative === `rules/profiles/${profile}/${name}`);
    }
    if (kind === `rule-profile-mirror:${profile}`) {
      return PROFILE_FILES[profile].some((name) =>
        relative === `.agents/rules/profiles/${profile}/${name}` ||
        (agents.includes('claude-code') && relative === `.claude/rules/profiles/${profile}/${name}`),
      );
    }
  }
  if (kind === 'template') return relative.startsWith('.gongxu/templates/');
  if (kind === 'metadata') return relative === '.gongxu/.gitignore';
  if (kind === 'configuration') return relative === '.gongxu/config.json';
  if (kind === 'agent:claude-code') {
    const names = ['evaluator.md', 'executor.md', 'planner.md'];
    if (allowLegacy) names.push('code-reviewer.md');
    return agents.includes('claude-code') && names.some((name) => relative === `.claude/agents/${name}`);
  }
  if (kind === 'agent:codex') {
    const names = ['evaluator.toml', 'executor.toml', 'planner.toml'];
    if (allowLegacy) names.push('code-reviewer.toml');
    return agents.includes('codex') && names.some((name) => relative === `.codex/agents/${name}`);
  }
  const skillMatch = kind.match(/^skill:([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (!skillMatch || !skills.includes(skillMatch[1])) return false;
  const name = skillMatch[1];
  return relative.startsWith(`.agents/skills/${name}/`) ||
    (agents.includes('claude-code') && relative.startsWith(`.claude/skills/${name}/`));
}

async function pathType(value) {
  try {
    const info = await lstat(value);
    if (info.isDirectory()) return 'directory';
    if (info.isFile()) return 'file';
    if (info.isSymbolicLink()) return 'symlink';
    return 'other';
  } catch (error) {
    if (error.code === 'ENOENT') return 'missing';
    throw error;
  }
}

async function assertSafeAncestors(targetRoot, destination) {
  const relative = targetRelative(targetRoot, destination);
  const segments = relative.split('/').slice(0, -1);
  let current = targetRoot;
  for (const segment of segments) {
    current = path.join(current, segment);
    const type = await pathType(current);
    if (type === 'missing') return;
    if (type === 'symlink') throw new Error(`目标路径包含符号链接目录：${targetRelative(targetRoot, current)}`);
    if (type !== 'directory') throw new Error(`目标路径的父级不是目录：${targetRelative(targetRoot, current)}`);
  }
}

async function ensureSafeParentDirectories(targetRoot, destination) {
  const relative = targetRelative(targetRoot, destination);
  const segments = relative.split('/').slice(0, -1);
  let current = targetRoot;
  for (const segment of segments) {
    current = path.join(current, segment);
    let type = await pathType(current);
    if (type === 'missing') {
      try {
        await mkdir(current);
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
      type = await pathType(current);
    }
    if (type === 'symlink') throw new Error(`目标路径包含符号链接目录：${targetRelative(targetRoot, current)}`);
    if (type !== 'directory') throw new Error(`目标路径的父级不是目录：${targetRelative(targetRoot, current)}`);
  }
}

async function resolveTargetRoot(target, dryRun) {
  const absolute = path.resolve(target);
  const type = await pathType(absolute);
  if (type === 'symlink') throw new Error('目标项目不能是符号链接。');
  if (type !== 'missing' && type !== 'directory') throw new Error('目标项目不是目录。');
  if (type === 'missing') {
    if (dryRun) return absolute;
    await mkdir(absolute, { recursive: true });
  }
  return realpath(absolute);
}

async function collectFiles(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const files = [];
  for (const entry of entries) {
    if (EXCLUDED_NAMES.has(entry.name)) continue;
    const childRelative = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`源目录包含符号链接，拒绝安装：${toPortablePath(childRelative)}`);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(root, childRelative)));
    } else if (entry.isFile()) {
      const source = path.join(root, childRelative);
      const info = await stat(source);
      files.push({ source, relative: childRelative, content: await readFile(source), mode: info.mode & 0o777 });
    }
  }
  return files;
}

function parseSkillName(skillFile, fallback) {
  const text = skillFile.toString('utf8');
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) throw new Error(`Skill 缺少 YAML frontmatter：${fallback}/SKILL.md`);
  const nameMatch = frontmatter[1].match(/^name:\s*["']?([^"'\r\n]+)["']?\s*$/m);
  const descriptionMatch = frontmatter[1].match(/^description:\s*(?:.+|[>|])\s*$/m);
  if (!nameMatch || !descriptionMatch) throw new Error(`Skill 缺少 name 或 description：${fallback}/SKILL.md`);
  const name = nameMatch[1].trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`Skill 名称必须使用小写 kebab-case：${name}`);
  return name;
}

async function loadRegisteredSkills(root, names, kind) {
  const skills = [];
  for (const name of names) {
    const skillRoot = path.join(root, name);
    const skillFile = path.join(skillRoot, 'SKILL.md');
    if ((await pathType(skillRoot)) !== 'directory' || (await pathType(skillFile)) !== 'file') {
      throw new Error(`安装源缺少${kind} Skill：${name}`);
    }
    const declaredName = parseSkillName(await readFile(skillFile), name);
    if (declaredName !== name) throw new Error(`${kind} Skill 目录与 name 不一致：${name}`);
    skills.push({ name, root: skillRoot });
  }
  return skills;
}

function normalizeList(requested, supported, option, defaultValues = []) {
  if (!Array.isArray(requested)) throw new Error(`${option} 格式无效。`);
  const values = requested.length === 0 ? defaultValues : requested;
  const expanded = values.flatMap((value) => {
    if (typeof value !== 'string') throw new Error(`${option} 格式无效。`);
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  });
  if (requested.length > 0 && expanded.length === 0) throw new Error(`${option} 至少需要一个有效值。`);
  for (const value of expanded) {
    if (!supported.includes(value)) throw new Error(`${option} 不支持该值。可选值：${supported.join(', ')}`);
  }
  return supported.filter((value) => expanded.includes(value));
}

function normalizeAgents(requested = []) {
  const values = requested.length === 0 ? ['all'] : requested;
  const expanded = values.flatMap((value) => value.split(',').map((item) => item.trim()).filter(Boolean));
  if (expanded.length === 0) throw new Error('--agent 至少需要一个有效值。');
  for (const agent of expanded) {
    if (agent !== 'all' && !SUPPORTED_AGENTS.includes(agent)) throw new Error(`不支持的 Agent。可选值：${SUPPORTED_AGENTS.join(', ')}, all`);
  }
  return expanded.includes('all') ? [...SUPPORTED_AGENTS] : SUPPORTED_AGENTS.filter((agent) => expanded.includes(agent));
}

export function normalizeProfiles(requested = []) {
  return normalizeList(requested, SUPPORTED_PROFILES, '--profile');
}

export function normalizeExtras(requested = []) {
  return normalizeList(requested, SUPPORTED_EXTRAS, '--extra');
}

function defaultConfiguration(profiles = [], extras = []) {
  return {
    schemaVersion: 1,
    enabledProfiles: normalizeProfiles(profiles),
    enabledExtras: normalizeExtras(extras),
    artifactRoot: 'docs/gongxu',
    sourceRoots: [],
    visual: { provider: 'auto' },
    testing: { targeted: 'auto', fullSuite: 'ask' },
    models: { planner: 'auto', executor: 'auto', evaluator: 'auto' },
  };
}

export function validateConfiguration(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('config 必须是 JSON 对象');
  const keys = Object.keys(parsed);
  const requiredKeys = CONFIG_KEYS.filter((key) => key !== 'enabledExtras');
  if (keys.some((key) => !CONFIG_KEYS.includes(key)) || requiredKeys.some((key) => !(key in parsed))) throw new Error('config 字段无效或缺失');
  const configuration = 'enabledExtras' in parsed ? parsed : { ...parsed, enabledExtras: [] };
  if (configuration.schemaVersion !== 1) throw new Error('config schema 不受支持');
  const normalizedProfiles = normalizeProfiles(configuration.enabledProfiles);
  if (normalizedProfiles.length !== configuration.enabledProfiles.length || normalizedProfiles.some((item, index) => item !== configuration.enabledProfiles[index])) throw new Error('config profile 必须按支持顺序排列且不能重复');
  const normalizedExtras = normalizeExtras(configuration.enabledExtras);
  if (normalizedExtras.length !== configuration.enabledExtras.length || normalizedExtras.some((item, index) => item !== configuration.enabledExtras[index])) throw new Error('config Extra 必须按支持顺序排列且不能重复');
  if (!isSafeRelativePath(configuration.artifactRoot)) throw new Error('config artifactRoot 必须是安全的相对路径');
  if (!Array.isArray(configuration.sourceRoots) || configuration.sourceRoots.some((item) => !isSafeRelativePath(item)) || new Set(configuration.sourceRoots).size !== configuration.sourceRoots.length) throw new Error('config sourceRoots 无效');
  if (JSON.stringify(configuration.visual) !== JSON.stringify({ provider: configuration.visual?.provider }) || typeof configuration.visual.provider !== 'string' || configuration.visual.provider.length === 0) throw new Error('config visual 无效');
  if (JSON.stringify(configuration.testing) !== JSON.stringify({ targeted: configuration.testing?.targeted, fullSuite: configuration.testing?.fullSuite }) || !['auto', 'ask'].includes(configuration.testing.targeted) || configuration.testing.fullSuite !== 'ask') throw new Error('config testing 无效');
  if (JSON.stringify(configuration.models) !== JSON.stringify({ planner: configuration.models?.planner, executor: configuration.models?.executor, evaluator: configuration.models?.evaluator }) || ['planner', 'executor', 'evaluator'].some((role) => typeof configuration.models[role] !== 'string' || configuration.models[role].length === 0)) throw new Error('config models 无效');
  return configuration;
}

export async function readConfiguration(targetRoot) {
  const configPath = path.join(targetRoot, '.gongxu', 'config.json');
  try {
    await assertSafeAncestors(targetRoot, configPath);
    const type = await pathType(configPath);
    if (type === 'missing') return null;
    if (type !== 'file') throw new Error('config 不是普通文件');
    const raw = await readFile(configPath, 'utf8');
    return { parsed: validateConfiguration(JSON.parse(raw)), raw, path: configPath };
  } catch (error) {
    throw new Error(`无法读取现有 Gongxu config：${error.message}`);
  }
}

function runGit(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { env: process.env, shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.resume();
    child.on('error', () => reject(new Error('无法启动 Git。')));
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Git 克隆失败（exit ${code}）。`)));
  });
}

function parseGithubSource(source) {
  const match = source.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:#([A-Za-z0-9_./-]+))?$/);
  if (!match) return null;
  return { owner: match[1], repository: match[2].replace(/\.git$/, ''), ref: match[3] || null };
}

function validateGitSource(source) {
  if (/^http:\/\//i.test(source)) throw new Error('Git URL 必须使用 HTTPS 或 SSH。');
  if (/^https:\/\//i.test(source)) {
    let parsed;
    try {
      parsed = new URL(source);
    } catch {
      throw new Error('Git URL 格式无效。');
    }
    if (parsed.username || parsed.password) throw new Error('Git URL 不得包含用户信息或凭据。');
    if (parsed.search || parsed.hash) throw new Error('Git URL 不得包含查询参数或片段。');
    return;
  }
  if (/^ssh:\/\//i.test(source)) {
    let parsed;
    try {
      parsed = new URL(source);
    } catch {
      throw new Error('Git URL 格式无效。');
    }
    if (parsed.password || parsed.search || parsed.hash) throw new Error('Git URL 不得包含凭据、查询参数或片段。');
    return;
  }
  if (/^[^\s@]+@[^\s:]+:[^\s]+$/.test(source)) {
    if (/[?#]/.test(source)) throw new Error('Git URL 不得包含查询参数或片段。');
    return;
  }
  throw new Error('无法识别安装源。请使用本地路径、owner/repo 或受支持的 Git URL。');
}

async function resolveSource(sourceInput) {
  if (!sourceInput) return { root: PACKAGE_ROOT, source: { type: 'bundled', input: null, resolved: `npm:gongxu@${VERSION}` }, cleanup: async () => {} };
  const localPath = path.resolve(sourceInput);
  if (existsSync(localPath)) {
    const root = await realpath(localPath);
    return { root, source: { type: 'local', input: null, resolved: 'local' }, cleanup: async () => {} };
  }
  const github = parseGithubSource(sourceInput);
  let cloneUrl = sourceInput;
  let source;
  const args = ['clone', '--depth', '1', '--no-tags'];
  if (github) {
    cloneUrl = `https://github.com/${github.owner}/${github.repository}.git`;
    if (github.ref) args.push('--branch', github.ref);
    const canonical = `${github.owner}/${github.repository}${github.ref ? `#${github.ref}` : ''}`;
    source = { type: 'github', input: canonical, resolved: canonical };
  } else {
    validateGitSource(sourceInput);
    source = { type: 'git', input: null, resolved: 'git' };
  }
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'gongxu-'));
  const cloneRoot = path.join(temporaryRoot, 'repository');
  args.push(cloneUrl, cloneRoot);
  try {
    await runGit(args);
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
  return { root: cloneRoot, source, cleanup: () => rm(temporaryRoot, { recursive: true, force: true }) };
}

async function validateSource(sourceRoot, extras) {
  for (const directory of ['agents', 'rules', 'skills', 'templates']) {
    if ((await pathType(path.join(sourceRoot, directory))) !== 'directory') throw new Error(`安装源缺少 ${directory}/。`);
  }
  await loadRegisteredSkills(path.join(sourceRoot, 'skills'), CORE_SKILLS, '核心');
  if (extras.length > 0) {
    const extrasRoot = path.join(sourceRoot, 'extras');
    if ((await pathType(extrasRoot)) !== 'directory') throw new Error('安装源缺少 extras/。');
    await loadRegisteredSkills(extrasRoot, extras, 'Extra');
  }
  for (const profile of SUPPORTED_PROFILES) {
    for (const file of PROFILE_FILES[profile]) {
      if ((await pathType(path.join(sourceRoot, 'rules', 'profiles', profile, file))) !== 'file') throw new Error(`安装源缺少 profile 文件：${profile}/${file}`);
    }
  }
}

export function validateManifest(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('manifest 格式无效');
  if (parsed.schemaVersion === 1) throw new Error('manifest schema 1 已停用；请重新安装 Gongxu');
  if (parsed.schemaVersion !== 2) throw new Error('manifest schema 不受支持');
  if (typeof parsed.gongxuVersion !== 'string' || typeof parsed.installedAt !== 'string') throw new Error('manifest 缺少版本或安装时间');
  if (!parsed.source || !['bundled', 'github', 'git', 'local'].includes(parsed.source.type)) throw new Error('manifest 安装来源无效');
  if (Object.keys(parsed.source).sort().join(',') !== 'input,resolved,type') throw new Error('manifest 安装来源字段无效');
  if (parsed.source.type === 'bundled' && (parsed.source.input !== null || typeof parsed.source.resolved !== 'string')) throw new Error('manifest 内置来源格式无效');
  if (parsed.source.type === 'github' && (typeof parsed.source.input !== 'string' || parsed.source.resolved !== parsed.source.input || !parseGithubSource(parsed.source.input))) throw new Error('manifest GitHub 来源格式无效');
  if (['git', 'local'].includes(parsed.source.type) && (parsed.source.input !== null || parsed.source.resolved !== parsed.source.type)) throw new Error('manifest 不得持久化私有来源');
  const agents = normalizeAgents(parsed.agents);
  if (agents.length !== parsed.agents.length || agents.some((item, index) => item !== parsed.agents[index])) throw new Error('manifest Agent 清单无效');
  const profiles = normalizeProfiles(parsed.profiles);
  if (profiles.length !== parsed.profiles.length || profiles.some((item, index) => item !== parsed.profiles[index])) throw new Error('manifest profile 清单无效');
  const legacyManifest = !Object.hasOwn(parsed, 'extras');
  if (!legacyManifest && !Array.isArray(parsed.extras)) throw new Error('manifest Extra 清单无效');
  const extras = normalizeExtras(legacyManifest ? [] : parsed.extras);
  if (!legacyManifest && (extras.length !== parsed.extras.length || extras.some((item, index) => item !== parsed.extras[index]))) throw new Error('manifest Extra 清单无效');
  if (!Array.isArray(parsed.skills) || parsed.skills.length === 0 || new Set(parsed.skills).size !== parsed.skills.length || !parsed.skills.every((name) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))) throw new Error('manifest Skill 清单无效');
  const allowedSkills = legacyManifest ? LEGACY_MANAGED_SKILLS : [...CORE_SKILLS, ...extras];
  if (parsed.skills.some((name) => !allowedSkills.includes(name)) || CORE_SKILLS.some((name) => !parsed.skills.includes(name))) throw new Error('manifest Skill 清单包含未知项或缺少核心 Skill');
  if (!legacyManifest) {
    const expectedSkills = [...CORE_SKILLS, ...extras].sort();
    if (expectedSkills.length !== parsed.skills.length || expectedSkills.some((name, index) => name !== parsed.skills[index])) throw new Error('manifest Skill 清单与核心及 Extras 不一致');
  }
  if (!Array.isArray(parsed.files) || parsed.files.length === 0 || !Array.isArray(parsed.scaffolds)) throw new Error('manifest 受管理文件清单无效');
  const paths = new Set();
  for (const file of parsed.files) {
    if (!file || !isSafeRelativePath(file.path) || typeof file.kind !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256) || paths.has(file.path)) throw new Error('manifest 包含非法受管理文件条目');
    if (!isInstallerOwnedManifestEntry(file, agents, profiles, parsed.skills, legacyManifest)) throw new Error('manifest 包含非 Gongxu 管理路径或 kind 不匹配');
    paths.add(file.path);
    const match = file.path.match(/(?:^|\/)rules\/profiles\/([^/]+)\//);
    if (match && !profiles.includes(match[1])) throw new Error('manifest 包含未启用 profile 文件');
  }
  for (const required of ['rules/README.md', '.agents/rules/README.md', '.gongxu/config.json']) {
    if (!paths.has(required)) throw new Error(`manifest 缺少入口：${required}`);
  }
  for (const profile of profiles) {
    for (const file of PROFILE_FILES[profile]) {
      for (const prefix of ['rules', '.agents/rules']) {
        if (!paths.has(`${prefix}/profiles/${profile}/${file}`)) throw new Error(`manifest 缺少 profile 文件：${profile}`);
      }
      if (agents.includes('claude-code') && !paths.has(`.claude/rules/profiles/${profile}/${file}`)) throw new Error(`manifest 缺少 Claude profile 文件：${profile}`);
    }
  }
  const kinds = new Set(parsed.files.map((file) => file.kind));
  if (!kinds.has('rule') || !kinds.has('rule-mirror')) throw new Error('manifest 缺少 Rules 安装记录');
  for (const skill of parsed.skills) {
    if (!kinds.has(`skill:${skill}`) || !paths.has(`.agents/skills/${skill}/SKILL.md`)) throw new Error(`manifest 缺少 Skill 安装记录：${skill}`);
    if (agents.includes('claude-code') && !paths.has(`.claude/skills/${skill}/SKILL.md`)) throw new Error(`manifest 缺少 Claude Skill：${skill}`);
  }
  if (agents.includes('claude-code')) {
    if (!kinds.has('agent:claude-code')) throw new Error('manifest 缺少 Claude Agent 安装记录');
    for (const name of ['planner.md', 'executor.md', 'evaluator.md']) if (!paths.has(`.claude/agents/${name}`)) throw new Error(`manifest 缺少 Claude Agent：${name}`);
  }
  if (agents.includes('codex')) {
    if (!kinds.has('agent:codex')) throw new Error('manifest 缺少 Codex Agent 安装记录');
    for (const name of ['planner.toml', 'executor.toml', 'evaluator.toml']) if (!paths.has(`.codex/agents/${name}`)) throw new Error(`manifest 缺少 Codex Agent：${name}`);
  }
  for (const scaffold of parsed.scaffolds) {
    if (!scaffold || !isSafeRelativePath(scaffold.path) || !['create', 'preserve', 'unchanged'].includes(scaffold.status)) throw new Error('manifest scaffold 清单无效');
  }
}

async function readPreviousManifest(targetRoot) {
  const manifestPath = path.join(targetRoot, '.gongxu', 'manifest.json');
  try {
    await assertSafeAncestors(targetRoot, manifestPath);
    const type = await pathType(manifestPath);
    if (type === 'missing') return null;
    if (type !== 'file') throw new Error('manifest 不是普通文件');
    const raw = await readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    validateManifest(parsed);
    return { parsed, raw, path: manifestPath };
  } catch (error) {
    throw new Error(`无法读取现有 Gongxu manifest：${error.message}`);
  }
}

function addOperation(operations, targetRoot, operation) {
  const relative = targetRelative(targetRoot, operation.destination);
  if (operations.has(relative)) throw new Error(`安装计划包含重复目标：${relative}`);
  operations.set(relative, { ...operation, relative });
}

async function addTreeOperations({ operations, sourceRoot, destinationRoot, targetRoot, kind }) {
  for (const file of await collectFiles(sourceRoot)) {
    addOperation(operations, targetRoot, { destination: path.join(destinationRoot, file.relative), content: file.content, mode: file.mode, kind, policy: 'managed' });
  }
}

async function addCoreRules(operations, rulesRoot, destinationRoot, targetRoot, kind) {
  const entries = await readdir(rulesRoot, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || EXCLUDED_NAMES.has(entry.name)) continue;
    const source = path.join(rulesRoot, entry.name);
    const info = await stat(source);
    addOperation(operations, targetRoot, { destination: path.join(destinationRoot, entry.name), content: await readFile(source), mode: info.mode & 0o777, kind, policy: 'managed' });
  }
}

async function addProfileRules(operations, rulesRoot, destinationRoot, targetRoot, profiles, mirror) {
  for (const profile of profiles) {
    await addTreeOperations({ operations, sourceRoot: path.join(rulesRoot, 'profiles', profile), destinationRoot: path.join(destinationRoot, 'profiles', profile), targetRoot, kind: `${mirror ? 'rule-profile-mirror' : 'rule-profile'}:${profile}` });
  }
}

async function buildInstallPlan(sourceRoot, targetRoot, agents, profiles, extras, configuration) {
  const operations = new Map();
  const rulesRoot = path.join(sourceRoot, 'rules');
  const templatesRoot = path.join(sourceRoot, 'templates');
  await addCoreRules(operations, rulesRoot, path.join(targetRoot, 'rules'), targetRoot, 'rule');
  await addCoreRules(operations, rulesRoot, path.join(targetRoot, '.agents', 'rules'), targetRoot, 'rule-mirror');
  await addProfileRules(operations, rulesRoot, path.join(targetRoot, 'rules'), targetRoot, profiles, false);
  await addProfileRules(operations, rulesRoot, path.join(targetRoot, '.agents', 'rules'), targetRoot, profiles, true);
  await addTreeOperations({ operations, sourceRoot: templatesRoot, destinationRoot: path.join(targetRoot, '.gongxu', 'templates'), targetRoot, kind: 'template' });

  const skills = [
    ...(await loadRegisteredSkills(path.join(sourceRoot, 'skills'), CORE_SKILLS, '核心')),
    ...(await loadRegisteredSkills(path.join(sourceRoot, 'extras'), extras, 'Extra')),
  ];
  for (const skill of skills) await addTreeOperations({ operations, sourceRoot: skill.root, destinationRoot: path.join(targetRoot, '.agents', 'skills', skill.name), targetRoot, kind: `skill:${skill.name}` });

  if (agents.includes('claude-code')) {
    await addCoreRules(operations, rulesRoot, path.join(targetRoot, '.claude', 'rules'), targetRoot, 'rule-mirror');
    await addProfileRules(operations, rulesRoot, path.join(targetRoot, '.claude', 'rules'), targetRoot, profiles, true);
    for (const skill of skills) await addTreeOperations({ operations, sourceRoot: skill.root, destinationRoot: path.join(targetRoot, '.claude', 'skills', skill.name), targetRoot, kind: `skill:${skill.name}` });
    const claudeAgents = (await collectFiles(path.join(sourceRoot, 'agents'))).filter((file) => !file.relative.includes(path.sep) && file.relative.endsWith('.md'));
    for (const file of claudeAgents) addOperation(operations, targetRoot, { destination: path.join(targetRoot, '.claude', 'agents', file.relative), content: file.content, mode: file.mode, kind: 'agent:claude-code', policy: 'managed' });
    const template = await readFile(path.join(templatesRoot, 'CLAUDE.md.example'), 'utf8');
    addOperation(operations, targetRoot, { destination: path.join(targetRoot, 'CLAUDE.md'), content: Buffer.from(template.replaceAll('<工作区名>', path.basename(targetRoot))), mode: 0o644, kind: 'scaffold:claude-code', policy: 'scaffold' });
  }
  if (agents.includes('codex')) {
    await addTreeOperations({ operations, sourceRoot: path.join(sourceRoot, 'agents', 'codex'), destinationRoot: path.join(targetRoot, '.codex', 'agents'), targetRoot, kind: 'agent:codex' });
    const template = await readFile(path.join(templatesRoot, 'AGENTS.md.example'), 'utf8');
    addOperation(operations, targetRoot, { destination: path.join(targetRoot, 'AGENTS.md'), content: Buffer.from(template.replaceAll('<工作区名>', path.basename(targetRoot))), mode: 0o644, kind: 'scaffold:codex', policy: 'scaffold' });
  }
  addOperation(operations, targetRoot, { destination: path.join(targetRoot, '.gongxu', '.gitignore'), content: Buffer.from('backups/\nbrainstorm/\ncontext.local.md\ntriage-private/\nlogs/\n'), mode: 0o644, kind: 'metadata', policy: 'managed' });
  addOperation(operations, targetRoot, { destination: path.join(targetRoot, '.gongxu', 'config.json'), content: Buffer.from(`${JSON.stringify(configuration, null, 2)}\n`), mode: 0o644, kind: 'configuration', policy: 'managed' });
  return { operations: [...operations.values()], skills };
}

async function inspectPlan(operations, targetRoot, previousManifest, force) {
  const previousFiles = new Map((previousManifest?.parsed.files || []).map((file) => [file.path, file.sha256]));
  const desiredPaths = new Set(operations.map((operation) => operation.relative));
  const actions = [];
  const conflicts = [];
  for (const operation of operations) {
    await assertSafeAncestors(targetRoot, operation.destination);
    const type = await pathType(operation.destination);
    if (type === 'directory' || type === 'other') { conflicts.push(`${operation.relative}（目标不是普通文件）`); continue; }
    if (type === 'symlink') {
      if (force && operation.policy === 'managed') actions.push({ ...operation, action: 'update' });
      else if (operation.policy === 'scaffold') actions.push({ ...operation, action: 'preserve' });
      else conflicts.push(`${operation.relative}（目标是符号链接）`);
      continue;
    }
    if (type === 'missing') { actions.push({ ...operation, action: 'create' }); continue; }
    const currentHash = sha256(await readFile(operation.destination));
    const desiredHash = sha256(operation.content);
    if (currentHash === desiredHash) { actions.push({ ...operation, action: 'unchanged' }); continue; }
    if (operation.policy === 'scaffold') { actions.push({ ...operation, action: 'preserve' }); continue; }
    const previousHash = previousFiles.get(operation.relative);
    if (force || (previousHash && previousHash === currentHash)) actions.push({ ...operation, action: 'update' });
    else conflicts.push(operation.relative);
  }
  for (const [relative, previousHash] of previousFiles) {
    if (desiredPaths.has(relative)) continue;
    const destination = path.resolve(targetRoot, relative);
    targetRelative(targetRoot, destination);
    await assertSafeAncestors(targetRoot, destination);
    const type = await pathType(destination);
    if (type === 'missing') continue;
    if (type === 'directory' || type === 'other') { conflicts.push(`${relative}（旧受管理路径不是普通文件）`); continue; }
    if (type === 'symlink') {
      if (force) actions.push({ destination, relative, content: null, mode: 0, kind: 'stale', policy: 'managed', action: 'remove' });
      else conflicts.push(`${relative}（旧受管理路径已变为符号链接）`);
      continue;
    }
    if (force || sha256(await readFile(destination)) === previousHash) actions.push({ destination, relative, content: null, mode: 0, kind: 'stale', policy: 'managed', action: 'remove' });
    else conflicts.push(`${relative}（旧受管理文件有本地修改）`);
  }
  if (conflicts.length > 0) {
    const detail = conflicts.slice(0, 20).map((item) => `  - ${item}`).join('\n');
    throw new Error(`检测到 ${conflicts.length} 个文件冲突：\n${detail}\n请先处理冲突，或确认后使用 --force。`);
  }
  return actions;
}

async function writeAtomic(targetRoot, destination, content, mode) {
  await ensureSafeParentDirectories(targetRoot, destination);
  await assertSafeAncestors(targetRoot, destination);
  const temporary = path.join(path.dirname(destination), `.${path.basename(destination)}.gongxu-${process.pid}-${Date.now()}`);
  try {
    await writeFile(temporary, content);
    await chmod(temporary, mode);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function applyActions(actions, targetRoot, manifestContent) {
  const backupRoot = path.join(targetRoot, '.gongxu', 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
  const applied = [];
  try {
    for (const action of actions) {
      if (['unchanged', 'preserve'].includes(action.action)) continue;
      await assertSafeAncestors(targetRoot, action.destination);
      let backup = null;
      if (['update', 'remove'].includes(action.action)) {
        backup = path.join(backupRoot, action.relative);
        await ensureSafeParentDirectories(targetRoot, backup);
        await rename(action.destination, backup);
      }
      applied.push({ action, backup });
      if (action.action !== 'remove') await writeAtomic(targetRoot, action.destination, action.content, action.mode);
    }
    const manifestPath = path.join(targetRoot, '.gongxu', 'manifest.json');
    let backup = null;
    if ((await pathType(manifestPath)) !== 'missing') {
      backup = path.join(backupRoot, '.gongxu', 'manifest.json');
      await ensureSafeParentDirectories(targetRoot, backup);
      await rename(manifestPath, backup);
    }
    applied.push({ action: { destination: manifestPath }, backup });
    await writeAtomic(targetRoot, manifestPath, manifestContent, 0o644);
  } catch (error) {
    for (const item of applied.reverse()) {
      await rm(item.action.destination, { force: true });
      if (item.backup) {
        await ensureSafeParentDirectories(targetRoot, item.action.destination);
        await rename(item.backup, item.action.destination);
      }
    }
    throw new Error(`安装写入失败，已回滚：${error.message}`);
  }
  return existsSync(backupRoot) ? backupRoot : null;
}

function summarizeActions(actions) {
  const summary = { create: 0, update: 0, remove: 0, unchanged: 0, preserve: 0 };
  for (const action of actions) summary[action.action] += 1;
  return summary;
}

export async function installHarness({ source: sourceInput, target = process.cwd(), agents: requestedAgents = [], profiles: requestedProfiles = [], extras: requestedExtras = [], configuration: suppliedConfiguration, dryRun = false, force = false } = {}) {
  const agents = normalizeAgents(requestedAgents);
  const profiles = normalizeProfiles(requestedProfiles);
  const extras = normalizeExtras(requestedExtras);
  const configuration = suppliedConfiguration ? validateConfiguration(suppliedConfiguration) : defaultConfiguration(profiles, extras);
  if (JSON.stringify(configuration.enabledProfiles) !== JSON.stringify(profiles)) throw new Error('config 与安装 profile 不一致。');
  if (JSON.stringify(configuration.enabledExtras) !== JSON.stringify(extras)) throw new Error('config 与安装 Extra 不一致。');
  const resolvedSource = await resolveSource(sourceInput);
  try {
    await validateSource(resolvedSource.root, extras);
    const targetRoot = await resolveTargetRoot(target, dryRun);
    if ((await pathType(targetRoot)) !== 'missing' && (await realpath(targetRoot)) === (await realpath(resolvedSource.root))) throw new Error('安装源与目标目录相同，请指定另一个 --target。');
    const previousManifest = await readPreviousManifest(targetRoot);
    const { operations, skills } = await buildInstallPlan(resolvedSource.root, targetRoot, agents, profiles, extras, configuration);
    const actions = await inspectPlan(operations, targetRoot, previousManifest, force);
    const files = actions.filter((action) => action.policy === 'managed' && action.action !== 'remove').map((action) => ({ path: action.relative, kind: action.kind, sha256: sha256(action.content) })).sort((a, b) => a.path.localeCompare(b.path));
    const scaffolds = actions.filter((action) => action.policy === 'scaffold').map((action) => ({ path: action.relative, status: action.action })).sort((a, b) => a.path.localeCompare(b.path));
    const manifest = { schemaVersion: 2, gongxuVersion: VERSION, installedAt: new Date().toISOString(), source: resolvedSource.source, agents, profiles, extras, skills: skills.map((skill) => skill.name).sort(), files, scaffolds };
    validateManifest(manifest);
    const manifestContent = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    const backupRoot = dryRun ? null : await applyActions(actions, targetRoot, manifestContent);
    return { dryRun, source: resolvedSource.source, target: targetRoot, agents, profiles, extras, skillCount: skills.length, summary: summarizeActions(actions), backupRoot, manifestPath: path.join(targetRoot, '.gongxu', 'manifest.json'), scaffolds };
  } finally {
    await resolvedSource.cleanup();
  }
}

export async function getUpdateConfiguration(target = process.cwd()) {
  const targetRoot = await resolveTargetRoot(target, true);
  const previous = await readPreviousManifest(targetRoot);
  if (!previous) throw new Error('当前项目尚未安装 Gongxu，请先运行 gongxu add。');
  const config = await readConfiguration(targetRoot);
  if (!config) throw new Error('缺少 .gongxu/config.json，请重新安装 Gongxu。');
  const requiresExplicitSource = ['local', 'git'].includes(previous.parsed.source.type);
  const source = previous.parsed.source.type === 'bundled' ? undefined : previous.parsed.source.type === 'github' ? previous.parsed.source.input : null;
  return { source, agents: previous.parsed.agents, profiles: config.parsed.enabledProfiles, extras: config.parsed.enabledExtras, configuration: config.parsed, requiresExplicitSource };
}

export async function setProfile({ target = process.cwd(), profile, enabled, source, force = false } = {}) {
  if (!SUPPORTED_PROFILES.includes(profile)) throw new Error(`不支持的 profile。可选值：${SUPPORTED_PROFILES.join(', ')}`);
  const targetRoot = await resolveTargetRoot(target, true);
  const previous = await readPreviousManifest(targetRoot);
  const config = await readConfiguration(targetRoot);
  if (!previous || !config) throw new Error('当前项目尚未安装 Gongxu，请先运行 gongxu add。');
  const selected = new Set(config.parsed.enabledProfiles);
  if (enabled) selected.add(profile); else selected.delete(profile);
  const enabledProfiles = SUPPORTED_PROFILES.filter((item) => selected.has(item));
  if (JSON.stringify(enabledProfiles) === JSON.stringify(config.parsed.enabledProfiles)) return { changed: false, config: config.parsed, result: null };
  const next = validateConfiguration({ ...config.parsed, enabledProfiles });
  let updateSource = source;
  if (!updateSource && previous.parsed.source.type === 'github') updateSource = previous.parsed.source.input;
  if (!updateSource && ['git', 'local'].includes(previous.parsed.source.type)) {
    throw new Error('该安装源不会持久化；请使用 --source 再次显式提供来源。');
  }
  const result = await installHarness({
    source: updateSource,
    target: targetRoot,
    agents: previous.parsed.agents,
    profiles: enabledProfiles,
    extras: config.parsed.enabledExtras,
    configuration: next,
    force,
  });
  return { changed: true, config: next, result };
}

export async function listProfiles(target = process.cwd()) {
  const targetRoot = await resolveTargetRoot(target, true);
  const config = await readConfiguration(targetRoot);
  if (!config) throw new Error('当前项目尚未安装 Gongxu，请先运行 gongxu add。');
  return SUPPORTED_PROFILES.map((name) => ({ name, enabled: config.parsed.enabledProfiles.includes(name) }));
}

export async function setExtra({ target = process.cwd(), extra, enabled, source, force = false } = {}) {
  if (!SUPPORTED_EXTRAS.includes(extra)) throw new Error(`不支持的 Extra。可选值：${SUPPORTED_EXTRAS.join(', ')}`);
  const targetRoot = await resolveTargetRoot(target, true);
  const previous = await readPreviousManifest(targetRoot);
  const config = await readConfiguration(targetRoot);
  if (!previous || !config) throw new Error('当前项目尚未安装 Gongxu，请先运行 gongxu add。');
  const selected = new Set(config.parsed.enabledExtras);
  if (enabled) selected.add(extra); else selected.delete(extra);
  const enabledExtras = SUPPORTED_EXTRAS.filter((item) => selected.has(item));
  if (JSON.stringify(enabledExtras) === JSON.stringify(config.parsed.enabledExtras)) return { changed: false, config: config.parsed, result: null };
  const next = validateConfiguration({ ...config.parsed, enabledExtras });
  let updateSource = source;
  if (!updateSource && previous.parsed.source.type === 'github') updateSource = previous.parsed.source.input;
  if (!updateSource && ['git', 'local'].includes(previous.parsed.source.type)) {
    throw new Error('该安装源不会持久化；请使用 --source 再次显式提供来源。');
  }
  const result = await installHarness({
    source: updateSource,
    target: targetRoot,
    agents: previous.parsed.agents,
    profiles: config.parsed.enabledProfiles,
    extras: enabledExtras,
    configuration: next,
    force,
  });
  return { changed: true, config: next, result };
}

export async function listExtras(target = process.cwd()) {
  const targetRoot = await resolveTargetRoot(target, true);
  const config = await readConfiguration(targetRoot);
  if (!config) throw new Error('当前项目尚未安装 Gongxu，请先运行 gongxu add。');
  return SUPPORTED_EXTRAS.map((name) => ({ name, enabled: config.parsed.enabledExtras.includes(name) }));
}

export async function doctorHarness({ target = process.cwd() } = {}) {
  const targetRoot = await resolveTargetRoot(target, true);
  const previous = await readPreviousManifest(targetRoot);
  if (!previous) return { target: targetRoot, errors: ['缺少 .gongxu/manifest.json，当前项目尚未完成 Gongxu 安装。'], warnings: [], checked: 0 };
  const errors = [];
  const warnings = [];
  let checked = 0;
  let config;
  try { config = await readConfiguration(targetRoot); } catch (error) { errors.push(error.message); }
  if (!config) errors.push('缺少 .gongxu/config.json。');
  else {
    const manifestConfig = previous.parsed.files.find((file) => file.path === '.gongxu/config.json');
    if (manifestConfig && sha256(Buffer.from(config.raw)) !== manifestConfig.sha256) warnings.push('configuration pending update：config 与 manifest 尚未同步。');
    if (!Object.hasOwn(JSON.parse(config.raw), 'enabledExtras')) warnings.push('旧版 config 缺少 enabledExtras，等待 update 补齐。');
    if (!Object.hasOwn(previous.parsed, 'extras')) warnings.push('旧版 manifest 缺少 Extras 清单，等待 update 补齐。');
    if (JSON.stringify(config.parsed.enabledProfiles) !== JSON.stringify(previous.parsed.profiles)) warnings.push('profile 配置待 update：配置与 manifest 尚未同步。');
    if (JSON.stringify(config.parsed.enabledExtras) !== JSON.stringify(previous.parsed.extras || [])) warnings.push('Extra 配置待 update：配置与 manifest 尚未同步。');
  }
  for (const file of previous.parsed.files) {
    if (file.path === '.gongxu/config.json' && config) continue;
    const destination = path.resolve(targetRoot, file.path);
    try { targetRelative(targetRoot, destination); await assertSafeAncestors(targetRoot, destination); } catch { errors.push(`Manifest 包含非法路径：${file.path}`); continue; }
    const type = await pathType(destination);
    if (type === 'missing') { errors.push(`缺少受管理文件：${file.path}`); continue; }
    if (type !== 'file') { errors.push(`受管理路径不是普通文件：${file.path}`); continue; }
    checked += 1;
    if (sha256(await readFile(destination)) !== file.sha256) errors.push(`受管理文件已被修改：${file.path}`);
  }
  if (config) {
    for (const profile of SUPPORTED_PROFILES.filter((item) => !config.parsed.enabledProfiles.includes(item))) {
      for (const prefix of ['rules', '.agents/rules', '.claude/rules']) {
        for (const file of PROFILE_FILES[profile]) {
          const relative = `${prefix}/profiles/${profile}/${file}`;
          if ((await pathType(path.join(targetRoot, relative))) !== 'missing') warnings.push(`已禁用 profile 仍有文件，等待 update：${relative}`);
        }
      }
    }
    for (const extra of SUPPORTED_EXTRAS.filter((item) => !config.parsed.enabledExtras.includes(item))) {
      for (const prefix of ['.agents/skills', '.claude/skills']) {
        const relative = `${prefix}/${extra}`;
        if ((await pathType(path.join(targetRoot, relative))) !== 'missing') warnings.push(`已禁用 Extra 仍有文件，等待 update：${relative}`);
      }
    }
  }
  for (const scaffold of previous.parsed.scaffolds) if ((await pathType(path.join(targetRoot, scaffold.path))) === 'missing') warnings.push(`项目接入文件不存在：${scaffold.path}`);
  return { target: targetRoot, errors, warnings: [...new Set(warnings)], checked };
}
