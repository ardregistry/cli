#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const distPath = path.resolve(__dirname, '../dist/index.js');

if (fs.existsSync(distPath)) {
  require(distPath);
} else {
  // Fallback for local development when running typescript source directly
  const tsxBin = path.resolve(__dirname, '../node_modules/.bin/tsx');
  const entryPath = path.resolve(__dirname, '../src/index.ts');

  if (fs.existsSync(tsxBin)) {
    const { spawnSync } = require('child_process');
    const result = spawnSync(tsxBin, [entryPath, ...process.argv.slice(2)], {
      stdio: 'inherit',
    });
    process.exit(result.status ?? 0);
  } else {
    console.error('Error: CLI build is missing. Please run "npm run build" first.');
    process.exit(1);
  }
}
