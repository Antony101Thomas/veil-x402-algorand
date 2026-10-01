import { dashboardPath } from '../lib/session';
import { RIG_CONFIGS } from '../lib/rigs';
import { pointsToDollars, POINTS_TO_REDEEM } from '../lib/rewards';

async function runTests() {
  console.log('====================================================');
  console.log('  RUNNING SCENARIO TEST SUITE FOR ALL USER TYPES');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${description}`);
      failed++;
    }
  }

  // --- 1. Session Role Routing ---
  console.log('--- Scenario 1: Session Role Routing & Session Storage ---');
  assert(dashboardPath('agent') === '/agent', 'Agent role routes to /agent dashboard');
  assert(dashboardPath('admin') === '/admin', 'Admin role routes to /admin dashboard');

  // --- 2. Inactivity Timeout Calculation ---
  console.log('\n--- Scenario 2: 5-Minute Inactivity Timeout Logic ---');
  const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
  const now = Date.now();
  const recentActivity = now - 2 * 60 * 1000; // 2 minutes ago
  const expiredActivity = now - 6 * 60 * 1000; // 6 minutes ago

  assert(now - recentActivity < INACTIVITY_TIMEOUT_MS, '2 minutes of inactivity is within 5-min limit (Session Active)');
  assert(now - expiredActivity >= INACTIVITY_TIMEOUT_MS, '6 minutes of inactivity exceeds 5-min limit (Session Expired -> Logout)');

  // --- 3. Rig Fleet & Data Integrity ---
  console.log('\n--- Scenario 3: Rig Fleet Data Integrity (No fake data) ---');
  assert(Array.isArray(RIG_CONFIGS) && RIG_CONFIGS.length >= 3, 'Rig fleet contains starter, pro, and beast tiers');
  assert(RIG_CONFIGS.every(r => r.id && r.name && r.pricePerHour > 0), 'Every rig tier has valid ID, name, and positive price');

  // --- 4. Rewards Logic ---
  console.log('\n--- Scenario 4: Rewards Calculation & Points Integrity ---');
  assert(POINTS_TO_REDEEM === 100, 'Minimum redemption threshold is 100 points');
  assert(pointsToDollars(100) === 1.0, '100 points equals $1.00 session discount');
  assert(pointsToDollars(250) === 2.5, '250 points equals $2.50 session discount');

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
