# benchrun

Zero-dep microbenchmark runner for Node.js. Define suites, run them, get real stats.

## Why?

Most benchmark tools are either overkill (full framework) or too simple (`console.time`). `benchrun` sits in the middle — proper stats (mean, median, p95, p99, margin of error) with a tiny API and zero dependencies.

## Install

```bash
npm install benchrun
```

## Quick Start

### Library

```typescript
import { suite, runSuite, formatResult } from 'benchrun';

const cases = suite('string ops')
  .add('concat', () => 'a' + 'b' + 'c')
  .add('template', () => `${'a'}${'b'}${'c'}`)
  .add('join', () => ['a', 'b', 'c'].join(''))
  .build();

const result = await runSuite(cases, 'string ops', { iterations: 500, warmup: 20 });
console.log(formatResult(result, 'text'));
```

Output:

```
  string ops
  ──────────────────────────────────────────────────
  concat
    ██████████████████████████████ 0.0003 ms/op  (3.33M ops/s)
    median 0.0002 · p95 0.0008 · p99 0.0012 · MoE 5.2%
  template
    ████████████████████████████████ 0.0004 ms/op  (2.50M ops/s)
    median 0.0003 · p95 0.0009 · p99 0.0015 · MoE 4.8%
  join
    ████████████████████████████████████████████████ 0.0012 ms/op  (833.33K ops/s)
    median 0.0010 · p95 0.0025 · p99 0.0031 · MoE 3.1%

  Fastest: concat
```

### CLI

```bash
# Run a benchmark file
benchrun bench/sort.bench.ts --iterations 500

# Quick benchmark an expression
benchrun --eval "JSON.parse(JSON.stringify({a:1}))" --name "roundtrip"

# JSON output for CI
benchrun bench/*.bench.ts --format json

# Markdown for docs
benchrun bench/*.bench.ts --format markdown
```

### Benchmark file format

```typescript
// bench/sort.bench.ts
export default [
  { name: 'Array.sort', fn: () => [3,1,2].sort() },
  { name: 'spread sort', fn: () => [...[3,1,2]].sort() },
];
```

## API

### `suite(name?)`

Create a suite builder.

```typescript
suite('my suite')
  .add('case 1', () => { /* ... */ })
  .addWithLifecycle({
    name: 'case 2',
    fn: () => { /* ... */ },
    setup: () => { /* runs before each iteration */ },
    teardown: () => { /* runs after each iteration */ },
  })
  .build(); // → BenchmarkCase[]
```

### `runSuite(cases, name?, options?)`

Run all cases and return a `SuiteResult`.

Options:
- `iterations` — per case (default: 100)
- `warmup` — warmup iterations, not measured (default: 10)
- `maxTime` — max time per case in ms (default: 10000)
- `iterTimeout` — bail if a single iteration exceeds this (default: 5000)

### `runCase(bench, options?)`

Run a single case, returns `BenchmarkResult`.

### `bench(cases, options?)`

Convenience: run + format in one call. Returns a string.

### `formatResult(result, format)`

Format a `SuiteResult` as `text`, `json`, or `markdown`.

## Stats Explained

Every case gets:
- **mean/median/min/max** — central tendency
- **p95/p99** — tail latency
- **stddev** — spread
- **ops/sec** — throughput
- **margin of error** — 95% confidence interval relative to mean (lower = more reliable)

## License

MIT
