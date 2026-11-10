/**
 * Tests for the global heavy-job concurrency cap. Run:
 *   node --test middleware/concurrencyLimiter.test.mjs
 * MAX_CONCURRENT_HEAVY_JOBS is read at import, so set it before importing.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

// Static `import` is hoisted above any top-level statement, so set the cap BEFORE the
// module is evaluated by loading it with a dynamic import (not hoisted).
process.env.MAX_CONCURRENT_HEAVY_JOBS = '2'
const { heavyJobLimiter, activeHeavyJobs } = await import('./concurrencyLimiter.js')

function fakeRes() {
  const res = new EventEmitter()
  res.statusCode = 200
  res.headers = {}
  res.setHeader = (k, v) => {
    res.headers[k] = v
  }
  res.status = (c) => {
    res.statusCode = c
    return res
  }
  res.json = (b) => {
    res.body = b
    return res
  }
  return res
}

function run() {
  const res = fakeRes()
  let nexted = false
  heavyJobLimiter({ headers: {} }, res, () => {
    nexted = true
  })
  return { res, nexted }
}

test('admits up to the cap, rejects the overflow with 503 + Retry-After', () => {
  const a = run()
  const b = run()
  assert.equal(a.nexted, true)
  assert.equal(b.nexted, true)
  assert.equal(activeHeavyJobs(), 2)

  const c = run()
  assert.equal(c.nexted, false, 'third concurrent job should be rejected')
  assert.equal(c.res.statusCode, 503)
  assert.equal(c.res.body.error, 'server_busy')
  assert.equal(c.res.headers['Retry-After'], '10')

  // Finishing one frees a slot for the next request.
  a.res.emit('finish')
  assert.equal(activeHeavyJobs(), 1)
  const d = run()
  assert.equal(d.nexted, true)

  // Clean up remaining in-flight counters so the module is left at zero.
  b.res.emit('finish')
  d.res.emit('finish')
  assert.equal(activeHeavyJobs(), 0)
})

test('double finish/close does not double-decrement', () => {
  const a = run()
  assert.equal(activeHeavyJobs(), 1)
  a.res.emit('finish')
  a.res.emit('close')
  assert.equal(activeHeavyJobs(), 0)
})
