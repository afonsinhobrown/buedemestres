import test from 'node:test'
import assert from 'node:assert/strict'
import { canConfirmPayment, canFailPayment } from '../apps/web/src/lib/job-payment-state'

test('uma falha só é aplicada a pagamentos ainda pendentes', () => {
  assert.equal(canFailPayment('pending_payment'), true)
  assert.equal(canFailPayment('failed'), false)
  assert.equal(canFailPayment('held'), false)
  assert.equal(canFailPayment('released'), false)
})

test('uma confirmação tardia promove failed para held', () => {
  assert.equal(canConfirmPayment('pending_payment'), true)
  assert.equal(canConfirmPayment('failed'), true)
  assert.equal(canConfirmPayment('held'), false)
  assert.equal(canConfirmPayment('released'), false)
})

test('a corrida confirmação/falha nunca desfaz um pagamento retido', () => {
  assert.equal(canFailPayment('held'), false)
  assert.equal(canConfirmPayment('held'), false)
})
