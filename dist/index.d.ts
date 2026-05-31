#!/usr/bin/env node
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
export interface BenchmarkCase {
    name: string;
    fn: () => void | Promise<void>;
    /** Optional setup before each iteration */
    setup?: () => void | Promise<void>;
    /** Optional teardown after each iteration */
    teardown?: () => void | Promise<void>;
}
export interface BenchmarkResult {
    name: string;
    iterations: number;
    /** Total elapsed time in ms */
    totalMs: number;
    /** Mean per-iteration time in ms */
    meanMs: number;
    /** Median per-iteration time in ms */
    medianMs: number;
    /** Minimum iteration time in ms */
    minMs: number;
    /** Maximum iteration time in ms */
    maxMs: number;
    /** Standard deviation in ms */
    stddevMs: number;
    /** Operations per second */
    opsPerSec: number;
    /** 95th percentile in ms */
    p95Ms: number;
    /** 99th percentile in ms */
    p99Ms: number;
    /** Individual iteration times in ms (sorted) */
    samples: number[];
    /** Relative margin of error (95% confidence) */
    marginOfError: number;
    /** Error message if benchmark failed */
    error?: string;
}
export interface SuiteResult {
    name: string;
    results: BenchmarkResult[];
    /** Name of the fastest case */
    fastest: string;
    /** Name of the slowest case */
    slowest: string;
}
export interface RunOptions {
    /** Number of iterations per case (default: 100) */
    iterations?: number;
    /** Warmup iterations (not measured, default: 10) */
    warmup?: number;
    /** Maximum time per case in ms (default: 10000) */
    maxTime?: number;
    /** Abort if a single iteration exceeds this many ms (default: 5000) */
    iterTimeout?: number;
}
export type OutputFormat = 'text' | 'json' | 'markdown';
export declare function runCase(bench: BenchmarkCase, options?: RunOptions): Promise<BenchmarkResult>;
export declare function runSuite(cases: BenchmarkCase[], suiteName?: string, options?: RunOptions): Promise<SuiteResult>;
export declare class SuiteBuilder {
    private cases;
    private _name;
    constructor(name?: string);
    add(name: string, fn: () => void | Promise<void>): this;
    addWithLifecycle(opts: {
        name: string;
        fn: () => void | Promise<void>;
        setup?: () => void | Promise<void>;
        teardown?: () => void | Promise<void>;
    }): this;
    build(): BenchmarkCase[];
    get name(): string;
}
export declare function suite(name?: string): SuiteBuilder;
export declare function bench(cases: BenchmarkCase[], options?: RunOptions & {
    format?: OutputFormat;
    suiteName?: string;
}): Promise<string>;
export declare function formatResult(result: SuiteResult, format?: OutputFormat): string;
