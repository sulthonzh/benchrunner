#!/usr/bin/env node
'use strict';

const path = require('path');
const benchrunner = require('./index');

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
benchrunner — Zero-dep JavaScript benchmarking runner

Usage:
  benchrunner <file.js>        Run benchmarks from a JS file
  benchrunner --help           Show this help

The JS file should export a suite or use the global API:

  // bench/my-bench.js
  const { suite } = require('benchrunner');

  suite('my benchmarks')
    .add('method A', () => { /* ... */ })
    .add('method B', () => { /* ... */ })
    .run();

Or export a suite and call .table() or .compare():

  module.exports = suite('...')
    .add(...)
    .table();

Options in .add() or .run():
  iterations  Number of iterations (default: 100)
  warmup      Warmup iterations (default: 10)
  maxTime     Max wall time in ms (default: 5000)

Output modes:
  .table()      Pretty table with stats
  .compare()    Relative comparison to baseline
  .barChart()   Horizontal bar chart of ops/sec
`);
  process.exit(0);
}

const filePath = path.resolve(args[0]);

try {
  require(filePath);
} catch (err) {
  console.error(`Error loading ${filePath}: ${err.message}`);
  process.exit(1);
}
