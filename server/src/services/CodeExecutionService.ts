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
  private static readonly SANDBOX_DIR = path.join(os.tmpdir(), 'techscreen_sandbox');

  static {
    if (!fs.existsSync(CodeExecutionService.SANDBOX_DIR)) {
      try {
        fs.mkdirSync(CodeExecutionService.SANDBOX_DIR, { recursive: true });
      } catch {}
    }
  }

  /**
   * Execute code in an isolated sub-process with strict timeout and sandbox boundaries
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

    const startTime = Date.now();
    let passCount = 0;
    let anyTimedOut = false;
    const testResults: TestCaseResult[] = [];

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

      // Prepare wrapper script that injects test input and outputs serialized solution output
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

      // Spawn child node process with strict memory ceiling and safe env
      const child = spawn(
        process.execPath,
        ['--max-old-space-size=64', scriptPath],
        {
          cwd: this.SANDBOX_DIR,
          env: { PATH: process.env.PATH, NODE_ENV: 'production' }, // Stripped env (no JWT or DB passwords)
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
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', () => {
        clearTimeout(timeoutTimer);
        // Clean up temp file
        try {
          if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        } catch {}

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
        try {
          if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        } catch {}
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
          env: { PATH: process.env.PATH },
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
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', () => {
        clearTimeout(timeoutTimer);
        try {
          if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        } catch {}

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
        try {
          if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        } catch {}
        resolve({
          passed: false,
          actualOutput: `Process Error: ${err.message}`,
          durationMs: Date.now() - startTime,
          timedOut: false,
        });
      });
    });
  }
}
