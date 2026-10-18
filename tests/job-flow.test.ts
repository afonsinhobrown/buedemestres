import test from 'node:test'
import assert from 'node:assert/strict'
import { canTransitionJob, normalizeRequestStatus } from '../apps/web/src/lib/job-flow'

test('o fluxo normal do mestre é permitido', () => {
  assert.equal(canTransitionJob('accepted', 'price_proposed'), true)
  assert.equal(canTransitionJob('price_agreed', 'en_route'), true)
  assert.equal(canTransitionJob('en_route', 'arrived'), true)
  assert.equal(canTransitionJob('arrived', 'in_service'), true)
  assert.equal(canTransitionJob('in_service', 'awaiting_confirmation'), true)
  assert.equal(canTransitionJob('awaiting_confirmation', 'completed'), true)
})

test('não é possível saltar do início para o fim', () => {
  assert.equal(canTransitionJob('accepted', 'completed'), false)
  assert.equal(canTransitionJob('en_route', 'completed'), false)
  assert.equal(canTransitionJob('completed', 'in_service'), false)
})

test('não há transições a partir de estados terminais', () => {
  assert.equal(canTransitionJob('cancelled', 'accepted'), false)
  assert.equal(canTransitionJob('expired', 'accepted'), false)
})

test('os estados de service_request são normalizados para o tracker', () => {
  assert.equal(normalizeRequestStatus('open'), 'pending')
  assert.equal(normalizeRequestStatus('in_negotiation'), 'pending')
  assert.equal(normalizeRequestStatus('price_proposed'), 'price_proposed')
  assert.equal(normalizeRequestStatus('puxado'), 'price_proposed')
  assert.equal(normalizeRequestStatus('in_progress'), 'in_progress')
  assert.equal(normalizeRequestStatus('cancelled'), 'cancelled')
  assert.equal(normalizeRequestStatus('expired'), 'cancelled')
})
