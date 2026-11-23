import test from 'node:test'
import assert from 'node:assert/strict'
import { haversineKm, sortSearchProviders } from '../apps/web/src/lib/search-map'

const providers = [
  { id: 'a', rating: 4.2, priceMin: 900, lat: -25.96, lng: 32.58 },
  { id: 'b', rating: 4.9, priceMin: null, lat: -25.97, lng: 32.6 },
  { id: 'c', rating: 4.5, priceMin: 500, lat: -25.95, lng: 32.59 },
]

test('haversineKm devolve distância positiva entre coordenadas reais', () => {
  const distance = haversineKm([-25.9655, 32.59], [-25.9755, 32.6])
  assert.ok(distance > 0)
  assert.ok(distance < 5)
})

test('ordena por avaliação e preço sem alterar o array original', () => {
  assert.deepEqual(sortSearchProviders(providers, 'rating', null).map((p) => p.id), ['b', 'c', 'a'])
  assert.deepEqual(sortSearchProviders(providers, 'price', null).map((p) => p.id), ['c', 'a', 'b'])
  assert.deepEqual(providers.map((p) => p.id), ['a', 'b', 'c'])
})

test('ordena por distância quando existe localização do utilizador', () => {
  const origin: [number, number] = [-25.96, 32.58]
  const sorted = sortSearchProviders(providers, 'distance', origin)
  assert.equal(sorted[0].id, 'a')
})
