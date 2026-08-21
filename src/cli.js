import {
  doctorHarness,
  getUpdateConfiguration,
  installHarness,
  listExtras,
  listProfiles,
  setExtra,
  setProfile,
  SUPPORTED_AGENTS,
  SUPPORTED_EXTRAS,
  SUPPORTED_PROFILES,
  VERSION,
} from './installer.js';

const HELP = `Gongxu ${VERSION}

用法：
  gongxu add [source] [--profile <name>] [--extra <name>] [options]
  gongxu update [source] [options]
  gongxu profile list [--target <path>]
  gongxu profile enable <name> [--source <source>] [--target <path>]
  gongxu profile disable <name> [--source <source>] [--target <path>]
  gongxu extra list [--target <path>]
  gongxu extra enable <name> [--source <source>] [--target <path>]
  gongxu extra disable <name> [--source <source>] [--target <path>]
  gongxu doctor [--target <path>]
  gongxu --version

命令：
  add       安装核心 Harness；可显式启用可选 Profile 和 Extra
  update    按 config 安装核心与已启用的 Profile 和 Extra
  profile   查看 profile，或原子启用/禁用并同步受管理规则
  extra     查看 Extra，或原子启用/禁用并同步可选 Skill
  doctor    检查 Skills、Rules、Agents、配置和安装清单

选项：
  -a, --agent <name>    目标 Agent，可重复：${SUPPORTED_AGENTS.join(', ')}, all
  -p, --profile <name>  add 时启用 profile，可重复：${SUPPORTED_PROFILES.join(', ')}
  -e, --extra <name>    add 时启用 Extra，可重复：${SUPPORTED_EXTRAS.join(', ')}
  -t, --target <path>   目标项目，默认当前目录
      --source <source> profile/Extra 修改私有或本地来源时重新提供安装源
      --dry-run         只显示变更数量，不写文件
      --force           覆盖冲突文件；原文件保存到 .gongxu/backups/
  -h, --help            显示帮助
  -v, --version         显示版本
`;

function takeValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) throw new Error(`${option} 缺少参数。`);
  return value;
}

function parseOptions(args, allowed) {
  const options = { agents: [], profiles: [], extras: [], target: process.cwd(), source: null, dryRun: false, force: false, help: false };
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') { positional.push(...args.slice(index + 1)); break; }
    const valueOption = (shortName, longName, key) => {
      if (argument === shortName || argument === longName) {
        if (!allowed.has(key)) throw new Error(`${longName} 不适用于此命令。`);
        options[key].push(takeValue(args, index, argument));
        index += 1;
        return true;
      }
      if (argument.startsWith(`${longName}=`)) {
        if (!allowed.has(key)) throw new Error(`${longName} 不适用于此命令。`);
        options[key].push(argument.slice(longName.length + 1));
        return true;
      }
      return false;
    };
    if (valueOption('-a', '--agent', 'agents') || valueOption('-p', '--profile', 'profiles') || valueOption('-e', '--extra', 'extras')) continue;
    if (argument === '-t' || argument === '--target') {
      if (!allowed.has('target')) throw new Error('--target 不适用于此命令。');
      options.target = takeValue(args, index, argument); index += 1; continue;
    }
    if (argument.startsWith('--target=')) {
      if (!allowed.has('target')) throw new Error('--target 不适用于此命令。');
      const target = argument.slice('--target='.length);
      if (!target) throw new Error('--target 需要一个非空值。');
      options.target = target; continue;
    }
    if (argument === '--source') {
      if (!allowed.has('source')) throw new Error('--source 不适用于此命令。');
      options.source = takeValue(args, index, argument); index += 1; continue;
    }
    if (argument.startsWith('--source=')) {
      if (!allowed.has('source')) throw new Error('--source 不适用于此命令。');
      const source = argument.slice('--source='.length);
      if (!source) throw new Error('--source 需要一个非空值。');
      options.source = source; continue;
    }
    if (argument === '--dry-run' || argument === '--force') {
      const key = argument === '--dry-run' ? 'dryRun' : 'force';
      if (!allowed.has(key)) throw new Error(`${argument} 不适用于此命令。`);
      options[key] = true; continue;
    }
    if (argument === '-h' || argument === '--help') { options.help = true; continue; }
    if (argument.startsWith('-')) throw new Error(`未知选项：${argument}`);
    positional.push(argument);
  }
  return { options, positional };
}

function printInstallResult(result, action) {
  const prefix = result.dryRun ? '预览' : action === 'update' ? '更新完成' : '安装完成';
  console.log(`${prefix}：${result.target}`);
  console.log(`来源：${result.source.resolved}`);
  console.log(`Agent：${result.agents.join(', ')}`);
  console.log(`Profiles：${result.profiles.length ? result.profiles.join(', ') : '无'}`);
  console.log(`Extras：${result.extras.length ? result.extras.join(', ') : '无（仅核心 Skill）'}`);
  console.log(`Skills：${result.skillCount}`);
  console.log(`文件：新增 ${result.summary.create}，更新 ${result.summary.update}，删除 ${result.summary.remove}，未变化 ${result.summary.unchanged}，保留 ${result.summary.preserve}`);
  for (const scaffold of result.scaffolds) if (scaffold.status === 'preserve') console.log(`保留已有项目文件：${scaffold.path}`);
  if (result.backupRoot) console.log(`备份：${result.backupRoot}`);
  if (!result.dryRun) {
    console.log(`Manifest：${result.manifestPath}`);
    console.log('下一步：运行 `npx gongxu@latest doctor`。');
  }
}

async function runInstall(command, args) {
  const allowed = command === 'add'
    ? new Set(['agents', 'profiles', 'extras', 'target', 'dryRun', 'force'])
    : new Set(['agents', 'target', 'dryRun', 'force']);
  const { options, positional } = parseOptions(args, allowed);
  if (options.help) { console.log(HELP); return; }
  if (positional.length > 1) throw new Error('只允许提供一个安装源。');
  let source = positional[0];
  let configuration;
  if (command === 'update') {
    const previous = await getUpdateConfiguration(options.target);
    if (!source && previous.requiresExplicitSource) throw new Error('该安装源不会持久化；请为 update 再次显式提供来源。');
    if (!source) source = previous.source;
    if (options.agents.length === 0) options.agents = previous.agents;
    options.profiles = previous.profiles;
    options.extras = previous.extras;
    configuration = previous.configuration;
  }
  const result = await installHarness({ source, target: options.target, agents: options.agents, profiles: options.profiles, extras: options.extras, configuration, dryRun: options.dryRun, force: options.force });
  printInstallResult(result, command);
}

async function runDoctor(args) {
  const { options, positional } = parseOptions(args, new Set(['target']));
  if (options.help) { console.log(HELP); return; }
  if (positional.length) throw new Error('doctor 不接受位置参数。');
  const result = await doctorHarness({ target: options.target });
  console.log(`检查目录：${result.target}`);
  console.log(`已核对受管理文件：${result.checked}`);
  for (const warning of result.warnings) console.log(`警告：${warning}`);
  for (const error of result.errors) console.error(`错误：${error}`);
  if (result.errors.length) process.exitCode = 1;
  else console.log('Gongxu 安装完整。');
}

async function runToggleCommand(kind, args) {
  const [action, ...rest] = args;
  if (['-h', '--help'].includes(action)) { console.log(HELP); return; }
  if (!['list', 'enable', 'disable'].includes(action)) throw new Error(`${kind} 子命令必须是 list、enable 或 disable。`);
  const allowed = action === 'list' ? new Set(['target']) : new Set(['target', 'source', 'force']);
  const { options, positional } = parseOptions(rest, allowed);
  if (options.help) { console.log(HELP); return; }
  if (action === 'list') {
    if (positional.length) throw new Error(`${kind} list 不接受名称。`);
    const items = kind === 'profile' ? await listProfiles(options.target) : await listExtras(options.target);
    for (const item of items) console.log(`${item.enabled ? 'enabled' : 'disabled'} ${item.name}`);
    return;
  }
  if (positional.length !== 1) throw new Error(`${kind} ${action} 需要且只接受一个名称。`);
  const name = positional[0];
  const result = kind === 'profile'
    ? await setProfile({ target: options.target, profile: name, enabled: action === 'enable', source: options.source, force: options.force })
    : await setExtra({ target: options.target, extra: name, enabled: action === 'enable', source: options.source, force: options.force });
  if (!result.changed) {
    console.log(`配置未变化：${name}`);
    return;
  }
  console.log(`${kind === 'profile' ? 'Profile' : 'Extra'} 已${action === 'enable' ? '启用' : '禁用'}：${name}`);
  printInstallResult(result.result, 'update');
}

export async function main(args) {
  if (args.length === 0 || ['-h', '--help'].includes(args[0])) { console.log(HELP); return; }
  if (['-v', '--version', 'version'].includes(args[0])) { console.log(VERSION); return; }
  const [command, ...commandArgs] = args;
  if (command === 'add' || command === 'update') return runInstall(command, commandArgs);
  if (command === 'doctor') return runDoctor(commandArgs);
  if (command === 'profile' || command === 'extra') return runToggleCommand(command, commandArgs);
  throw new Error(`未知命令：${command}\n\n${HELP}`);
}
