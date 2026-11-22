// Claude Code PreToolUse hook (.claude/settings.json): before a Bash command that ships to main — `gh pr merge`, or a
// `git push` that targets main — run the web app's feature checks (`npm run check:web`: unit tests + the Playwright
// smoke test for every feature in WEB_FEATURES.md). If they fail, the command is blocked (exit 2) and the reason goes
// back to Claude. Anything else passes straight through.
import { spawnSync } from 'node:child_process';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => (input += chunk));
process.stdin.on('end', () => {
  let command = '';
  try {
    command = JSON.parse(input || '{}')?.tool_input?.command || '';
  } catch {
    process.exit(0);
  }
  const ships = /\bgh\s+pr\s+merge\b/.test(command) || /\bgit\s+push\b[^\n;&|]*\bmain\b/.test(command);
  if (!ships) process.exit(0);

  const run = spawnSync('npm run check:web', { shell: true, encoding: 'utf8', cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd() });
  if (run.status === 0) process.exit(0);
  const tail = `${run.stdout || ''}\n${run.stderr || ''}`.trim().split('\n').slice(-40).join('\n');
  process.stderr.write(
    `Shipping blocked: the web app's feature checks failed (npm run check:web).\n` +
      `Every feature in WEB_FEATURES.md must keep working. Fix what broke, or — only if the owner has said yes in chat to ` +
      `dropping a feature — remove its line in WEB_FEATURES.md and its smoke test together.\n\n${tail}\n`
  );
  process.exit(2);
});
