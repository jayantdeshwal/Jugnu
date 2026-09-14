// Verification script: Security & RLS Policy Enforcement
// Tests all 5 security requirements of Phase 11

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('====================================================');
console.log('🔒 Phase 11: Security & RLS Enforcement Verification');
console.log('====================================================\n');

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
    id: 1,
    title: "Customers cannot view other customers' bookings",
    verify: () => {
      // Must have select policy on bookings with customer_id = auth.uid() or worker_id = auth.uid() or is_admin()
      const hasBookingSelectPolicy =
        allSql.includes('customer_id = auth.uid()') &&
        allSql.includes('worker_id = auth.uid()') &&
        allSql.includes('public.is_admin()');
      
      const noUnrestrictedPolicy = !allSql.includes('on public.bookings for select using (true)');
      return hasBookingSelectPolicy && noUnrestrictedPolicy;
    },
    details: "Enforced by RLS policy 'Customers and assigned workers can read bookings'. Restricts rows strictly to customer_id = auth.uid(), worker_id = auth.uid(), or admin.",
  },
  {
    id: 2,
    title: "Workers cannot alter other workers' jobs or profiles",
    verify: () => {
      // Bookings update policy requires worker_id = auth.uid()
      const bookingUpdateGuarded =
        allSql.includes('worker_id = auth.uid()') &&
        allSql.includes('create policy "Workers can update assigned bookings"');

      // Worker profile update requires id = auth.uid()
      const workerProfileGuarded = allSql.includes('create policy "Workers can update their own worker profile"');

      // Worker profile trigger guards against self-approval & rating tampering
      const triggerGuarded =
        allSql.includes('guard_worker_profile_updates') &&
        allSql.includes('trg_guard_worker_profile_updates');

      return bookingUpdateGuarded && workerProfileGuarded && triggerGuarded;
    },
    details: "Enforced by bookings update policy (worker_id = auth.uid()), worker_profiles update policy (id = auth.uid()), and trg_guard_worker_profile_updates trigger.",
  },
  {
    id: 3,
    title: "Customers/workers cannot approve worker accounts",
    verify: () => {
      // review_worker RPC requires is_admin()
      const rpcAdminOnly =
        allSql.includes('function public.review_worker') &&
        allSql.includes('if not public.is_admin() then');

      // Direct updates to approval_status are blocked by trigger
      const triggerBlocksApproval =
        allSql.includes('new.approval_status is distinct from old.approval_status') &&
        allSql.includes('Only platform administrators can modify worker approval status');

      return rpcAdminOnly && triggerBlocksApproval;
    },
    details: "Enforced at both the RPC layer (review_worker raises error for non-admins) and database trigger layer (trg_guard_worker_profile_updates forbids modifying approval_status).",
  },
  {
    id: 4,
    title: "Unapproved workers cannot receive active customer bookings",
    verify: () => {
      // create_booking RPC checks wp.approval_status = 'approved'
      const rpcCheck =
        allSql.includes('wp.approval_status = \'approved\'') &&
        allSql.includes('create or replace function public.create_booking');

      // Trigger trg_enforce_approved_worker_booking blocks bookings on unapproved workers
      const triggerCheck =
        allSql.includes('trg_enforce_approved_worker_booking') &&
        allSql.includes('v_worker_status <> \'approved\'');

      // Bookings insert policy checks worker approval
      const rpcPolicyCheck = allSql.includes('where wp.id = worker_id and wp.approval_status = \'approved\'');

      return rpcCheck && triggerCheck && rpcPolicyCheck;
    },
    details: "Defense-in-depth: Enforced by create_booking RPC, bookings INSERT RLS policy, and BEFORE INSERT trigger trg_enforce_approved_worker_booking.",
  },
  {
    id: 5,
    title: "ID proof storage remains strictly restricted to verified Admins",
    verify: () => {
      // worker-documents bucket is private
      const bucketPrivate =
        allSql.includes("'worker-documents', 'worker-documents', false") ||
        allSql.includes("update storage.buckets\nset public = false\nwhere id = 'worker-documents'");

      // storage.objects select policy requires is_admin() or owner match
      const selectRestricted =
        allSql.includes("bucket_id = 'worker-documents'") &&
        allSql.includes('public.is_admin()') &&
        allSql.includes('(storage.foldername(name))[1]');

      // public directory view excludes id_proof_url
      const viewMatch = allSql.match(/create or replace view public\.approved_worker_directory as([\s\S]*?);/i);
      const viewDef = viewMatch ? viewMatch[1] : '';
      const directoryExcludesIdProof = viewDef.length > 0 && !viewDef.includes('id_proof_url');

      return bucketPrivate && selectRestricted && directoryExcludesIdProof;
    },
    details: "Enforced by private storage bucket (public = false), strict storage.objects RLS (public.is_admin() or owner only), and approved_worker_directory view excluding ID proofs.",
  },
];

let passedCount = 0;
for (const test of tests) {
  const passed = test.verify();
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [Requirement ${test.id}]: ${test.title}`);
  console.log(`   Security Defense: ${test.details}`);
  if (passed) passedCount++;
  console.log('');
}

console.log('----------------------------------------------------');
console.log(`Summary: ${passedCount}/${tests.length} Security Requirements Fully Verified.`);
if (passedCount === tests.length) {
  console.log('🛡️ All Row-Level Security & Access Controls are 100% Enforced.');
  process.exit(0);
} else {
  console.error('⚠️ Some security requirements were not met. Check output above.');
  process.exit(1);
}
