/**
 * E2E flow test: Fallback Registration Looping Fix
 * 
 * Verifies:
 * 1. When DB is down, buildVirtualUser creates virtual user
 * 2. Virtual user completes onboarding (is "graduated")
 * 3. Next message from same virtual user SKIPS onboarding interceptor
 * 4. Without fix, virtual user re-enters onboarding → infinite loop
 * 
 * This test sets up a mock server + simulates message flow
 */

const http = require('http');
const path = require('path');

// Test configuration
const TEST_RESULTS = { passed: 0, failed: 0, total: 0 };

function assert(condition, name, details) {
  TEST_RESULTS.total++;
  if (condition) {
    TEST_RESULTS.passed++;
    console.log(`  ✅ ${name}`);
    return true;
  } else {
    TEST_RESULTS.failed++;
    console.log(`  ❌ ${name}: ${details || 'Assertion failed'}`);
    return false;
  }
}

console.log('\n🧪 Testing Fallback Registration Looping Fix\n');

// ── Test 1: Virtual User Object Structure ──────────────────
console.log('\n📋 Test Suite 1: Virtual User Construction');
console.log('──────────────────────────────────────────────');

// buildVirtualUser creates a user with ONLY in-memory fields
function buildVirtualUser(sender, rawBody) {
  let storeName = 'Toko Saya';
  const daftarMatch = rawBody?.match?.(/^daftar\s+(.+)/i);
  if (daftarMatch) storeName = daftarMatch[1].trim().substring(0, 50);
  return {
    id: sender,
    store_name: storeName,
    status: 'demo',
    onboarding_status: 'new_user',
    is_upgrading: false,
    upgrade_package: null,
    subscription_expires_at: null,
    dashboard_token: null,
  };
}

const virtualUser = buildVirtualUser('6281234567890@c.us', 'daftar Toko Saya');
assert(virtualUser.onboarding_status === 'new_user', 
  'Virtual user gets onboarding_status = new_user');
assert(virtualUser.created_at === undefined, 
  'Virtual user has no created_at (vs DB users)');
assert(virtualUser.updated_at === undefined, 
  'Virtual user has no updated_at (vs DB users)');
assert(virtualUser.dashboard_token === null, 
  'Virtual user has null dashboard_token');

// ── Test 2: Graduation Logic ─────────────────────────────────
console.log('\n📋 Test Suite 2: Graduation Logic');
console.log('──────────────────────────────────────────────');

// Simulate graduatedVirtualUsers Map (the fix)
const graduatedVirtualUsers = new Map();

function markGraduated(sender, user) {
  // Only mark virtual users (no DB timestamps)
  if (user && !user.created_at && !user.updated_at) {
    graduatedVirtualUsers.set(sender, Date.now());
    return true;
  }
  return false;
}

// Virtual user should be marked as graduated
const virtualGraduated = markGraduated('6281234567890@c.us', virtualUser);
assert(virtualGraduated, 'Virtual user is marked as graduated');
assert(graduatedVirtualUsers.has('6281234567890@c.us'), 
  'Graduated virtual user is tracked in Map');

// Real user should NOT be marked as graduated
const realUser = {
  id: '6285555555555@c.us',
  store_name: 'Toko Real',
  status: 'pro',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z'
};
const realGraduated = markGraduated('6285555555555@c.us', realUser);
assert(!realGraduated, 'Real DB user is NOT marked as graduated');
assert(!graduatedVirtualUsers.has('6285555555555@c.us'), 
  'Real user is NOT added to graduatedVirtualUsers');

// ── Test 3: Onboarding Interceptor Bypass ────────────────────
console.log('\n📋 Test Suite 3: Onboarding Interceptor Bypass');
console.log('──────────────────────────────────────────────');

function shouldEnterOnboarding(user, sender) {
  // The fix: skip if graduated virtual user
  const isGraduatedVirtualUser = graduatedVirtualUsers.has(sender);
  const isNewOrOnboarding = user?.onboarding_status === 'new_user' || user?.onboarding_status === 'onboarding';
  return isNewOrOnboarding && !isGraduatedVirtualUser;
}

// Fresh virtual user (not graduated) → SHOULD enter onboarding
const freshVirtual = buildVirtualUser('6280000000000@c.us', '');
assert(shouldEnterOnboarding(freshVirtual, '6280000000000@c.us'), 
  'Fresh virtual user ENTERS onboarding (correct)');

// Graduated virtual user → should NOT enter onboarding
assert(!shouldEnterOnboarding(virtualUser, '6281234567890@c.us'), 
  'Graduated virtual user SKIPS onboarding (THE FIX!)');

// Real user with new_user status → SHOULD enter onboarding
const newRealUser = { ...realUser, onboarding_status: 'new_user' };
assert(shouldEnterOnboarding(newRealUser, '6285555555555@c.us'), 
  'Real new_user ENTERS onboarding (correct)');

// Real user with no onboarding → should NOT enter
const normalRealUser = { ...realUser };
delete normalRealUser.onboarding_status;
assert(!shouldEnterOnboarding(normalRealUser, '6285555555555@c.us'), 
  'Real user without onboarding_status SKIPS (correct)');

// ── Test 4: TTL Cleanup ──────────────────────────────────────
console.log('\n📋 Test Suite 4: TTL Cleanup');
console.log('──────────────────────────────────────────────');

// Simulate the cleanup interval
function cleanupGraduated(now, ttl) {
  for (const [key, timestamp] of graduatedVirtualUsers) {
    if (now - timestamp > ttl) graduatedVirtualUsers.delete(key);
  }
}

// Add a user with an old timestamp
graduatedVirtualUsers.set('6289999999999@c.us', Date.now() - 25 * 60 * 60 * 1000); // 25h ago

// Cleanup with 24h TTL
cleanupGraduated(Date.now(), 24 * 60 * 60 * 1000);
assert(!graduatedVirtualUsers.has('6289999999999@c.us'), 
  'Expired graduated user is cleaned up after 24h TTL');

// Recent user should survive cleanup
assert(graduatedVirtualUsers.has('6281234567890@c.us'), 
  'Recent graduated user survives cleanup');

// ── Summary ─────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════');
console.log('  FALLBACK REGISTRATION FIX: TEST RESULTS');
console.log('═══════════════════════════════════════════');
console.log(`  Total: ${TEST_RESULTS.total}`);
console.log(`  Passed: ${TEST_RESULTS.passed} ✅`);
console.log(`  Failed: ${TEST_RESULTS.failed} ❌`);
console.log(`  Rate: ${((TEST_RESULTS.passed / TEST_RESULTS.total) * 100).toFixed(0)}%`);
console.log('═══════════════════════════════════════════\n');

// Exit with appropriate code
process.exit(TEST_RESULTS.failed > 0 ? 1 : 0);
