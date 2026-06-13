#!/usr/bin/env node
'use strict';

const {
  suite, runBench, computeStats, formatTable,
  formatComparison, barChart, stats,
  formatMs, formatNumber,
} = require('./index');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

function assertApprox(a, b, tolerance, msg) {
  assert(Math.abs(a - b) <= tolerance, `${msg} (got ${a}, expected ~${b})`);
}

console.log('benchrunner tests\n');

// ── Stats unit tests ──────────────────────────────────────────

console.log('stats helpers');

assert(stats.mean([1, 2, 3, 4, 5]) === 3, 'mean of 1-5');
assert(stats.median([1, 2, 3, 4, 5]) === 3, 'median odd');
assert(stats.median([1, 2, 3, 4]) === 2.5, 'median even');
assertApprox(stats.stddev([2, 4, 4, 4, 5, 5, 7, 9]), 2, 0.2, 'stddev');
assert(stats.sum([1, 2, 3]) === 6, 'sum');
assertApprox(stats.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5.5, 0.01, 'p50');
assertApprox(stats.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 9.55, 0.01, 'p95');
assert(stats.variance([10, 10, 10]) === 0, 'variance of constant');

// ── Format helpers ────────────────────────────────────────────

console.log('format helpers');

assert(typeof formatMs(1.5) === 'string', 'formatMs returns string');
assert(formatMs(1.5).includes('ms'), 'formatMs ms range');
assert(formatMs(0.005).includes('µs'), 'formatMs µs range');
assert(formatMs(1500).includes('s'), 'formatMs seconds range');

assert(typeof formatNumber(1234) === 'string', 'formatNumber returns string');
assert(formatNumber(1500000).includes('M'), 'formatNumber millions');
assert(formatNumber(1500).includes('K'), 'formatNumber thousands');

// ── runBench ──────────────────────────────────────────────────

console.log('runBench');

const result = runBench(() => { let s = 0; for (let i = 0; i < 100; i++) s += i; }, {
  iterations: 50,
  warmup: 5,
  maxTime: 2000,
});

assert(Array.isArray(result.samples), 'runBench returns samples array');
assert(result.samples.length > 0, 'runBench has samples');
assert(result.samples.length <= 50, 'runBench respects max iterations');
assert(typeof result.wallTime === 'number', 'runBench returns wallTime');
assert(result.wallTime >= 0, 'runBench wallTime is non-negative');

// ── computeStats ──────────────────────────────────────────────

console.log('computeStats');

const st = computeStats([1, 2, 3, 4, 5]);
assert(st.samples === 5, 'stats.samples');
assert(st.min === 1, 'stats.min');
assert(st.max === 5, 'stats.max');
assert(st.opsSec > 0, 'stats.opsSec positive');

const emptyStats = computeStats([]);
assert(emptyStats.samples === 0, 'empty stats samples');
assert(emptyStats.mean === 0, 'empty stats mean');

// ── suite ─────────────────────────────────────────────────────

console.log('suite');

const s = suite('test suite');
assert(s.name === 'test suite', 'suite name');
assert(s.benches.length === 0, 'suite starts empty');

s.add('noop', () => {});
assert(s.benches.length === 1, 'add works');
assert(s.benches[0].label === 'noop', 'add label');

s.add('math', () => Math.sqrt(42));
assert(s.benches.length === 2, 'add second');

const results = s.run({ iterations: 30, warmup: 3, maxTime: 2000 });
assert(Array.isArray(results), 'run returns array');
assert(results.length === 2, 'run returns 2 results');
assert(results[0].label === 'noop', 'result label preserved');
assert(results[0].stats.samples > 0, 'result has stats');
assert(typeof results[0].stats.mean === 'number', 'result stats.mean');
assert(typeof results[0].stats.p95 === 'number', 'result stats.p95');
assert(typeof results[0].stats.opsSec === 'number', 'result stats.opsSec');

// ── formatTable ───────────────────────────────────────────────

console.log('formatTable');

const table = formatTable(results);
assert(typeof table === 'string', 'table is string');
assert(table.includes('noop'), 'table contains bench label');
assert(table.includes('Mean'), 'table contains header');
assert(table.includes('benchmarks'), 'table contains summary');
assert(table.includes('│'), 'table has borders');

const emptyTable = formatTable([]);
assert(emptyTable.includes('No benchmarks'), 'empty table message');

// ── barChart ──────────────────────────────────────────────────

console.log('barChart');

const chart = barChart(results);
assert(typeof chart === 'string', 'barChart returns string');
assert(chart.includes('█'), 'barChart has bars');
assert(chart.includes('noop'), 'barChart has labels');
assert(chart.includes('/s'), 'barChart has ops/sec');

const emptyChart = barChart([]);
assert(emptyChart === '', 'empty barChart');

// ── compare ───────────────────────────────────────────────────

console.log('compare');

const comp = s.compare(0, { iterations: 20, warmup: 2, maxTime: 2000 });
assert(Array.isArray(comp), 'compare returns array');
assert(comp.length === 2, 'compare 2 results');
assert(comp[0].relative === 'baseline', 'baseline labeled');
assert(typeof comp[1].relative === 'number', 'other has relative');
assert(typeof comp[1].faster === 'number', 'other has faster');

const compStr = formatComparison(comp);
assert(typeof compStr === 'string', 'formatComparison string');
assert(compStr.includes('baseline'), 'contains baseline text');

// ── Suite defaults ────────────────────────────────────────────

console.log('suite defaults');

const s2 = suite('defaulted', { iterations: 20, warmup: 2 });
s2.add('fast', () => true);
const r2 = s2.run();
assert(r2[0].stats.samples > 0, 'defaults applied');

// ── Edge cases ────────────────────────────────────────────────

console.log('edge cases');

// Very fast function
const fastResult = runBench(() => 1 + 1, { iterations: 10, warmup: 1 });
assert(fastResult.samples.length === 10, 'fast function samples');

// Zero ops/sec guard
const zeroStats = computeStats([]);
assert(zeroStats.opsSec === 0, 'zero ops for empty');

// Single sample
const singleStats = computeStats([5]);
assert(singleStats.mean === 5, 'single mean');
assert(singleStats.stddev === 0, 'single stddev');

// ── Results ───────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
