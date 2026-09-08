import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
  if (result.error) {
    throw result.error;
  }
};

const runBackendTestsByPath = (paths) => {
  run('npm', ['run', 'test', '--workspace', '@aws-exam-generator/backend', '--', '--runTestsByPath', ...paths]);
};

const runBackendAll = () => {
  run('npm', ['run', 'test', '--workspace', '@aws-exam-generator/backend']);
};

const target = args[0] ?? 'backend';
const selector = args[1];

if (target === 'shared') {
  run('npm', ['run', 'build', '--workspace', '@aws-exam-generator/shared']);
  if (selector === 'question-bank-schema') {
    runBackendTestsByPath(['src/__tests__/QuestionBankManager.test.ts']);
  }
  console.log('PASS shared');
  process.exit(0);
}

if (target !== 'backend') {
  runBackendAll();
  console.log('PASS backend');
  process.exit(0);
}

switch (selector) {
  case 'scenario-profile-builder':
  case 'domain-usecase-planner':
  case 'style-entropy':
  case 'multi-pass-reviewer':
  case 'distractor-quality-validator':
  case 'explanation-rubric-validator':
  case 'novelty-gate':
  case 'quality-kpi-aggregator':
    runBackendTestsByPath(['src/__tests__/quality-pipeline.test.ts']);
    break;
  case 'generation-status-api':
    runBackendTestsByPath(['src/__tests__/generation-status-api.test.ts']);
    break;
  case 'property':
    runBackendTestsByPath([
      'src/__tests__/ai-topic-distribution.pbt.test.ts',
      'src/__tests__/scoring.pbt.test.ts',
      'src/__tests__/quality-pipeline.property.test.ts',
    ]);
    break;
  case 'quality-pipeline-integration':
    runBackendTestsByPath(['src/__tests__/quality-pipeline.integration.test.ts']);
    break;
  case 'performance-budget':
    runBackendTestsByPath(['src/__tests__/quality-pipeline.performance.test.ts']);
    break;
  case undefined:
    runBackendAll();
    break;
  default:
    runBackendAll();
    break;
}

console.log('PASS backend');
