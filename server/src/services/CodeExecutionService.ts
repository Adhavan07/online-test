import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface TestCase {
  input: string;
  expectedOutput: string;
  description?: string;
  isHidden?: boolean;
}

export interface TestCaseResult {
  testCaseIndex: number;
  description: string;
  passed: boolean;
  actual: string;
  expected: string;
  isHidden: boolean;
  executionTimeMs: number;
}

export interface ExecutionSummary {
  language: 'javascript' | 'typescript' | 'python';
  passCount: number;
  totalCases: number;
  percentage: number;
  testResults: TestCaseResult[];
  timedOut: boolean;
  overallExecutionTimeMs: number;
}

export class CodeExecutionService {
  private static readonly TIMEOUT_MS = 3500;
  private static readonly MAX_OUTPUT_BYTES = 256 * 1024; // 256KB buffer limit
  private static readonly SANDBOX_DIR = path.join(os.tmpdir(), 'techscreen_sandbox');

  static {
    if (!fs.existsSync(CodeExecutionService.SANDBOX_DIR)) {
      try {
        fs.mkdirSync(CodeExecutionService.SANDBOX_DIR, { recursive: true });
      } catch {}
    }
  }

  /**
   * Static Code Security Analysis: Reject unauthorized modules, process escapes, and prototype pollution
   */
  public static validateCodeSecurity(
    code: string,
    language: 'javascript' | 'typescript' | 'python'
  ): { safe: boolean; reason?: string } {
    if (typeof code !== 'string') {
      return { safe: false, reason: 'Code must be a string.' };
    }

    if (code.length > 50000) {
      return { safe: false, reason: 'Code length exceeds maximum allowed limit (50,000 characters).' };
    }

    if (language === 'javascript' || language === 'typescript') {
      // 1. Prohibited Node.js system modules
      const forbiddenJsModules = [
        'child_process', 'fs', 'fsevents', 'net', 'http', 'https', 'tls',
        'dgram', 'dns', 'os', 'v8', 'vm', 'worker_threads', 'cluster', 'module'
      ];
      for (const mod of forbiddenJsModules) {
        const requirePattern = new RegExp(`\\brequire\\s*\\(\\s*['"\`]${mod}['"\`]`, 'i');
        const importPattern = new RegExp(`\\bimport\\s+.*['"\`]${mod}['"\`]`, 'i');
        if (requirePattern.test(code) || importPattern.test(code)) {
          return {
            safe: false,
            reason: `Disallowed module import: '${mod}' is prohibited for security reasons.`
          };
        }
      }

      // 2. Dynamic import
      if (/\bimport\s*\(/i.test(code)) {
        return { safe: false, reason: "Dynamic 'import()' is prohibited." };
      }

      // 3. Process controls and environment variables
      if (/\bprocess\s*\.\s*(env|exit|kill|mainModule|binding|chdir|abort|reallyExit)\b/i.test(code)) {
        return { safe: false, reason: "Access to 'process' system controls or environment variables is prohibited." };
      }
      if (/\bglobal(This)?\s*\.\s*process\b/i.test(code)) {
        return { safe: false, reason: "Global process access is prohibited." };
      }

      // 4. Dynamic evaluation and prototype manipulation
      if (/\b(eval\s*\(|Function\s*\(|__proto__)/i.test(code)) {
        return { safe: false, reason: "Dynamic code generation ('eval', 'Function') and '__proto__' access are prohibited." };
      }
    }

    if (language === 'python') {
      // 1. Prohibited Python system modules
      const forbiddenPyModules = [
        'os', 'sys', 'subprocess', 'shutil', 'socket', 'urllib', 'requests',
        'http', 'pty', 'commands', 'platform', 'ctypes', 'multiprocessing'
      ];
      for (const mod of forbiddenPyModules) {
        const importPattern = new RegExp(`\\b(import\\s+${mod}\\b|from\\s+${mod}\\b)`, 'i');
        if (importPattern.test(code)) {
          return {
            safe: false,
            reason: `Disallowed module import: '${mod}' is prohibited for security reasons.`
          };
        }
      }

      // 2. Dangerous Python builtins and introspection
      if (/\b(__import__|eval\s*\(|exec\s*\(|open\s*\(|compile\s*\()/i.test(code)) {
        return { safe: false, reason: "System built-ins ('open', 'eval', 'exec', '__import__') are prohibited." };
      }
      if (/\b(__class__|__subclasses__|__globals__|__code__|__builtins__)\b/i.test(code)) {
        return { safe: false, reason: "Introspection attribute traversal is prohibited." };
      }
    }

    return { safe: true };
  }

  /**
   * Execute candidate code in an isolated sub-process with strict timeout and security controls
   */
  public static async executeCode(
    code: string,
    testCasesJson?: string | null,
    language: 'javascript' | 'typescript' | 'python' = 'javascript',
    maskHiddenDetails: boolean = false
  ): Promise<ExecutionSummary> {
    if (!testCasesJson) {
      return {
        language,
        passCount: 0,
        totalCases: 0,
        percentage: 100,
        testResults: [],
        timedOut: false,
        overallExecutionTimeMs: 0,
      };
    }

    let testCases: TestCase[] = [];
    try {
      testCases = JSON.parse(testCasesJson);
    } catch {
      return {
        language,
        passCount: 0,
        totalCases: 0,
        percentage: 0,
        testResults: [],
        timedOut: false,
        overallExecutionTimeMs: 0,
      };
    }

    if (!Array.isArray(testCases) || testCases.length === 0) {
      return {
        language,
        passCount: 0,
        totalCases: 0,
        percentage: 100,
        testResults: [],
        timedOut: false,
        overallExecutionTimeMs: 0,
      };
    }

    // 1. Static Security Check
    const securityCheck = this.validateCodeSecurity(code, language);
    if (!securityCheck.safe) {
      const securityError = `Security Violation: ${securityCheck.reason}`;
      const testResults: TestCaseResult[] = testCases.map((tc, idx) => ({
        testCaseIndex: idx + 1,
        description: tc.description || `Test Case #${idx + 1}`,
        passed: false,
        actual: securityError,
        expected: Boolean(tc.isHidden) && maskHiddenDetails ? '[Protected Output]' : tc.expectedOutput,
        isHidden: Boolean(tc.isHidden),
        executionTimeMs: 0,
      }));

      return {
        language,
        passCount: 0,
        totalCases: testCases.length,
        percentage: 0,
        testResults,
        timedOut: false,
        overallExecutionTimeMs: 0,
      };
    }

    const startTime = Date.now();
    let passCount = 0;
    let anyTimedOut = false;
    const testResults: TestCaseResult[] = [];

    // Periodic sweep of stale sandbox files (> 5 minutes old)
    this.cleanupStaleSandboxFiles();

    for (let idx = 0; idx < testCases.length; idx++) {
      const tc = testCases[idx];
      const caseResult = await this.runSingleTestCase(code, tc, language);
      if (caseResult.timedOut) anyTimedOut = true;

      const passed = caseResult.passed;
      if (passed) passCount++;

      const isHidden = Boolean(tc.isHidden);

      testResults.push({
        testCaseIndex: idx + 1,
        description: tc.description || `Test Case #${idx + 1}`,
        passed,
        actual: isHidden && maskHiddenDetails ? (passed ? 'Passed (Hidden Case)' : 'Failed (Hidden Case)') : caseResult.actualOutput,
        expected: isHidden && maskHiddenDetails ? '[Protected Output]' : tc.expectedOutput,
        isHidden,
        executionTimeMs: caseResult.durationMs,
      });
    }

    const percentage = testCases.length > 0 ? Math.round((passCount / testCases.length) * 100) : 100;

    return {
      language,
      passCount,
      totalCases: testCases.length,
      percentage,
      testResults,
      timedOut: anyTimedOut,
      overallExecutionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Run a single test case in an isolated child process
   */
  private static async runSingleTestCase(
    code: string,
    testCase: TestCase,
    language: 'javascript' | 'typescript' | 'python'
  ): Promise<{ passed: boolean; actualOutput: string; durationMs: number; timedOut: boolean }> {
    const caseStartTime = Date.now();
    const sandboxId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (language === 'python') {
      return this.runPythonSandbox(code, testCase, sandboxId, caseStartTime);
    }

    if (language === 'typescript') {
      return this.runTypeScriptSandbox(code, testCase, sandboxId, caseStartTime);
    }

    // Default: JavaScript / Node.js
    return this.runJavaScriptSandbox(code, testCase, sandboxId, caseStartTime);
  }

  /**
   * JavaScript Sandboxed Execution
   */
  private static runJavaScriptSandbox(
    code: string,
    testCase: TestCase,
    sandboxId: string,
    startTime: number
  ): Promise<{ passed: boolean; actualOutput: string; durationMs: number; timedOut: boolean }> {
    return new Promise((resolve) => {
      const scriptPath = path.join(this.SANDBOX_DIR, `${sandboxId}.js`);

      const wrappedScript = `
'use strict';
const inputRaw = ${JSON.stringify(testCase.input)};
let parsedInput = inputRaw;
try {
  parsedInput = JSON.parse(inputRaw);
} catch (e) {
  parsedInput = inputRaw;
}

try {
  ${code}

  if (typeof solution !== 'function') {
    process.stderr.write("ReferenceError: 'solution' function is not defined.");
    process.exit(1);
  }

  const result = solution(parsedInput);
  if (typeof result === 'object' && result !== null) {
    process.stdout.write(JSON.stringify(result));
  } else {
    process.stdout.write(String(result));
  }
} catch (err) {
  process.stderr.write(err.name + ': ' + err.message);
  process.exit(1);
}
`;

      fs.writeFileSync(scriptPath, wrappedScript, 'utf-8');

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(
        process.execPath,
        ['--max-old-space-size=64', scriptPath],
        {
          cwd: this.SANDBOX_DIR,
          env: { PATH: process.env.PATH, NODE_ENV: 'production' },
          timeout: this.TIMEOUT_MS,
        }
      );

      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGKILL');
        } catch {}
      }, this.TIMEOUT_MS);

      child.stdout.on('data', (data) => {
        if (stdout.length < this.MAX_OUTPUT_BYTES) {
          stdout += data.toString();
          if (stdout.length >= this.MAX_OUTPUT_BYTES) {
            stdout = stdout.substring(0, this.MAX_OUTPUT_BYTES) + '\n[Output truncated: maximum buffer size exceeded]';
            try { child.kill('SIGKILL'); } catch {}
          }
        }
      });

      child.stderr.on('data', (data) => {
        if (stderr.length < this.MAX_OUTPUT_BYTES) {
          stderr += data.toString();
          if (stderr.length >= this.MAX_OUTPUT_BYTES) {
            stderr = stderr.substring(0, this.MAX_OUTPUT_BYTES) + '\n[Error output truncated]';
            try { child.kill('SIGKILL'); } catch {}
          }
        }
      });

      const cleanup = () => {
        try {
          if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        } catch {}
      };

      child.on('close', () => {
        clearTimeout(timeoutTimer);
        cleanup();

        const durationMs = Date.now() - startTime;

        if (timedOut) {
          return resolve({
            passed: false,
            actualOutput: `Execution timed out (${this.TIMEOUT_MS}ms hard limit exceeded)`,
            durationMs,
            timedOut: true,
          });
        }

        if (stderr && !stdout) {
          return resolve({
            passed: false,
            actualOutput: `Runtime Error: ${stderr.trim()}`,
            durationMs,
            timedOut: false,
          });
        }

        const expectedTrimmed = testCase.expectedOutput.trim();
        const actualTrimmed = stdout.trim();
        const passed = actualTrimmed === expectedTrimmed || actualTrimmed === testCase.expectedOutput;

        resolve({
          passed,
          actualOutput: actualTrimmed || '(No Output)',
          durationMs,
          timedOut: false,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutTimer);
        cleanup();
        resolve({
          passed: false,
          actualOutput: `Process Error: ${err.message}`,
          durationMs: Date.now() - startTime,
          timedOut: false,
        });
      });
    });
  }

  /**
   * TypeScript Sandboxed Execution
   */
  private static runTypeScriptSandbox(
    code: string,
    testCase: TestCase,
    sandboxId: string,
    startTime: number
  ): Promise<{ passed: boolean; actualOutput: string; durationMs: number; timedOut: boolean }> {
    return new Promise((resolve) => {
      const scriptPath = path.join(this.SANDBOX_DIR, `${sandboxId}.ts`);

      const wrappedScript = `
'use strict';
const inputRaw = ${JSON.stringify(testCase.input)};
let parsedInput: any = inputRaw;
try {
  parsedInput = JSON.parse(inputRaw);
} catch (e) {
  parsedInput = inputRaw;
}

try {
  ${code}

  const fn = typeof (globalThis as any).solution === 'function' ? (globalThis as any).solution : (typeof solution === 'function' ? solution : null);
  if (!fn) {
    process.stderr.write("ReferenceError: 'solution' function is not defined.");
    process.exit(1);
  }

  const result = fn(parsedInput);
  if (typeof result === 'object' && result !== null) {
    process.stdout.write(JSON.stringify(result));
  } else {
    process.stdout.write(String(result));
  }
} catch (err: any) {
  process.stderr.write(err.name + ': ' + err.message);
  process.exit(1);
}
`;

      fs.writeFileSync(scriptPath, wrappedScript, 'utf-8');

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const localTsx = path.resolve(process.cwd(), 'node_modules', '.bin', 'tsx');
      const tsxBin = fs.existsSync(localTsx) ? localTsx : 'tsx';

      const child = spawn(
        tsxBin,
        [scriptPath],
        {
          cwd: this.SANDBOX_DIR,
          env: { PATH: process.env.PATH, NODE_ENV: 'production' },
          timeout: this.TIMEOUT_MS,
        }
      );

      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGKILL');
        } catch {}
      }, this.TIMEOUT_MS);

      child.stdout.on('data', (data) => {
        if (stdout.length < this.MAX_OUTPUT_BYTES) {
          stdout += data.toString();
          if (stdout.length >= this.MAX_OUTPUT_BYTES) {
            stdout = stdout.substring(0, this.MAX_OUTPUT_BYTES) + '\n[Output truncated: maximum buffer size exceeded]';
            try { child.kill('SIGKILL'); } catch {}
          }
        }
      });

      child.stderr.on('data', (data) => {
        if (stderr.length < this.MAX_OUTPUT_BYTES) {
          stderr += data.toString();
          if (stderr.length >= this.MAX_OUTPUT_BYTES) {
            stderr = stderr.substring(0, this.MAX_OUTPUT_BYTES) + '\n[Error output truncated]';
            try { child.kill('SIGKILL'); } catch {}
          }
        }
      });

      const cleanup = () => {
        try {
          if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        } catch {}
      };

      child.on('close', () => {
        clearTimeout(timeoutTimer);
        cleanup();

        const durationMs = Date.now() - startTime;

        if (timedOut) {
          return resolve({
            passed: false,
            actualOutput: `Execution timed out (${this.TIMEOUT_MS}ms hard limit exceeded)`,
            durationMs,
            timedOut: true,
          });
        }

        if (stderr && !stdout) {
          return resolve({
            passed: false,
            actualOutput: `Runtime Error: ${stderr.trim()}`,
            durationMs,
            timedOut: false,
          });
        }

        const expectedTrimmed = testCase.expectedOutput.trim();
        const actualTrimmed = stdout.trim();
        const passed = actualTrimmed === expectedTrimmed || actualTrimmed === testCase.expectedOutput;

        resolve({
          passed,
          actualOutput: actualTrimmed || '(No Output)',
          durationMs,
          timedOut: false,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutTimer);
        cleanup();
        resolve({
          passed: false,
          actualOutput: `Process Error: ${err.message}`,
          durationMs: Date.now() - startTime,
          timedOut: false,
        });
      });
    });
  }

  /**
   * Python Sandboxed Execution
   */
  private static runPythonSandbox(
    code: string,
    testCase: TestCase,
    sandboxId: string,
    startTime: number
  ): Promise<{ passed: boolean; actualOutput: string; durationMs: number; timedOut: boolean }> {
    return new Promise((resolve) => {
      const scriptPath = path.join(this.SANDBOX_DIR, `${sandboxId}.py`);

      const wrappedScript = `
import sys
import json

raw_input_str = ${JSON.stringify(testCase.input)}
try:
    parsed_input = json.loads(raw_input_str)
except Exception:
    parsed_input = raw_input_str

try:
${code.split('\n').map(line => '    ' + line).join('\n')}

    if 'solution' not in locals() and 'solution' not in globals():
        sys.stderr.write("ReferenceError: 'solution' function is not defined.")
        sys.exit(1)

    result = solution(parsed_input)
    if isinstance(result, (dict, list)):
        sys.stdout.write(json.dumps(result))
    elif isinstance(result, bool):
        sys.stdout.write("true" if result else "false")
    else:
        sys.stdout.write(str(result))
except Exception as e:
    sys.stderr.write(f"{type(e).__name__}: {str(e)}")
    sys.exit(1)
`;

      fs.writeFileSync(scriptPath, wrappedScript, 'utf-8');

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const pythonBin = process.env.PYTHON_BIN || 'python3';

      const child = spawn(
        pythonBin,
        [scriptPath],
        {
          cwd: this.SANDBOX_DIR,
          env: { PATH: process.env.PATH, PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1' },
          timeout: this.TIMEOUT_MS,
        }
      );

      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGKILL');
        } catch {}
      }, this.TIMEOUT_MS);

      child.stdout.on('data', (data) => {
        if (stdout.length < this.MAX_OUTPUT_BYTES) {
          stdout += data.toString();
          if (stdout.length >= this.MAX_OUTPUT_BYTES) {
            stdout = stdout.substring(0, this.MAX_OUTPUT_BYTES) + '\n[Output truncated: maximum buffer size exceeded]';
            try { child.kill('SIGKILL'); } catch {}
          }
        }
      });

      child.stderr.on('data', (data) => {
        if (stderr.length < this.MAX_OUTPUT_BYTES) {
          stderr += data.toString();
          if (stderr.length >= this.MAX_OUTPUT_BYTES) {
            stderr = stderr.substring(0, this.MAX_OUTPUT_BYTES) + '\n[Error output truncated]';
            try { child.kill('SIGKILL'); } catch {}
          }
        }
      });

      const cleanup = () => {
        try {
          if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        } catch {}
      };

      child.on('close', () => {
        clearTimeout(timeoutTimer);
        cleanup();

        const durationMs = Date.now() - startTime;

        if (timedOut) {
          return resolve({
            passed: false,
            actualOutput: `Execution timed out (${this.TIMEOUT_MS}ms hard limit exceeded)`,
            durationMs,
            timedOut: true,
          });
        }

        if (stderr && !stdout) {
          return resolve({
            passed: false,
            actualOutput: `Runtime Error: ${stderr.trim()}`,
            durationMs,
            timedOut: false,
          });
        }

        const expectedTrimmed = testCase.expectedOutput.trim();
        const actualTrimmed = stdout.trim();
        const passed = actualTrimmed === expectedTrimmed || actualTrimmed === testCase.expectedOutput;

        resolve({
          passed,
          actualOutput: actualTrimmed || '(No Output)',
          durationMs,
          timedOut: false,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutTimer);
        cleanup();
        resolve({
          passed: false,
          actualOutput: `Process Error: ${err.message}`,
          durationMs: Date.now() - startTime,
          timedOut: false,
        });
      });
    });
  }

  /**
   * Clean up any leftover temporary files in sandbox directory older than 5 minutes
   */
  public static cleanupStaleSandboxFiles(): void {
    try {
      if (!fs.existsSync(this.SANDBOX_DIR)) return;
      const files = fs.readdirSync(this.SANDBOX_DIR);
      const now = Date.now();
      for (const file of files) {
        const filePath = path.join(this.SANDBOX_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > 5 * 60 * 1000) {
            fs.unlinkSync(filePath);
          }
        } catch {}
      }
    } catch {}
  }
}
