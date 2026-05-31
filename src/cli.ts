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

import { runSuite, formatResult, type BenchmarkCase, type OutputFormat, type RunOptions } from './index.js';

function parseArgs(args: string[]): {
  files: string[];
  iterations: number;
  warmup: number;
  maxTime: number;
  format: OutputFormat;
  evalExpr?: string;
  evalName?: string;
  help: boolean;
} {
  const result = {
    files: [] as string[],
    iterations: 100,
    warmup: 10,
    maxTime: 10000,
    format: 'text' as OutputFormat,
    evalExpr: undefined as string | undefined,
    evalName: undefined as string | undefined,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--iterations':
      case '-n':
        result.iterations = parseInt(args[++i], 10) || 100;
        break;
      case '--warmup':
      case '-w':
        result.warmup = parseInt(args[++i], 10) || 10;
        break;
      case '--max-time':
        result.maxTime = parseInt(args[++i], 10) || 10000;
        break;
      case '--format':
      case '-f': {
        const fmt = args[++i];
        if (fmt === 'text' || fmt === 'json' || fmt === 'markdown') {
          result.format = fmt;
        }
        break;
      }
      case '--eval':
        result.evalExpr = args[++i];
        break;
      case '--name':
        result.evalName = args[++i];
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          result.files.push(arg);
        }
        break;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
benchrun — Zero-dep microbenchmark runner

Usage:
  benchrun <files...>                    Run benchmark files
  benchrun --eval "<expr>"               Quick-benchmark an expression

Options:
  -n, --iterations <n>     Iterations per case (default: 100)
  -w, --warmup <n>         Warmup iterations (default: 10)
  --max-time <ms>          Max time per case in ms (default: 10000)
  -f, --format <fmt>       Output format: text, json, markdown (default: text)
  --eval "<expr>"          Benchmark a JS expression directly
  --name <name>            Name for --eval benchmark
  -h, --help               Show this help

Examples:
  benchrun bench/sort.bench.ts
  benchrun bench/*.bench.ts --iterations 500 --format json
  benchrun --eval "JSON.parse(JSON.stringify({a:1}))" --name "roundtrip"
`);
}

async function loadBenchmarkFile(filePath: string): Promise<BenchmarkCase[]> {
  // Try dynamic import
  const abs = new URL(filePath, `file://${process.cwd()}/`).href;
  const mod = await import(abs);
  // Expect default export to be BenchmarkCase[] or { cases: BenchmarkCase[] }
  if (Array.isArray(mod.default)) return mod.default;
  if (mod.default?.cases) return mod.default.cases;
  if (Array.isArray(mod.cases)) return mod.cases;
  throw new Error(`No benchmark cases found in ${filePath}. Export default an array of cases or { cases: [...] }.`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  if (parsed.help) {
    printHelp();
    return;
  }

  const options: RunOptions = {
    iterations: parsed.iterations,
    warmup: parsed.warmup,
    maxTime: parsed.maxTime,
  };

  let allCases: BenchmarkCase[] = [];

  // --eval mode: quick benchmark an expression
  if (parsed.evalExpr) {
    const expr = parsed.evalExpr;
    const fn = new Function(expr);
    allCases.push({
      name: parsed.evalName ?? expr.slice(0, 40),
      fn: () => fn(),
    });
  }

  // Load files
  for (const file of parsed.files) {
    try {
      const cases = await loadBenchmarkFile(file);
      allCases = allCases.concat(cases);
    } catch (err: any) {
      console.error(`Error loading ${file}: ${err.message}`);
      process.exit(1);
    }
  }

  if (allCases.length === 0) {
    console.error('No benchmarks to run. Pass files or use --eval.');
    process.exit(1);
  }

  const result = await runSuite(allCases, 'benchrun', options);
  const output = formatResult(result, parsed.format);
  console.log(output);

  // Exit with error code if any case failed
  if (result.results.some((r) => r.error)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('benchrun error:', err);
  process.exit(1);
});
