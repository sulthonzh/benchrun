"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * benchrun tests
 */
const index_js_1 = require("./index.js");
const strict_1 = __importDefault(require("node:assert/strict"));
// ── Helpers ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
async function test(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  ✓ ${name}`);
    }
    catch (err) {
        failed++;
        console.error(`  ✗ ${name}: ${err.message}`);
    }
}
function closeTo(a, b, tolerance = 0.5) {
    return Math.abs(a - b) < tolerance;
}
// ── Tests ───────────────────────────────────────────────────────────────
async function main() {
    console.log('\nbenchrun tests\n');
    // 1. Suite builder
    await test('suite builder creates cases', async () => {
        const cases = (0, index_js_1.suite)('test')
            .add('noop', () => { })
            .add('math', () => { Math.sqrt(42); })
            .build();
        strict_1.default.equal(cases.length, 2);
        strict_1.default.equal(cases[0].name, 'noop');
        strict_1.default.equal(cases[1].name, 'math');
    });
    // 2. suite builder with lifecycle
    await test('suite builder addWithLifecycle', async () => {
        let setupCalled = false;
        let teardownCalled = false;
        const cases = (0, index_js_1.suite)('test')
            .addWithLifecycle({
            name: 'with-lifecycle',
            fn: () => {
                strict_1.default.ok(setupCalled, 'setup should run before fn');
            },
            setup: () => { setupCalled = true; },
            teardown: () => { teardownCalled = true; },
        })
            .build();
        strict_1.default.equal(cases.length, 1);
        strict_1.default.equal(cases[0].name, 'with-lifecycle');
        strict_1.default.ok(cases[0].setup);
        strict_1.default.ok(cases[0].teardown);
    });
    // 3. Run a simple case
    await test('runCase returns valid stats', async () => {
        const result = await (0, index_js_1.runCase)({ name: 'simple', fn: () => { let s = 0; for (let i = 0; i < 100; i++)
                s += i; } }, { iterations: 50, warmup: 5, maxTime: 5000 });
        strict_1.default.equal(result.name, 'simple');
        strict_1.default.equal(result.iterations, 50);
        strict_1.default.ok(result.meanMs >= 0);
        strict_1.default.ok(result.opsPerSec > 0);
        strict_1.default.ok(result.samples.length === 50);
        strict_1.default.ok(!result.error);
    });
    // 4. Run a fast case
    await test('runCase handles very fast functions', async () => {
        const result = await (0, index_js_1.runCase)({ name: 'fast', fn: () => { } }, { iterations: 100, warmup: 5 });
        strict_1.default.ok(result.meanMs >= 0);
        strict_1.default.ok(result.opsPerSec > 0 || result.meanMs === 0);
        strict_1.default.equal(result.iterations, 100);
    });
    // 5. Run a case with error
    await test('runCase captures errors', async () => {
        const result = await (0, index_js_1.runCase)({ name: 'broken', fn: () => { throw new Error('boom'); } }, { iterations: 10, warmup: 2 });
        strict_1.default.ok(result.error);
        strict_1.default.ok(result.error.includes('boom'));
    });
    // 6. Run a suite with multiple cases
    await test('runSuite returns SuiteResult with fastest/slowest', async () => {
        const cases = [
            { name: 'fast', fn: () => { } },
            { name: 'slow', fn: () => { for (let i = 0; i < 10000; i++)
                    Math.random(); } },
        ];
        const result = await (0, index_js_1.runSuite)(cases, 'my suite', { iterations: 50, warmup: 5 });
        strict_1.default.equal(result.name, 'my suite');
        strict_1.default.equal(result.results.length, 2);
        strict_1.default.equal(result.fastest, 'fast');
        strict_1.default.equal(result.slowest, 'slow');
    });
    // 7. Suite with all errors
    await test('runSuite handles all-failing cases', async () => {
        const cases = [
            { name: 'fail1', fn: () => { throw new Error('err1'); } },
            { name: 'fail2', fn: () => { throw new Error('err2'); } },
        ];
        const result = await (0, index_js_1.runSuite)(cases, 'fail-suite', { iterations: 5, warmup: 1 });
        strict_1.default.equal(result.fastest, '(none)');
        strict_1.default.equal(result.slowest, '(none)');
        strict_1.default.ok(result.results.every((r) => r.error));
    });
    // 8. Stats correctness
    await test('stats are internally consistent', async () => {
        const result = await (0, index_js_1.runCase)({ name: 'stats', fn: () => { let x = 0; for (let i = 0; i < 500; i++)
                x += i; } }, { iterations: 30, warmup: 3 });
        // min <= median <= max
        strict_1.default.ok(result.minMs <= result.medianMs);
        strict_1.default.ok(result.medianMs <= result.maxMs);
        // p95 <= p99
        strict_1.default.ok(result.p95Ms <= result.p99Ms);
        // total ≈ sum of samples
        const sampleSum = result.samples.reduce((s, v) => s + v, 0);
        strict_1.default.ok(closeTo(result.totalMs, sampleSum, 1));
        // mean * iterations ≈ total
        strict_1.default.ok(closeTo(result.meanMs * result.iterations, result.totalMs, 1));
    });
    // 9. Text format
    await test('formatResult text includes key info', async () => {
        const result = await (0, index_js_1.runSuite)([
            { name: 'a', fn: () => { } },
            { name: 'b', fn: () => { Math.random(); } },
        ], 'text-test', { iterations: 20, warmup: 3 });
        const text = (0, index_js_1.formatResult)(result, 'text');
        strict_1.default.ok(text.includes('text-test'));
        strict_1.default.ok(text.includes('a'));
        strict_1.default.ok(text.includes('b'));
        strict_1.default.ok(text.includes('ops/s'));
        strict_1.default.ok(text.includes('Fastest'));
    });
    // 10. JSON format
    await test('formatResult json is valid JSON', async () => {
        const result = await (0, index_js_1.runSuite)([{ name: 'json-test', fn: () => { } }], 'json-suite', { iterations: 10, warmup: 2 });
        const json = (0, index_js_1.formatResult)(result, 'json');
        const parsed = JSON.parse(json);
        strict_1.default.equal(parsed.name, 'json-suite');
        strict_1.default.ok(Array.isArray(parsed.results));
        strict_1.default.ok(parsed.fastest);
    });
    // 11. Markdown format
    await test('formatResult markdown has table structure', async () => {
        const result = await (0, index_js_1.runSuite)([{ name: 'md-test', fn: () => { } }], 'md-suite', { iterations: 10, warmup: 2 });
        const md = (0, index_js_1.formatResult)(result, 'markdown');
        strict_1.default.ok(md.includes('## md-suite'));
        strict_1.default.ok(md.includes('| Benchmark'));
        strict_1.default.ok(md.includes('md-test'));
        strict_1.default.ok(md.includes('**Fastest:**'));
    });
    // 12. Margin of error
    await test('margin of error is reasonable', async () => {
        const result = await (0, index_js_1.runCase)({ name: 'moe', fn: () => { let x = 0; for (let i = 0; i < 100; i++)
                x += i; } }, { iterations: 100, warmup: 10 });
        // MoE should be between 0 and 1
        strict_1.default.ok(result.marginOfError >= 0);
        strict_1.default.ok(result.marginOfError <= 1);
    });
    // 13. Warmup doesn't count as iterations
    await test('warmup iterations are not in samples', async () => {
        const result = await (0, index_js_1.runCase)({ name: 'warmup-test', fn: () => { } }, { iterations: 25, warmup: 15 });
        strict_1.default.equal(result.samples.length, 25);
    });
    // 14. Lifecycle hooks
    await test('setup and teardown are called', async () => {
        let setupCount = 0;
        let teardownCount = 0;
        const result = await (0, index_js_1.runCase)({
            name: 'lifecycle',
            fn: () => { },
            setup: () => { setupCount++; },
            teardown: () => { teardownCount++; },
        }, { iterations: 10, warmup: 2 });
        strict_1.default.ok(setupCount >= 10, `setup called ${setupCount} times`);
        strict_1.default.ok(teardownCount >= 10, `teardown called ${teardownCount} times`);
        strict_1.default.ok(!result.error);
    });
    // 15. Async functions
    await test('async benchmark functions work', async () => {
        const result = await (0, index_js_1.runCase)({
            name: 'async',
            fn: async () => {
                await new Promise((r) => setTimeout(r, 1));
            },
        }, { iterations: 10, warmup: 2, iterTimeout: 10000, maxTime: 30000 });
        strict_1.default.ok(result.meanMs >= 0.5, `mean ${result.meanMs} should be >= 0.5ms`);
        strict_1.default.ok(!result.error);
    });
    // 16. bench() convenience function
    await test('bench() convenience function returns formatted string', async () => {
        const output = await (0, index_js_1.bench)([{ name: 'conv', fn: () => { } }], { iterations: 10, warmup: 2, format: 'text', suiteName: 'convenience' });
        strict_1.default.ok(typeof output === 'string');
        strict_1.default.ok(output.includes('convenience'));
    });
    // 17. Max time bail
    await test('maxTime causes early bail', async () => {
        const result = await (0, index_js_1.runCase)({
            name: 'slow',
            fn: async () => {
                await new Promise((r) => setTimeout(r, 50));
            },
        }, { iterations: 10000, warmup: 1, maxTime: 200, iterTimeout: 10000 });
        // Should have far fewer than 10000 iterations
        strict_1.default.ok(result.iterations < 1000, `got ${result.iterations} iterations, expected bail`);
    });
    // 18. Iter timeout bail
    await test('iterTimeout causes bail on slow iteration', async () => {
        let callCount = 0;
        const result = await (0, index_js_1.runCase)({
            name: 'timeout-test',
            fn: async () => {
                callCount++;
                // First few are fast, then one is slow
                if (callCount > 3) {
                    await new Promise((r) => setTimeout(r, 200));
                }
            },
        }, { iterations: 20, warmup: 0, iterTimeout: 100, maxTime: 30000 });
        // Should bail when it hits the slow iteration
        strict_1.default.ok(result.iterations <= 10, `got ${result.iterations} iterations`);
    });
    // 19. Zero iterations edge case
    await test('zero iterations returns error result', async () => {
        const result = await (0, index_js_1.runCase)({ name: 'zero', fn: () => { } }, { iterations: 0, warmup: 0 });
        strict_1.default.ok(result.error);
    });
    // 20. Suite name in builder
    await test('suite builder preserves name', async () => {
        const s = (0, index_js_1.suite)('custom-name');
        strict_1.default.equal(s.name, 'custom-name');
    });
    // Summary
    console.log(`\n  ${passed} passed, ${failed} failed\n`);
    if (failed > 0)
        process.exit(1);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
