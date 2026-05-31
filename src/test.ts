/**
 * benchrun tests
 */
import {
  suite,
  runSuite,
  runCase,
  formatResult,
  bench,
  type BenchmarkCase,
} from './index.js';

import assert from 'node:assert/strict';

// ── Helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

function closeTo(a: number, b: number, tolerance = 0.5): boolean {
  return Math.abs(a - b) < tolerance;
}

// ── Tests ───────────────────────────────────────────────────────────────

async function main() {
  console.log('\nbenchrun tests\n');

  // 1. Suite builder
  await test('suite builder creates cases', async () => {
    const cases = suite('test')
      .add('noop', () => {})
      .add('math', () => { Math.sqrt(42); })
      .build();
    assert.equal(cases.length, 2);
    assert.equal(cases[0].name, 'noop');
    assert.equal(cases[1].name, 'math');
  });

  // 2. suite builder with lifecycle
  await test('suite builder addWithLifecycle', async () => {
    let setupCalled = false;
    let teardownCalled = false;
    const cases = suite('test')
      .addWithLifecycle({
        name: 'with-lifecycle',
        fn: () => {
          assert.ok(setupCalled, 'setup should run before fn');
        },
        setup: () => { setupCalled = true; },
        teardown: () => { teardownCalled = true; },
      })
      .build();
    assert.equal(cases.length, 1);
    assert.equal(cases[0].name, 'with-lifecycle');
    assert.ok(cases[0].setup);
    assert.ok(cases[0].teardown);
  });

  // 3. Run a simple case
  await test('runCase returns valid stats', async () => {
    const result = await runCase(
      { name: 'simple', fn: () => { let s = 0; for (let i = 0; i < 100; i++) s += i; } },
      { iterations: 50, warmup: 5, maxTime: 5000 }
    );
    assert.equal(result.name, 'simple');
    assert.equal(result.iterations, 50);
    assert.ok(result.meanMs >= 0);
    assert.ok(result.opsPerSec > 0);
    assert.ok(result.samples.length === 50);
    assert.ok(!result.error);
  });

  // 4. Run a fast case
  await test('runCase handles very fast functions', async () => {
    const result = await runCase(
      { name: 'fast', fn: () => {} },
      { iterations: 100, warmup: 5 }
    );
    assert.ok(result.meanMs >= 0);
    assert.ok(result.opsPerSec > 0 || result.meanMs === 0);
    assert.equal(result.iterations, 100);
  });

  // 5. Run a case with error
  await test('runCase captures errors', async () => {
    const result = await runCase(
      { name: 'broken', fn: () => { throw new Error('boom'); } },
      { iterations: 10, warmup: 2 }
    );
    assert.ok(result.error);
    assert.ok(result.error!.includes('boom'));
  });

  // 6. Run a suite with multiple cases
  await test('runSuite returns SuiteResult with fastest/slowest', async () => {
    const cases: BenchmarkCase[] = [
      { name: 'fast', fn: () => {} },
      { name: 'slow', fn: () => { for (let i = 0; i < 10000; i++) Math.random(); } },
    ];
    const result = await runSuite(cases, 'my suite', { iterations: 50, warmup: 5 });
    assert.equal(result.name, 'my suite');
    assert.equal(result.results.length, 2);
    assert.equal(result.fastest, 'fast');
    assert.equal(result.slowest, 'slow');
  });

  // 7. Suite with all errors
  await test('runSuite handles all-failing cases', async () => {
    const cases: BenchmarkCase[] = [
      { name: 'fail1', fn: () => { throw new Error('err1'); } },
      { name: 'fail2', fn: () => { throw new Error('err2'); } },
    ];
    const result = await runSuite(cases, 'fail-suite', { iterations: 5, warmup: 1 });
    assert.equal(result.fastest, '(none)');
    assert.equal(result.slowest, '(none)');
    assert.ok(result.results.every((r) => r.error));
  });

  // 8. Stats correctness
  await test('stats are internally consistent', async () => {
    const result = await runCase(
      { name: 'stats', fn: () => { let x = 0; for (let i = 0; i < 500; i++) x += i; } },
      { iterations: 30, warmup: 3 }
    );
    // min <= median <= max
    assert.ok(result.minMs <= result.medianMs);
    assert.ok(result.medianMs <= result.maxMs);
    // p95 <= p99
    assert.ok(result.p95Ms <= result.p99Ms);
    // total ≈ sum of samples
    const sampleSum = result.samples.reduce((s, v) => s + v, 0);
    assert.ok(closeTo(result.totalMs, sampleSum, 1));
    // mean * iterations ≈ total
    assert.ok(closeTo(result.meanMs * result.iterations, result.totalMs, 1));
  });

  // 9. Text format
  await test('formatResult text includes key info', async () => {
    const result = await runSuite(
      [
        { name: 'a', fn: () => {} },
        { name: 'b', fn: () => { Math.random(); } },
      ],
      'text-test',
      { iterations: 20, warmup: 3 }
    );
    const text = formatResult(result, 'text');
    assert.ok(text.includes('text-test'));
    assert.ok(text.includes('a'));
    assert.ok(text.includes('b'));
    assert.ok(text.includes('ops/s'));
    assert.ok(text.includes('Fastest'));
  });

  // 10. JSON format
  await test('formatResult json is valid JSON', async () => {
    const result = await runSuite(
      [{ name: 'json-test', fn: () => {} }],
      'json-suite',
      { iterations: 10, warmup: 2 }
    );
    const json = formatResult(result, 'json');
    const parsed = JSON.parse(json);
    assert.equal(parsed.name, 'json-suite');
    assert.ok(Array.isArray(parsed.results));
    assert.ok(parsed.fastest);
  });

  // 11. Markdown format
  await test('formatResult markdown has table structure', async () => {
    const result = await runSuite(
      [{ name: 'md-test', fn: () => {} }],
      'md-suite',
      { iterations: 10, warmup: 2 }
    );
    const md = formatResult(result, 'markdown');
    assert.ok(md.includes('## md-suite'));
    assert.ok(md.includes('| Benchmark'));
    assert.ok(md.includes('md-test'));
    assert.ok(md.includes('**Fastest:**'));
  });

  // 12. Margin of error
  await test('margin of error is reasonable', async () => {
    const result = await runCase(
      { name: 'moe', fn: () => { let x = 0; for (let i = 0; i < 100; i++) x += i; } },
      { iterations: 100, warmup: 10 }
    );
    // MoE should be between 0 and 1
    assert.ok(result.marginOfError >= 0);
    assert.ok(result.marginOfError <= 1);
  });

  // 13. Warmup doesn't count as iterations
  await test('warmup iterations are not in samples', async () => {
    const result = await runCase(
      { name: 'warmup-test', fn: () => {} },
      { iterations: 25, warmup: 15 }
    );
    assert.equal(result.samples.length, 25);
  });

  // 14. Lifecycle hooks
  await test('setup and teardown are called', async () => {
    let setupCount = 0;
    let teardownCount = 0;
    const result = await runCase(
      {
        name: 'lifecycle',
        fn: () => {},
        setup: () => { setupCount++; },
        teardown: () => { teardownCount++; },
      },
      { iterations: 10, warmup: 2 }
    );
    assert.ok(setupCount >= 10, `setup called ${setupCount} times`);
    assert.ok(teardownCount >= 10, `teardown called ${teardownCount} times`);
    assert.ok(!result.error);
  });

  // 15. Async functions
  await test('async benchmark functions work', async () => {
    const result = await runCase(
      {
        name: 'async',
        fn: async () => {
          await new Promise((r) => setTimeout(r, 1));
        },
      },
      { iterations: 10, warmup: 2, iterTimeout: 10000, maxTime: 30000 }
    );
    assert.ok(result.meanMs >= 0.5, `mean ${result.meanMs} should be >= 0.5ms`);
    assert.ok(!result.error);
  });

  // 16. bench() convenience function
  await test('bench() convenience function returns formatted string', async () => {
    const output = await bench(
      [{ name: 'conv', fn: () => {} }],
      { iterations: 10, warmup: 2, format: 'text', suiteName: 'convenience' }
    );
    assert.ok(typeof output === 'string');
    assert.ok(output.includes('convenience'));
  });

  // 17. Max time bail
  await test('maxTime causes early bail', async () => {
    const result = await runCase(
      {
        name: 'slow',
        fn: async () => {
          await new Promise((r) => setTimeout(r, 50));
        },
      },
      { iterations: 10000, warmup: 1, maxTime: 200, iterTimeout: 10000 }
    );
    // Should have far fewer than 10000 iterations
    assert.ok(result.iterations < 1000, `got ${result.iterations} iterations, expected bail`);
  });

  // 18. Iter timeout bail
  await test('iterTimeout causes bail on slow iteration', async () => {
    let callCount = 0;
    const result = await runCase(
      {
        name: 'timeout-test',
        fn: async () => {
          callCount++;
          // First few are fast, then one is slow
          if (callCount > 3) {
            await new Promise((r) => setTimeout(r, 200));
          }
        },
      },
      { iterations: 20, warmup: 0, iterTimeout: 100, maxTime: 30000 }
    );
    // Should bail when it hits the slow iteration
    assert.ok(result.iterations <= 10, `got ${result.iterations} iterations`);
  });

  // 19. Zero iterations edge case
  await test('zero iterations returns error result', async () => {
    const result = await runCase(
      { name: 'zero', fn: () => {} },
      { iterations: 0, warmup: 0 }
    );
    assert.ok(result.error);
  });

  // 20. Suite name in builder
  await test('suite builder preserves name', async () => {
    const s = suite('custom-name');
    assert.equal(s.name, 'custom-name');
  });

  // Summary
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
