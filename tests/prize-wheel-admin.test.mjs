import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// The app package is CommonJS; transpile this dependency-free TS model as ESM in memory.
const source = readFileSync(new URL('../src/admin/prizeWheel.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const {
  MOCK_WHEEL_CONFIGURATION, MOCK_FULL_WHEEL_CONFIGURATION,
  MOCK_WHEEL_SPINS, MOCK_FULL_WHEEL_SPINS, WHEEL_SPIN_STATUS_LABELS,
  cloneWheelConfiguration, loadWheelConfiguration, saveWheelConfiguration, saveWheelVisibility,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

function storage() {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}

test('MVP contains no claim deadline or audience selector', () => {
  assert.equal('claim_ttl_days' in MOCK_WHEEL_CONFIGURATION, false)
  assert.equal('audience' in MOCK_WHEEL_CONFIGURATION, false)
  assert.equal(MOCK_WHEEL_CONFIGURATION.description, 'Крутите колесо и выигрывайте призы.')
  assert.ok(MOCK_WHEEL_CONFIGURATION.game_rules_url.startsWith('https://'))
  assert.ok(MOCK_WHEEL_CONFIGURATION.prizes.every((prize) => ['bonus', 'promocode'].includes(prize.reward_type)))
})

test('full iteration supports all four prize types and does not reuse MVP rules', () => {
  assert.deepEqual(new Set(MOCK_FULL_WHEEL_CONFIGURATION.prizes.map((prize) => prize.reward_type)), new Set(['bonus', 'promocode', 'activity_points', 'physical_prize']))
  assert.equal(MOCK_FULL_WHEEL_CONFIGURATION.game_rules_url, '')
  const physical = MOCK_FULL_WHEEL_CONFIGURATION.prizes.find((prize) => prize.reward_type === 'physical_prize')
  assert.ok(physical.total_stock > 0)
  const points = MOCK_FULL_WHEEL_CONFIGURATION.prizes.find((prize) => prize.reward_type === 'activity_points')
  assert.ok(points.points_amount > 0 && points.points_ttl_days > 0)
})

test('registry contains only automatic issuance states, errors and fixed prize names', () => {
  assert.deepEqual(Object.keys(WHEEL_SPIN_STATUS_LABELS).sort(), ['reward_failed', 'reward_issued', 'reward_issuing'])
  assert.ok(MOCK_WHEEL_SPINS.every((spin) => spin.prize_display_name && !('claim_until' in spin)))
  assert.ok(MOCK_WHEEL_SPINS.filter((spin) => spin.status === 'reward_failed').every((spin) => spin.error_message))
})

test('full registry preserves MVP wins and demonstrates spending and refunds without duplicate issuance', () => {
  assert.ok(MOCK_WHEEL_SPINS.every((spin) => MOCK_FULL_WHEEL_SPINS.some((item) => item.id === spin.id)))
  const refund = MOCK_FULL_WHEEL_SPINS.find((spin) => spin.points_refunded > 0)
  assert.equal(refund.points_spent, 10)
  assert.equal(refund.points_refunded, 10)
  assert.notEqual(refund.status, 'reward_issued')
})

test('editing a draft does not mutate the source configuration or recorded win', () => {
  const copy = cloneWheelConfiguration(MOCK_WHEEL_CONFIGURATION)
  copy.prizes[0].display_name = 'Changed'
  copy.channels.pop()
  assert.equal(MOCK_WHEEL_CONFIGURATION.prizes[0].display_name, '100 бонусов')
  assert.equal(MOCK_WHEEL_CONFIGURATION.channels.length, 2)
  assert.equal(MOCK_WHEEL_SPINS[1].prize_display_name, '100 бонусов')
})

test('saved settings survive re-entry, demo editions are separate, visibility is shared', () => {
  const cache = storage()
  const config = cloneWheelConfiguration(MOCK_WHEEL_CONFIGURATION)
  config.title = 'Saved title'
  assert.equal(saveWheelConfiguration(config, 'mvp', cache), true)
  assert.equal(saveWheelVisibility(false, cache), true)
  assert.equal(loadWheelConfiguration('mvp', cache).title, 'Saved title')
  assert.equal(loadWheelConfiguration('full', cache).title, MOCK_FULL_WHEEL_CONFIGURATION.title)
  assert.equal(loadWheelConfiguration('mvp', cache).wheel_visibility_enabled, false)
  assert.equal(loadWheelConfiguration('full', cache).wheel_visibility_enabled, false)
  saveWheelVisibility(true, cache)
  assert.equal(loadWheelConfiguration('mvp', cache).wheel_visibility_enabled, true)
})

test('invalid stored JSON falls back to a usable editor', () => {
  const cache = { getItem: () => '{broken', setItem() {} }
  assert.deepEqual(loadWheelConfiguration('mvp', cache), MOCK_WHEEL_CONFIGURATION)
})

test('damaged draft cache does not reset a disabled visibility flag', () => {
  const cache = { getItem: (key) => key.endsWith(':visibility') ? 'false' : '{broken', setItem() {} }
  assert.equal(loadWheelConfiguration('mvp', cache).wheel_visibility_enabled, false)
})

test('storage failure is handled without claiming successful persistence', () => {
  const cache = { getItem() { throw Error('Denied') }, setItem() { throw Error('Quota') } }
  assert.deepEqual(loadWheelConfiguration('mvp', cache), MOCK_WHEEL_CONFIGURATION)
  assert.equal(saveWheelConfiguration(MOCK_WHEEL_CONFIGURATION, 'mvp', cache), false)
  assert.equal(saveWheelVisibility(false, cache), false)
})

test('old demo photos use bundled assets without replacing custom images', () => {
  const cache = storage()
  const config = cloneWheelConfiguration(MOCK_WHEEL_CONFIGURATION)
  config.prizes[0].image_url = 'https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=400&q=80'
  config.prizes[1].image_url = 'https://example.com/custom-prize.webp'
  saveWheelConfiguration(config, 'mvp', cache)
  const loaded = loadWheelConfiguration('mvp', cache)
  assert.equal(loaded.prizes[0].image_url, '/prize-wheel/bonus-100.webp')
  assert.equal(loaded.prizes[1].image_url, 'https://example.com/custom-prize.webp')
})

test('unsupported aggregate counters are absent, including previously saved demo data', () => {
  const keys = ['participants_count', 'spins_count', 'rewards_issued_count', 'errors_count']
  const cache = storage()
  const oldDemo = { ...cloneWheelConfiguration(MOCK_WHEEL_CONFIGURATION), participants_count: 4281, spins_count: 15420, rewards_issued_count: 11166, errors_count: 12 }
  saveWheelConfiguration(oldDemo, 'mvp', cache)
  const loaded = loadWheelConfiguration('mvp', cache)
  for (const key of keys) {
    assert.equal(key in MOCK_WHEEL_CONFIGURATION, false)
    assert.equal(key in MOCK_FULL_WHEEL_CONFIGURATION, false)
    assert.equal(key in loaded, false)
  }
})
