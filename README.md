# benchrunner

Zero-dependency JavaScript benchmarking runner with statistical analysis.

Define benchmark suites, run them with warmup + iteration control, get mean/median/p95/stddev/ops-sec, and pretty-printed tables and bar charts.

## Why

Most benchmarking tools are either heavy or toy examples. benchrunner gives you real statistical rigor — warmup phases, percentile analysis, comparison mode — in a single file with zero dependencies. Works in Node.js, no build step needed.

## Install

```bash
npm install benchrunner
```

## Quick Start

```js
const { suite } = require('benchrunner');

suite('string concat')
  .add('+= operator', () => {
    let s = '';
    for (let i = 0; i < 100; i++) s += 'x';
  })
  .add('array join', () => {
    const arr = [];
    for (let i = 0; i < 100; i++) arr.push('x');
    arr.join('');
  });

// Run and print table
const results = suite('string concat').run();
console.log(suite('string concat').table());
```

## API

### `suite(name, defaults?)`

Create a benchmark suite. `defaults` sets default `iterations`, `warmup`, `maxTime` for all benches.

### `.add(label, fn, opts?)`

Add a benchmark. Options:
- `iterations` (default: 100) — measured iterations
- `warmup` (default: 10) — warmup iterations (not measured)
- `maxTime` (default: 5000ms) — stop early if wall time exceeded

### `.run(opts?)`

Run all benchmarks. Returns array of `{ label, stats, raw }`.

### `.table(opts?)`

Run and return a formatted table string.

### `.compare(baselineIdx?, opts?)`

Run and compare all benches against a baseline. Returns relative speedup/slowdown.

### `formatTable(results)`

Format results as a table manually.

### `barChart(results, width?)`

Generate a horizontal bar chart of ops/sec.

### `runBench(fn, opts?)`

Run a single function and get raw timing samples.

### `computeStats(samples)`

Compute { mean, median, stddev, min, max, p95, p99, opsSec } from timing samples.

## CLI

```bash
benchrunner ./my-bench.js
```

The JS file should use the API and print results.

## Example Output

```
──────────────────────────────────────────────────────────────────────────────
Benchmark        │        Mean │      Median │         P95 │    Std Dev │     Ops/sec
══════════════════════════════════════════════════════════════════════════════
+= operator      │    0.012 ms │   0.009 ms │   0.025 ms │  0.008 ms │   83.33K
array join       │    0.035 ms │   0.028 ms │   0.061 ms │  0.015 ms │   28.57K
──────────────────────────────────────────────────────────────────────────────
2 benchmarks │ total samples: 200
──────────────────────────────────────────────────────────────────────────────
```

## Stats

Each benchmark returns:
- **mean** — average time per iteration
- **median** — median time (robust against outliers)
- **p95/p99** — 95th/99th percentile
- **stddev** — standard deviation
- **min/max** — fastest/slowest iteration
- **opsSec** — estimated operations per second

## License

MIT
