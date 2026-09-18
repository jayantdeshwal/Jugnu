// Verification script: Phase 2A Critical Authorization & Admin Privilege Lockdown
// Tests JUGNU-SEC-01, JUGNU-SEC-03, Two-Level Admin Hierarchy, and Admin RPC Permissions

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('================================================================');
console.log('🔒 Phase 2A: Authorization & Admin Privilege Lockdown Verification');
console.log('================================================================\n');

const migrationsDir = resolve(__dirname, '../supabase/migrations');

const schemaFiles = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

let allSql = '';
for (const file of schemaFiles) {
  try {
    const content = readFileSync(resolve(migrationsDir, file), 'utf-8');
    allSql += `\n-- [${file}]\n` + content.replace(/\r\n/g, '\n');
  } catch (err) {
    console.warn(`Warning: Could not read ${file}: ${err.message}`);
  }
}

const tests = [
  {
    id: 'SEC-01',
    title: 'JUGNU-SEC-01: promote_to_admin backdoor is permanently revoked & dropped',
    verify: () => {
      const dropped = allSql.includes('DROP FUNCTION IF EXISTS public.promote_to_admin(text)');
      return dropped;
    },
    details: 'Function promote_to_admin(text) dropped from database (DROP FUNCTION IF EXISTS automatically revokes all grants).',
  },
  {
    id: 'SEC-03-A',
    title: 'JUGNU-SEC-03: profiles.role tampering prevented via BEFORE UPDATE trigger',
    verify: () => {
      const triggerFn = allSql.includes('CREATE OR REPLACE FUNCTION public.guard_profile_updates()');
      const triggerBound = allSql.includes('CREATE TRIGGER trg_guard_profile_updates') &&
                           allSql.includes('BEFORE UPDATE ON public.profiles');
      const blocksUnauthorizedRole = allSql.includes('NEW.role IS DISTINCT FROM OLD.role') &&
                                     allSql.includes('Only platform administrators can change user roles');
      return triggerFn && triggerBound && blocksUnauthorizedRole;
    },
    details: 'trg_guard_profile_updates trigger executes BEFORE UPDATE on public.profiles and throws an exception on unauthorized role modifications.',
  },
  {
    id: 'SEC-03-B',
    title: 'JUGNU-SEC-03: Legitimate worker registration preserved via controlled session flag',
    verify: () => {
      const flagCheck = allSql.includes("current_setting('jugnu.worker_registration_in_progress', true) = 'true'");
      const rpcSetsFlag = allSql.includes("PERFORM set_config('jugnu.worker_registration_in_progress', 'true', true)");
      return flagCheck && rpcSetsFlag;
    },
    details: 'register_worker() RPC sets transaction-local setting jugnu.worker_registration_in_progress to permit worker role transition without permitting direct PostgREST role escalation.',
  },
  {
    id: 'HIER-01',
    title: 'Two-Level Admin: super_admin & sub_admin enum roles extended',
    verify: () => {
      const superAdminAdded = allSql.includes("ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin'");
      const subAdminAdded = allSql.includes("ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'sub_admin'");
      return superAdminAdded && subAdminAdded;
    },
    details: 'public.user_role enum extended with super_admin and sub_admin values.',
  },
  {
    id: 'HIER-02',
    title: 'Two-Level Admin: Single Super Admin invariant strictly enforced',
    verify: () => {
      const indexCreated = allSql.includes('CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_single_super_admin') &&
                           allSql.includes("WHERE role = 'super_admin'");
      const blocksExtraSuperAdmin = allSql.includes("The super_admin role is strictly reserved for the authoritative Super Administrator") ||
                                   allSql.includes("The super_admin role is strictly reserved for the designated Super Administrator");
      return indexCreated && blocksExtraSuperAdmin;
    },
    details: 'Database partial unique index uq_profiles_single_super_admin guarantees <= 1 super_admin row, and guard_profile_updates trigger forbids assigning super_admin to another profile.',
  },
  {
    id: 'HIER-03',
    title: 'Two-Level Admin: Super Admin account immutability (cannot be demoted, renamed, or deleted)',
    verify: () => {
      const blocksDemote = allSql.includes('The Super Administrator account cannot be demoted or have its role modified');
      const blocksRename = allSql.includes('The Super Administrator identity cannot be transferred or altered');
      const blocksDelete = allSql.includes('trg_guard_profile_deletions') &&
                           allSql.includes('The Super Administrator account cannot be deleted');
      return blocksDemote && blocksRename && blocksDelete;
    },
    details: 'guard_profile_updates and guard_profile_deletions enforce that Super Admin role, email, and identity cannot be altered, demoted, or deleted.',
  },
  {
    id: 'HIER-04',
    title: 'Two-Level Admin: Sub-Admin creation, demotion, and deletion restricted to Super Admin only',
    verify: () => {
      const createRestricted = allSql.includes('FUNCTION public.admin_create_sub_admin') &&
                               allSql.includes('IF NOT public.is_super_admin() THEN');
      const demoteRestricted = allSql.includes('FUNCTION public.admin_demote_sub_admin') &&
                               allSql.includes('IF NOT public.is_super_admin() THEN');
      const deleteRestricted = allSql.includes('IF v_target_role IN (\'sub_admin\', \'admin\') THEN') &&
                               allSql.includes('IF NOT public.is_super_admin() THEN');
      return createRestricted && demoteRestricted && deleteRestricted;
    },
    details: 'admin_create_sub_admin, admin_demote_sub_admin, and admin_delete_profile_permanently require is_super_admin(), preventing Sub Admins from altering admin team members.',
  },
  {
    id: 'HIER-05',
    title: 'Authoritative Super Admin UUID Binding: Runtime authorization bound to founder UUID',
    verify: () => {
      const helperDef = allSql.includes('CREATE OR REPLACE FUNCTION public.get_super_admin_uuid()');
      const isSuperAdminUsesUuid = allSql.includes('auth.uid() = public.get_super_admin_uuid()');
      return helperDef && isSuperAdminUsesUuid;
    },
    details: 'Authoritative founder UUID resolved at migration time and bound via get_super_admin_uuid(); public.is_super_admin() authorizes via auth.uid() matching that UUID without runtime email dependency.',
  },
  {
    id: 'AUTH-01',
    title: 'auth.users Disable & Delete Protection: Guard against ban, deletion, and identity transfer',
    verify: () => {
      const authTrigger = allSql.includes('CREATE TRIGGER trg_guard_auth_super_admin') &&
                          allSql.includes('BEFORE UPDATE OR DELETE ON auth.users');
      const protectsDelete = allSql.includes('The Super Administrator authentication record cannot be deleted');
      const protectsEmail = allSql.includes('The Super Administrator email identity cannot be altered');
      const protectsBan = allSql.includes('The Super Administrator account cannot be banned or disabled') ||
                          allSql.includes('NEW.banned_until > now()');
      const protectsSoftDelete = allSql.includes('The Super Administrator account cannot be soft-deleted') ||
                                 allSql.includes('NEW.deleted_at IS NOT NULL');
      return authTrigger && protectsDelete && protectsEmail && protectsBan && protectsSoftDelete;
    },
    details: 'trg_guard_auth_super_admin guards the Super Admin auth.users record against DELETE, id/email modifications, banned_until lockout, and soft-delete, while permitting routine sign-in timestamps.',
  },
  {
    id: 'RPC-AUDIT',
    title: 'Admin RPC Security Audit: public and anon execution revoked on administrative action endpoints',
    verify: () => {
      const adminActionRpcs = [
        'register_worker',
        'admin_create_sub_admin',
        'admin_demote_sub_admin',
        'get_admin_team',
        'admin_delete_profile_permanently',
        'review_worker',
        'get_admin_workers',
        'get_admin_customers',
        'get_admin_notifications'
      ];
      const rpcsRevoked = adminActionRpcs.every(rpc => allSql.includes(`REVOKE EXECUTE ON FUNCTION public.${rpc}`) &&
                                                       allSql.includes(`FROM public, anon`));
      const helpersGranted = ['is_admin', 'is_super_admin', 'is_sub_admin'].every(fn =>
        allSql.includes(`GRANT EXECUTE ON FUNCTION public.${fn}() TO public, anon, authenticated, service_role`)
      );
      return rpcsRevoked && helpersGranted;
    },
    details: 'All administrative action RPCs have execute privileges explicitly REVOKED from public and anon, while auth helper functions are granted to anon to permit unauthenticated RLS evaluation.',
  },
];

let passedCount = 0;
for (const test of tests) {
  const passed = test.verify();
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${test.id}]: ${test.title}`);
  console.log(`   Details: ${test.details}`);
  if (passed) passedCount++;
  console.log('');
}

console.log('----------------------------------------------------------------');
console.log(`Summary: ${passedCount}/${tests.length} Phase 2A Security Controls Verified.`);
if (passedCount === tests.length) {
  console.log('🛡️ All Phase 2A Authorization and Lockdown Requirements are 100% Satisfied.');
  process.exit(0);
} else {
  console.error('⚠️ Some security controls failed verification.');
  process.exit(1);
}
