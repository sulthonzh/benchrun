#!/usr/bin/env node
/**
 * benchrun CLI — Run benchmark suites from the command line
 *
 * Usage:
 *   benchrun --help
 *   benchrun bench/my.bench.ts
 *   benchrun bench/*.bench.ts --iterations 500 --warmup 20
 *   benchrun bench/my.bench.ts --format json
 *   benchrun bench/my.bench.ts --format markdown
 *   benchrun --eval "JSON.parse('{\"a\":1}')" --name "parse JSON" --iterations 1000
 */
export {};
