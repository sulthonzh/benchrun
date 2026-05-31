#!/usr/bin/env node
"use strict";
/**
 * benchrun — Zero-dep microbenchmark runner for Node.js
 *
 * Define benchmark suites, run them, get real stats (mean, median, p95, p99,
 * stddev, ops/sec). Works as a library and a CLI.
 *
 * Usage (library):
 *   import { suite, run } from 'benchrun';
 *   await run(suite('my suite').add('parse JSON', () => JSON.parse('{"a":1}')).build());
 *
 * Usage (CLI):
 *   benchrun benchmarks/*.bench.ts --iterations 1000 --warmup 50
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuiteBuilder = void 0;
exports.runCase = runCase;
exports.runSuite = runSuite;
exports.suite = suite;
exports.bench = bench;
exports.formatResult = formatResult;
// ── Stats ───────────────────────────────────────────────────────────────
function percentile(sorted, p) {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}
function computeStats(samples, iterations) {
    const sorted = [...samples].sort((a, b) => a - b);
    const totalMs = sorted.reduce((s, v) => s + v, 0);
    const meanMs = totalMs / sorted.length;
    const medianMs = sorted[Math.floor(sorted.length / 2)];
    const minMs = sorted[0];
    const maxMs = sorted[sorted.length - 1];
    const variance = sorted.reduce((s, v) => s + (v - meanMs) ** 2, 0) / sorted.length;
    const stddevMs = Math.sqrt(variance);
    const opsPerSec = meanMs > 0 ? 1000 / meanMs : Infinity;
    const p95Ms = percentile(sorted, 95);
    const p99Ms = percentile(sorted, 99);
    // Relative margin of error: 1.96 * (stddev / sqrt(n)) / mean
    const marginOfError = meanMs > 0
        ? (1.96 * (stddevMs / Math.sqrt(sorted.length))) / meanMs
        : 0;
    return {
        iterations,
        totalMs,
        meanMs,
        medianMs,
        minMs,
        maxMs,
        stddevMs,
        opsPerSec,
        p95Ms,
        p99Ms,
        samples: sorted,
        marginOfError,
    };
}
// ── Runner ──────────────────────────────────────────────────────────────
async function timeIteration(fn) {
    const start = performance.now();
    await fn();
    return performance.now() - start;
}
async function runCase(bench, options = {}) {
    const iterations = options.iterations ?? 100;
    const warmup = options.warmup ?? 10;
    const maxTime = options.maxTime ?? 10000;
    const iterTimeout = options.iterTimeout ?? 5000;
    // Warmup phase
    for (let i = 0; i < warmup; i++) {
        try {
            await bench.fn();
        }
        catch {
            // warmup errors are fine
        }
    }
    const samples = [];
    const suiteStart = performance.now();
    for (let i = 0; i < iterations; i++) {
        // Bail if total time exceeded
        if (performance.now() - suiteStart > maxTime)
            break;
        try {
            if (bench.setup)
                await bench.setup();
            const elapsed = await timeIteration(bench.fn);
            if (bench.teardown)
                await bench.teardown();
            // Bail if single iteration way too slow
            if (elapsed > iterTimeout) {
                samples.push(elapsed);
                break;
            }
            samples.push(elapsed);
        }
        catch (err) {
            return {
                name: bench.name,
                ...computeStats(samples.length > 0 ? samples : [0], samples.length),
                error: err?.message ?? String(err),
            };
        }
    }
    if (samples.length === 0) {
        return {
            name: bench.name,
            iterations: 0,
            totalMs: 0,
            meanMs: 0,
            medianMs: 0,
            minMs: 0,
            maxMs: 0,
            stddevMs: 0,
            opsPerSec: 0,
            p95Ms: 0,
            p99Ms: 0,
            samples: [],
            marginOfError: 0,
            error: 'No samples collected',
        };
    }
    return {
        name: bench.name,
        ...computeStats(samples, samples.length),
    };
}
async function runSuite(cases, suiteName = 'benchmark', options = {}) {
    const results = [];
    for (const c of cases) {
        const r = await runCase(c, options);
        results.push(r);
    }
    const valid = results.filter((r) => !r.error && r.meanMs > 0);
    const fastest = valid.length > 0
        ? valid.reduce((a, b) => (a.meanMs < b.meanMs ? a : b)).name
        : '(none)';
    const slowest = valid.length > 0
        ? valid.reduce((a, b) => (a.meanMs > b.meanMs ? a : b)).name
        : '(none)';
    return { name: suiteName, results, fastest, slowest };
}
// ── Suite Builder ───────────────────────────────────────────────────────
class SuiteBuilder {
    cases = [];
    _name;
    constructor(name = 'benchmark') {
        this._name = name;
    }
    add(name, fn) {
        this.cases.push({ name, fn });
        return this;
    }
    addWithLifecycle(opts) {
        this.cases.push(opts);
        return this;
    }
    build() {
        return [...this.cases];
    }
    get name() {
        return this._name;
    }
}
exports.SuiteBuilder = SuiteBuilder;
function suite(name) {
    return new SuiteBuilder(name);
}
// ── Convenience: run + format ───────────────────────────────────────────
async function bench(cases, options) {
    const { format = 'text', suiteName, ...runOpts } = options ?? {};
    const result = await runSuite(cases, suiteName, runOpts);
    return formatResult(result, format);
}
// ── Formatting ──────────────────────────────────────────────────────────
function fmtNum(n, decimals = 4) {
    if (!isFinite(n))
        return '∞';
    return n.toFixed(decimals);
}
function fmtOps(n) {
    if (!isFinite(n))
        return '∞';
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000)
        return `${(n / 1_000).toFixed(2)}K`;
    return n.toFixed(2);
}
function formatResult(result, format = 'text') {
    if (format === 'json') {
        return JSON.stringify(result, null, 2);
    }
    if (format === 'markdown') {
        const lines = [
            `## ${result.name}`,
            '',
            '| Benchmark | Iterations | Mean (ms) | Median (ms) | p95 (ms) | p99 (ms) | Ops/sec | MoE |',
            '|-----------|-----------|-----------|-------------|----------|----------|---------|-----|',
        ];
        for (const r of result.results) {
            const err = r.error ? ` ⚠️ ${r.error}` : '';
            lines.push(`| ${r.name}${err} | ${r.iterations} | ${fmtNum(r.meanMs)} | ${fmtNum(r.medianMs)} | ${fmtNum(r.p95Ms)} | ${fmtNum(r.p99Ms)} | ${fmtOps(r.opsPerSec)} | ${(r.marginOfError * 100).toFixed(1)}% |`);
        }
        lines.push('');
        lines.push(`**Fastest:** ${result.fastest} · **Slowest:** ${result.slowest}`);
        return lines.join('\n');
    }
    // Text format
    const lines = [];
    const barWidth = 30;
    lines.push(`\n  ${result.name}`);
    lines.push(`  ${'─'.repeat(50)}`);
    // Find max mean for relative bars
    const validResults = result.results.filter((r) => !r.error && r.meanMs > 0);
    const maxMean = validResults.length > 0 ? Math.max(...validResults.map((r) => r.meanMs)) : 1;
    for (const r of result.results) {
        if (r.error) {
            lines.push(`  ✗ ${r.name}: ${r.error}`);
            continue;
        }
        const barLen = Math.max(1, Math.round((r.meanMs / maxMean) * barWidth));
        const bar = '█'.repeat(barLen);
        lines.push(`  ${r.name}`);
        lines.push(`    ${bar} ${fmtNum(r.meanMs)} ms/op  (${fmtOps(r.opsPerSec)} ops/s)`);
        lines.push(`    median ${fmtNum(r.medianMs)} · p95 ${fmtNum(r.p95Ms)} · p99 ${fmtNum(r.p99Ms)} · MoE ${(r.marginOfError * 100).toFixed(1)}%`);
    }
    if (result.fastest !== '(none)') {
        lines.push(`\n  Fastest: ${result.fastest}`);
    }
    return lines.join('\n');
}
