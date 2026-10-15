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
  cloneWheelConfiguration, loadWheelConfiguration, saveWheelConfiguration, saveWheelVisibility, getMockBaseProbabilities,
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

// Traceability: MVP PRD §§6–11, backend MVP §§2–3,7,9; full PRD §§5–7.
// These are prototype property names, not a claim about an implemented API schema.
test('configuration and registry expose only PRD-backed information', () => {
  const configKeys = ['id', 'title', 'description', 'wheel_visibility_enabled', 'channels', 'game_rules_url', 'config_version', 'prizes'].sort()
  const prizeKeys = ['id', 'display_name', 'description', 'image_url', 'action_button_text', 'action_button_url', 'display_from', 'display_to', 'selection_weight', 'total_stock', 'repeatable_per_user', 'status', 'visual_order', 'reward_type', 'one_c_marketing_event_id', 'bonus_amount', 'points_amount', 'points_ttl_days', 'promocode_mode', 'personal_promocode_template_key', 'shared_promocode_code'].sort()
  const spinKeys = ['id', 'config_version', 'user_id', 'prize_id', 'prize_display_name', 'reward_type', 'status', 'created_at', 'external_operation_id', 'error_message', 'payment_method', 'points_spent', 'points_refunded'].sort()
  for (const config of [MOCK_WHEEL_CONFIGURATION, MOCK_FULL_WHEEL_CONFIGURATION]) {
    assert.deepEqual(Object.keys(config).sort(), configKeys)
    for (const prize of config.prizes) assert.deepEqual(Object.keys(prize).sort(), prizeKeys)
  }
  for (const spin of MOCK_FULL_WHEEL_SPINS) assert.deepEqual(Object.keys(spin).sort(), spinKeys)
})

test('saved legacy demo fields cannot reappear after reload', () => {
  const cache = storage()
  const oldDemo = { ...cloneWheelConfiguration(MOCK_WHEEL_CONFIGURATION), audience: 'test_group', claim_ttl_days: 7, initial_free_spins: 5 }
  oldDemo.prizes[0].issued_count = 6180
  // Seed the legacy cache directly to test loading as well as serialization.
  cache.setItem('05ru-wheel-admin-prototype-v2:mvp', JSON.stringify(oldDemo))
  const loaded = loadWheelConfiguration('mvp', cache)
  for (const key of ['audience', 'claim_ttl_days', 'initial_free_spins']) assert.equal(key in loaded, false)
  assert.equal('issued_count' in loaded.prizes[0], false)
  saveWheelConfiguration(oldDemo, 'mvp', cache)
  const saved = JSON.parse(cache.getItem('05ru-wheel-admin-prototype-v2:mvp'))
  assert.equal('issued_count' in saved.prizes[0], false)
  assert.equal('audience' in saved, false)
  assert.equal(oldDemo.prizes[0].issued_count, 6180, 'migration must not mutate caller data')
})

test('zero stock is unavailable and backend probability mock respects period, status and weights', () => {
  const config = cloneWheelConfiguration(MOCK_WHEEL_CONFIGURATION)
  const now = new Date('2026-10-15T12:00:00')
  config.prizes[0].total_stock = 0
  config.prizes[1].selection_weight = 3
  config.prizes[2].selection_weight = 1
  const probabilities = getMockBaseProbabilities(config.prizes, now)
  assert.equal(probabilities[config.prizes[0].id], 0)
  assert.equal(probabilities[config.prizes[1].id], 75)
  assert.equal(probabilities[config.prizes[2].id], 25)
  config.prizes[1].status = 'inactive'
  config.prizes[2].display_to = '2026-10-14T23:59'
  assert.ok(Object.values(getMockBaseProbabilities(config.prizes, now)).every((value) => value === 0))
})

test('admin has no unsupported registry counters, phone, filters or second image field', () => {
  const admin = readFileSync(new URL('../src/components/PrizeWheelSection.tsx', import.meta.url), 'utf8')
  for (const forbidden of ['spin.phone', 'spin.retries', 'spinFilters', 'issued_count', 'effectiveProbability', 'claim_until', 'claim_ttl_days']) {
    assert.equal(admin.includes(forbidden), false, forbidden)
  }
  assert.equal(admin.includes('value={selectedPrize.image_url}'), false)
  assert.ok(admin.includes('readOnly'), 'the five-spin rule is not editable')
  assert.ok(admin.includes('value={form.title}') && admin.includes('value={form.description}'), 'MVP PRD §§6,11 explicitly require editable screen texts')
})
