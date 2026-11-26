import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCategoryTree,
  distanceKm,
  findCategoryBySlug,
  formatDistanceKm,
  ratingLabel,
  type CategoryRow,
} from '../apps/web/src/lib/discovery'

const rows: CategoryRow[] = [
  { id: 1, slug: 'automovel', name: 'Automóvel', icon: '🚗', parent_id: null, provider_count: 0 },
  { id: 2, slug: 'mecanico', name: 'Mecânico', icon: null, parent_id: 1, provider_count: 3 },
  { id: 3, slug: 'electricista-auto', name: 'Electricista Auto', icon: null, parent_id: 1, provider_count: 1 },
  { id: 4, slug: 'casa', name: 'Casa', icon: '🏠', parent_id: null, provider_count: 1 },
]

test('a árvore de categorias soma os fornecedores dos filhos ao pai', () => {
  const tree = buildCategoryTree(rows)
  assert.equal(tree.length, 2)
  assert.equal(tree[0].slug, 'automovel')
  assert.equal(tree[0].totalProviders, 4)
  assert.equal(tree[0].children.length, 2)
  assert.equal(tree[1].totalProviders, 1)
})

test('encontra uma categoria por slug e por id, devolvendo o pai', () => {
  const tree = buildCategoryTree(rows)
  assert.equal(findCategoryBySlug(tree, 'mecanico')?.category.id, 2)
  assert.equal(findCategoryBySlug(tree, 'mecanico')?.parent?.id, 1)
  assert.equal(findCategoryBySlug(tree, 4)?.category.slug, 'casa')
  assert.equal(findCategoryBySlug(tree, 'inexistente'), null)
})

test('o rating mostra Novo quando ainda não há avaliações', () => {
  assert.deepEqual(ratingLabel(0, 0), { label: 'Novo', isNew: true })
  assert.deepEqual(ratingLabel(4.86, 12), { label: '4,9', isNew: false })
})

test('a distância é calculada em km e formatada em metros ou km', () => {
  const maputo = { lat: -25.9666, lng: 32.5833 }
  const near = { lat: -25.9666, lng: 32.5933 }
  const km = distanceKm(maputo, near)
  assert.ok(km > 0.9 && km < 1.1)
  assert.match(formatDistanceKm(0.42), /m$/)
  assert.match(formatDistanceKm(1.24), /km$/)
  assert.equal(formatDistanceKm(0), '1 m')
})
