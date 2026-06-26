#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const tsxPath = path.resolve(__dirname, '../node_modules/.bin/tsx');
const entryPath = path.resolve(__dirname, '../src/index.ts');

const result = spawnSync(tsxPath, [entryPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 0);
