'use strict';

/**
 * benchrunner — Zero-dep JavaScript benchmarking runner
 *
 * Define suites of benchmarks, run them with statistical rigor,
 * compare results, get pretty output with mean/median/p95/stddev.
 */

// ── Stats helpers ──────────────────────────────────────────────

function sum(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s;
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return sum(arr) / arr.length;
}

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function variance(arr) {
  const m = mean(arr);
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += (arr[i] - m) ** 2;
  return arr.length > 1 ? s / (arr.length - 1) : 0;
}

function stddev(arr) {
  return Math.sqrt(variance(arr));
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function opsPerSec(msPerOp) {
  if (msPerOp === 0) return Infinity;
  return 1000 / msPerOp;
}

function formatNumber(n) {
  if (n === Infinity) return '∞';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.001) return n.toFixed(4);
  return n.toExponential(2);
}

function formatMs(ms) {
  if (ms >= 1000) return (ms / 1000).toFixed(3) + ' s';
  if (ms >= 1) return ms.toFixed(3) + ' ms';
  if (ms >= 0.001) return (ms * 1000).toFixed(3) + ' µs';
  return (ms * 1e6).toFixed(2) + ' ns';
}

// ── Benchmark runner ───────────────────────────────────────────

/**
 * Run a single benchmark function and collect timing samples.
 *
 * @param {Function} fn - The function to benchmark
 * @param {object} [opts]
 * @param {number} [opts.iterations=100] - Number of iterations to run
 * @param {number} [opts.warmup=10] - Warmup iterations (not measured)
 * @param {number} [opts.maxTime=5000] - Max wall time in ms (stop early if exceeded)
 * @returns {object} Raw timing samples in ms
 */
function runBench(fn, opts = {}) {
  const iterations = opts.iterations || 100;
  const warmup = opts.warmup || 10;
  const maxTime = opts.maxTime || 5000;

  // Warmup phase
  for (let i = 0; i < warmup; i++) fn();

  const samples = [];
  const startWall = performance.now();

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    const t1 = performance.now();
    samples.push(t1 - t0);

    // Stop early if we exceed max wall time
    if (t1 - startWall > maxTime) break;
  }

  return { samples, wallTime: performance.now() - startWall };
}

/**
 * Compute statistics from raw timing samples.
 *
 * @param {number[]} samples - Timing samples in ms
 * @returns {object} Statistics object
 */
function computeStats(samples) {
  if (samples.length === 0) {
    return {
      samples: 0, mean: 0, median: 0, stddev: 0,
      min: 0, max: 0, p95: 0, p99: 0, opsSec: 0,
    };
  }

  const m = mean(samples);
  return {
    samples: samples.length,
    mean: m,
    median: median(samples),
    stddev: stddev(samples),
    min: Math.min(...samples),
    max: Math.max(...samples),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
    opsSec: opsPerSec(m),
  };
}

// ── Suite ──────────────────────────────────────────────────────

/**
 * Create a benchmark suite.
 *
 * @param {string} name - Suite name
 * @param {object} [defaults] - Default options for all benches in this suite
 * @returns {object} Suite object with .add(), .run(), .compare()
 */
function suite(name, defaults = {}) {
  const benches = [];

  return {
    name,
    benches,

    /**
     * Add a benchmark to the suite.
     * @param {string} label - Descriptive name
     * @param {Function} fn - Function to benchmark
     * @param {object} [opts] - Override defaults
     */
    add(label, fn, opts = {}) {
      benches.push({ label, fn, opts: { ...defaults, ...opts } });
      return this;
    },

    /**
     * Run all benchmarks in the suite.
     * @param {object} [runOpts] - Global run options
     * @returns {object[]} Array of { label, stats, raw }
     */
    run(runOpts = {}) {
      const results = [];

      for (const b of benches) {
        const opts = { ...b.opts, ...runOpts };
        const raw = runBench(b.fn, opts);
        const stats = computeStats(raw.samples);
        results.push({ label: b.label, stats, raw });
      }

      return results;
    },

    /**
     * Run and return a formatted table string.
     * @param {object} [runOpts]
     * @returns {string}
     */
    table(runOpts = {}) {
      const results = this.run(runOpts);
      return formatTable(results);
    },

    /**
     * Compare two benchmarks and return relative speedup.
     * @param {number} [baselineIdx=0] - Index of baseline benchmark
     * @param {object} [runOpts]
     * @returns {object[]} Comparison results
     */
    compare(baselineIdx = 0, runOpts = {}) {
      const results = this.run(runOpts);
      if (results.length === 0) return [];

      const baseline = results[baselineIdx];
      const baseMean = baseline.stats.mean || 1;

      return results.map((r, i) => ({
        label: r.label,
        ...r.stats,
        relative: i === baselineIdx ? 'baseline' : r.stats.mean / baseMean,
        faster: i === baselineIdx ? null : baseMean / (r.stats.mean || 1),
      }));
    },
  };
}

// ── Formatting ─────────────────────────────────────────────────

/**
 * Format benchmark results as a table string.
 */
function formatTable(results) {
  if (results.length === 0) return 'No benchmarks to display.';

  // Column widths
  const labelW = Math.max(12, ...results.map(r => r.label.length));
  const hdr = [
    'Benchmark'.padEnd(labelW),
    'Mean'.padStart(12),
    'Median'.padStart(12),
    'P95'.padStart(12),
    'Std Dev'.padStart(12),
    'Ops/sec'.padStart(12),
  ].join(' │ ');

  const sep = '─'.repeat(hdr.length);
  const lines = [sep, hdr, sep.replace(/─/g, '═')];

  for (const r of results) {
    const s = r.stats;
    lines.push([
      r.label.padEnd(labelW),
      formatMs(s.mean).padStart(12),
      formatMs(s.median).padStart(12),
      formatMs(s.p95).padStart(12),
      formatMs(s.stddev).padStart(12),
      formatNumber(s.opsSec).padStart(12),
    ].join(' │ '));
  }

  lines.push(sep);
  lines.push(`${results.length} benchmarks │ total samples: ${results.reduce((a, r) => a + r.stats.samples, 0)}`);
  lines.push(sep);

  return lines.join('\n');
}

/**
 * Format comparison results.
 */
function formatComparison(comparisons) {
  if (comparisons.length === 0) return 'No comparisons to display.';

  const labelW = Math.max(12, ...comparisons.map(c => c.label.length));
  const lines = [];

  for (const c of comparisons) {
    if (c.relative === 'baseline') {
      lines.push(`  ${c.label.padEnd(labelW)}  ← baseline (${formatNumber(c.opsSec)} ops/sec)`);
    } else {
      const speedup = c.faster;
      const tag = speedup > 1 ? 'faster' : 'slower';
      lines.push(`  ${c.label.padEnd(labelW)}  ${speedup.toFixed(2)}x ${tag} (${formatNumber(c.opsSec)} ops/sec)`);
    }
  }

  return lines.join('\n');
}

// ── Bar chart ──────────────────────────────────────────────────

/**
 * Generate a horizontal bar chart of ops/sec.
 */
function barChart(results, width = 40) {
  if (results.length === 0) return '';

  const maxOps = Math.max(...results.map(r => r.stats.opsSec));
  const labelW = Math.max(12, ...results.map(r => r.label.length));
  const lines = [];

  for (const r of results) {
    const barLen = Math.round((r.stats.opsSec / maxOps) * width);
    const bar = '█'.repeat(barLen) + '░'.repeat(width - barLen);
    lines.push(`${r.label.padEnd(labelW)} │${bar}│ ${formatNumber(r.stats.opsSec)}/s`);
  }

  return lines.join('\n');
}

// ── Exports ────────────────────────────────────────────────────

module.exports = {
  suite,
  runBench,
  computeStats,
  formatTable,
  formatComparison,
  barChart,
  // Stats utilities exposed for direct use
  stats: { mean, median, stddev, variance, percentile, sum },
  formatMs,
  formatNumber,
};
