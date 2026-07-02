#!/usr/bin/env node
'use strict';
// Thin wrapper: delegates to TypeScript entry via tsx
const { spawn } = require('child_process');
const tsxPath = require.resolve('tsx/cli').replace(/\\/g, '/');
const entryPath = require.resolve('./src/index.ts').replace(/\\/g, '/');
const child = spawn(process.execPath, [tsxPath, entryPath], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env, TSX_TSCONFIG_PATH: require.resolve('./tsconfig.json') },
});
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
child.on('exit', (code) => process.exit(code || 0));
