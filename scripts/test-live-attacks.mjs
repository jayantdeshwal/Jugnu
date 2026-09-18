// Live attack simulation test against Supabase PostgREST & RPC endpoints
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://omoqfizkkccaewiodyef.supabase.co';
const supabaseAnonKey = 'sb_publishable_HXBh8Zpc6K1EQq832IANuw_KlnueKo-';

const anonClient = createClient(supabaseUrl, supabaseAnonKey);

console.log('================================================================');
console.log('⚔️  Phase 2A Live Attack Simulation (Anonymous / Untrusted Caller)');
console.log('================================================================\n');

async function runAttackTests() {
  const results = [];

  // Attack 1: Anonymous attempt to invoke promote_to_admin
  try {
    const { data, error } = await anonClient.rpc('promote_to_admin', { user_email: 'attacker@evil.com' });
    if (error) {
      results.push({
        name: 'Attack 1: Invoke promote_to_admin',
        expected: 'BLOCKED / NOT FOUND',
        status: 'PASSED',
        detail: `Blocked by database: ${error.message} (${error.code})`
      });
    } else {
      results.push({
        name: 'Attack 1: Invoke promote_to_admin',
        expected: 'BLOCKED / NOT FOUND',
        status: 'FAILED',
        detail: 'Backdoor function executed successfully! VULNERABLE!'
      });
    }
  } catch (err) {
    results.push({
      name: 'Attack 1: Invoke promote_to_admin',
      expected: 'BLOCKED / NOT FOUND',
      status: 'PASSED',
      detail: `Exception caught: ${err.message}`
    });
  }

  // Attack 2: Anonymous attempt to call review_worker RPC
  try {
    const { data, error } = await anonClient.rpc('review_worker', {
      target_worker_id: '00000000-0000-0000-0000-000000000000',
      decision: 'approved'
    });
    if (error) {
      results.push({
        name: 'Attack 2: Invoke review_worker',
        expected: 'DENIED / UNAUTHORIZED',
        status: 'PASSED',
        detail: `Blocked: ${error.message}`
      });
    } else {
      results.push({
        name: 'Attack 2: Invoke review_worker',
        expected: 'DENIED / UNAUTHORIZED',
        status: 'FAILED',
        detail: 'Anon executed review_worker! VULNERABLE!'
      });
    }
  } catch (err) {
    results.push({
      name: 'Attack 2: Invoke review_worker',
      expected: 'DENIED / UNAUTHORIZED',
      status: 'PASSED',
      detail: `Exception: ${err.message}`
    });
  }

  // Attack 3: Anonymous attempt to call admin_create_sub_admin
  try {
    const { data, error } = await anonClient.rpc('admin_create_sub_admin', {
      admin_email: 'attacker@evil.com',
      admin_password: 'Password123!',
      admin_full_name: 'Attacker Admin',
      admin_phone: '9999999999'
    });
    if (error) {
      results.push({
        name: 'Attack 3: Invoke admin_create_sub_admin',
        expected: 'DENIED / UNAUTHORIZED',
        status: 'PASSED',
        detail: `Blocked: ${error.message}`
      });
    } else {
      results.push({
        name: 'Attack 3: Invoke admin_create_sub_admin',
        expected: 'DENIED / UNAUTHORIZED',
        status: 'FAILED',
        detail: 'Anon created sub-admin! VULNERABLE!'
      });
    }
  } catch (err) {
    results.push({
      name: 'Attack 3: Invoke admin_create_sub_admin',
      expected: 'DENIED / UNAUTHORIZED',
      status: 'PASSED',
      detail: `Exception: ${err.message}`
    });
  }

  // Attack 4: Anonymous attempt to call get_admin_workers
  try {
    const { data, error } = await anonClient.rpc('get_admin_workers');
    if (error) {
      results.push({
        name: 'Attack 4: Invoke get_admin_workers',
        expected: 'DENIED / UNAUTHORIZED',
        status: 'PASSED',
        detail: `Blocked: ${error.message}`
      });
    } else {
      results.push({
        name: 'Attack 4: Invoke get_admin_workers',
        expected: 'DENIED / UNAUTHORIZED',
        status: 'FAILED',
        detail: 'Anon fetched workers data via RPC! VULNERABLE!'
      });
    }
  } catch (err) {
    results.push({
      name: 'Attack 4: Invoke get_admin_workers',
      expected: 'DENIED / UNAUTHORIZED',
      status: 'PASSED',
      detail: `Exception: ${err.message}`
    });
  }

  // Attack 5: Anonymous attempt to call get_admin_team
  try {
    const { data, error } = await anonClient.rpc('get_admin_team');
    if (error) {
      results.push({
        name: 'Attack 5: Invoke get_admin_team',
        expected: 'DENIED / UNAUTHORIZED',
        status: 'PASSED',
        detail: `Blocked: ${error.message}`
      });
    } else {
      results.push({
        name: 'Attack 5: Invoke get_admin_team',
        expected: 'DENIED / UNAUTHORIZED',
        status: 'FAILED',
        detail: 'Anon fetched admin team via RPC! VULNERABLE!'
      });
    }
  } catch (err) {
    results.push({
      name: 'Attack 5: Invoke get_admin_team',
      expected: 'DENIED / UNAUTHORIZED',
      status: 'PASSED',
      detail: `Exception: ${err.message}`
    });
  }

  // Attack 6: Anonymous direct UPDATE on profiles to change role to super_admin or admin
  try {
    const { data, error } = await anonClient
      .from('profiles')
      .update({ role: 'super_admin' })
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    // In PostgREST, RLS USING (id = auth.uid()) means anon matches 0 rows or is rejected
    if (error || !data || data.length === 0) {
      results.push({
        name: 'Attack 6: Direct PostgREST UPDATE profiles.role',
        expected: 'BLOCKED / 0 ROWS UPDATED',
        status: 'PASSED',
        detail: error ? `Rejected: ${error.message}` : 'Blocked by RLS / 0 rows affected'
      });
    } else {
      results.push({
        name: 'Attack 6: Direct PostgREST UPDATE profiles.role',
        expected: 'BLOCKED / 0 ROWS UPDATED',
        status: 'FAILED',
        detail: `Tampered with ${data.length} profiles! VULNERABLE!`
      });
    }
  } catch (err) {
    results.push({
      name: 'Attack 6: Direct PostgREST UPDATE profiles.role',
      expected: 'BLOCKED / 0 ROWS UPDATED',
      status: 'PASSED',
      detail: `Exception: ${err.message}`
    });
  }

  for (const r of results) {
    const icon = r.status === 'PASSED' ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    console.log(`   Expected: ${r.expected}`);
    console.log(`   Result:   ${r.detail}\n`);
  }

  const allPassed = results.every(r => r.status === 'PASSED');
  console.log('----------------------------------------------------------------');
  console.log(`Result: ${results.filter(r => r.status === 'PASSED').length}/${results.length} Attacks Defeated.`);
  if (allPassed) {
    console.log('🛡️ All live attack vectors successfully blocked.');
  } else {
    console.error('⚠️ Vulnerabilities detected.');
    process.exit(1);
  }
}

runAttackTests().catch(console.error);
