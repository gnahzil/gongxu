import { execFileSync } from 'node:child_process';

const output = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
);
const files = output.split('\0').filter(Boolean);

function isForbidden(file) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && !/\.env(?:\.[^/]*)?\.example$/.test(file)) return true;
  return [
    /(^|\/)\.worktrees(?:\/|$)/,
    /(^|\/)\.private-journal(?:\/|$)/,
    /(^|\/)\.(?:claude|idea|serena|vscode)(?:\/|$)/,
    /(^|\/)\.DS_Store$/,
    /\.iml$/,
    /(^|\/)node_modules(?:\/|$)/,
    /(^|\/)coverage(?:\/|$)/,
    /\.log$/,
    /(^|\/)npm-debug\.log/,
    /(^|\/)\.(?:npmrc|pypirc)$/,
    /(^|\/)credentials\.json$/,
    /(^|\/)secrets\.local\.[^/]+$/,
    /\.(?:pem|key|p12|pfx|keystore)$/,
    /(^|\/)\.gongxu-mode$/,
    /(^|\/)\.gongxu\/(?:brainstorm|backups|triage-private|logs)(?:\/|$)/,
    /(^|\/)\.gongxu\/context\.local\.md$/,
    /(^|\/)rules\/e2e-runtime\/[^/]+\.local\.yml$/,
  ].some((pattern) => pattern.test(file));
}

const forbidden = files.filter(isForbidden);
if (forbidden.length > 0) {
  console.error('检测到不得纳入仓库的本机或敏感文件：');
  for (const file of forbidden) console.error(`- ${file}`);
  process.exitCode = 1;
} else {
  console.log(`敏感文件名检查通过（检查 ${files.length} 个候选文件）。`);
}
