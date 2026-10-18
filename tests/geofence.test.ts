import test from 'node:test'
import assert from 'node:assert/strict'
import {
  distanceMeters,
  canConfirmArrival,
  MAX_ARRIVAL_DISTANCE_M,
} from '../apps/pro/lib/geo'

const client = { lat: -25.9666, lng: 32.5833 }

test('distanceMeters é zero para o mesmo ponto', () => {
  assert.equal(distanceMeters(client, client), 0)
})

test('canConfirmArrival aceita um mestre a ~100 m', () => {
  const provider = { lat: client.lat + 0.0009, lng: client.lng }
  assert.ok(distanceMeters(provider, client) < MAX_ARRIVAL_DISTANCE_M)
  assert.equal(canConfirmArrival(provider, client), true)
})

test('canConfirmArrival recusa um mestre a mais de 200 m', () => {
  const provider = { lat: client.lat + 0.003, lng: client.lng }
  assert.ok(distanceMeters(provider, client) > MAX_ARRIVAL_DISTANCE_M)
  assert.equal(canConfirmArrival(provider, client), false)
})

test('canConfirmArrival respeita um raio personalizado', () => {
  const provider = { lat: client.lat + 0.003, lng: client.lng }
  assert.equal(canConfirmArrival(provider, client, 1000), true)
})
