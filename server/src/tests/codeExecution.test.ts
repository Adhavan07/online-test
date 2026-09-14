import { describe, it, expect } from 'vitest';
import { CodeExecutionService } from '../services/CodeExecutionService.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('PHASE 10: Code Execution Sandbox & Worker Isolation Suite', () => {
  const sandboxDir = path.join(os.tmpdir(), 'techscreen_sandbox');

  it('1. should successfully execute valid JavaScript algorithm against test cases', async () => {
    const code = `
      function solution(input) {
        return input.slice().reverse();
      }
    `;

    const testCases = JSON.stringify([
      { input: JSON.stringify([1, 2, 3]), expectedOutput: JSON.stringify([3, 2, 1]) },
      { input: JSON.stringify(['a', 'b', 'c']), expectedOutput: JSON.stringify(['c', 'b', 'a']) }
    ]);

    const result = await CodeExecutionService.executeCode(code, testCases, 'javascript');

    expect(result.passCount).toBe(2);
    expect(result.totalCases).toBe(2);
    expect(result.percentage).toBe(100);
    expect(result.timedOut).toBe(false);
    expect(result.testResults[0].passed).toBe(true);
    expect(result.testResults[1].passed).toBe(true);
  });

  it('2. should successfully execute valid TypeScript algorithm with types using tsx', async () => {
    const code = `
      function solution(nums: number[]): number {
        return nums.reduce((acc: number, curr: number) => acc + curr, 0);
      }
    `;

    const testCases = JSON.stringify([
      { input: JSON.stringify([10, 20, 30]), expectedOutput: '60' },
      { input: JSON.stringify([1, 2, 3, 4, 5]), expectedOutput: '15' }
    ]);

    const result = await CodeExecutionService.executeCode(code, testCases, 'typescript');

    expect(result.passCount).toBe(2);
    expect(result.totalCases).toBe(2);
    expect(result.percentage).toBe(100);
    expect(result.timedOut).toBe(false);
  });

  it('3. should successfully execute valid Python algorithm against test cases', async () => {
    const code = `
def solution(nums):
    return sum(nums)
`;

    const testCases = JSON.stringify([
      { input: JSON.stringify([10, 20, 30]), expectedOutput: '60' },
      { input: JSON.stringify([-5, 5, 0]), expectedOutput: '0' }
    ]);

    const result = await CodeExecutionService.executeCode(code, testCases, 'python');

    expect(result.passCount).toBe(2);
    expect(result.totalCases).toBe(2);
    expect(result.percentage).toBe(100);
    expect(result.timedOut).toBe(false);
  });

  it('4. should block unauthorized Node module imports (fs, child_process, net)', async () => {
    const maliciousCases = [
      "const fs = require('fs'); function solution() { return fs.readdirSync('.'); }",
      "const cp = require('child_process'); function solution() { return cp.execSync('ls'); }",
      "import net from 'net'; function solution() { return true; }",
      "const os = require('os'); function solution() { return os.hostname(); }",
    ];

    const testCases = JSON.stringify([{ input: '1', expectedOutput: '1' }]);

    for (const badCode of maliciousCases) {
      const res = await CodeExecutionService.executeCode(badCode, testCases, 'javascript');
      expect(res.passCount).toBe(0);
      expect(res.testResults[0].passed).toBe(false);
      expect(res.testResults[0].actual).toMatch(/Security Violation: Disallowed module/i);
    }
  });

  it('5. should block process environment access and exit/kill controls', async () => {
    const badCode1 = `
      function solution(input) {
        return process.env.DATABASE_URL || input;
      }
    `;
    const badCode2 = `
      function solution(input) {
        process.exit(1);
      }
    `;

    const testCases = JSON.stringify([{ input: 'test', expectedOutput: 'test' }]);

    const res1 = await CodeExecutionService.executeCode(badCode1, testCases, 'javascript');
    expect(res1.testResults[0].actual).toMatch(/Security Violation: Access to 'process'/i);

    const res2 = await CodeExecutionService.executeCode(badCode2, testCases, 'javascript');
    expect(res2.testResults[0].actual).toMatch(/Security Violation: Access to 'process'/i);
  });

  it('6. should block dynamic code generation (eval, Function) and prototype pollution', async () => {
    const badCode1 = `
      function solution(input) {
        return eval('2 + 2');
      }
    `;
    const badCode2 = `
      function solution(input) {
        const fn = new Function('return 42');
        return fn();
      }
    `;
    const badCode3 = `
      function solution(input) {
        Object.__proto__.polluted = true;
        return input;
      }
    `;

    const testCases = JSON.stringify([{ input: '1', expectedOutput: '1' }]);

    for (const code of [badCode1, badCode2, badCode3]) {
      const res = await CodeExecutionService.executeCode(code, testCases, 'javascript');
      expect(res.passCount).toBe(0);
      expect(res.testResults[0].actual).toMatch(/Security Violation/i);
    }
  });

  it('7. should block unauthorized Python modules and system builtins', async () => {
    const maliciousPython = [
      "import os\ndef solution(x):\n    return os.listdir('.')",
      "import subprocess\ndef solution(x):\n    return subprocess.run(['ls'])",
      "def solution(x):\n    f = open('/etc/passwd')\n    return f.read()",
      "def solution(x):\n    return __import__('os').system('ls')",
    ];

    const testCases = JSON.stringify([{ input: '1', expectedOutput: '1' }]);

    for (const pyCode of maliciousPython) {
      const res = await CodeExecutionService.executeCode(pyCode, testCases, 'python');
      expect(res.passCount).toBe(0);
      expect(res.testResults[0].actual).toMatch(/Security Violation/i);
    }
  });

  it('8. should terminate infinite loops and timeout after 3.5s with SIGKILL', async () => {
    const infiniteLoopCode = `
      function solution(input) {
        while (true) {
          // Stalling indefinitely
        }
        return input;
      }
    `;

    const testCases = JSON.stringify([
      { input: '1', expectedOutput: '1' }
    ]);

    const startTime = Date.now();
    const result = await CodeExecutionService.executeCode(infiniteLoopCode, testCases, 'javascript');
    const elapsed = Date.now() - startTime;

    expect(result.timedOut).toBe(true);
    expect(result.passCount).toBe(0);
    expect(result.testResults[0].passed).toBe(false);
    expect(result.testResults[0].actual).toMatch(/Execution timed out \(3500ms hard limit exceeded\)/i);
    // Should take approximately ~3.5s to ~4.5s
    expect(elapsed).toBeGreaterThanOrEqual(3400);
    expect(elapsed).toBeLessThanOrEqual(5500);
  });

  it('9. should safely clean up sandbox script files upon completion or error', async () => {
    const initialFiles = fs.existsSync(sandboxDir) ? fs.readdirSync(sandboxDir) : [];

    const code = `
      function solution(input) {
        return input * 2;
      }
    `;
    const testCases = JSON.stringify([
      { input: '21', expectedOutput: '42' }
    ]);

    await CodeExecutionService.executeCode(code, testCases, 'javascript');

    const afterFiles = fs.readdirSync(sandboxDir);
    // Files created for this execution should have been removed
    expect(afterFiles.length).toBeLessThanOrEqual(initialFiles.length);
  });
});
