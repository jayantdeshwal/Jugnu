// Test Suite for Multi-Service Worker Registration and Discovery Invariants
// Covers business rules, taxonomy integrity, database invariants, and search semantics.

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const JUGNU_CATEGORIES = [
  {
    id: 'home_repair',
    name_en: 'Home Repair & Work',
    name_hi: 'घर की मरम्मत और काम',
    icon: 'home',
    services: [
      { id: 'electrician', name_en: 'Electrician', name_hi: 'बिजली मिस्त्री', icon: 'zap', categoryId: 'home_repair' },
      { id: 'plumber', name_en: 'Plumber', name_hi: 'प्लंबर', icon: 'wrench', categoryId: 'home_repair' },
      { id: 'carpenter', name_en: 'Carpenter', name_hi: 'बढ़ई', icon: 'hammer', categoryId: 'home_repair' },
      { id: 'painter', name_en: 'Painter', name_hi: 'पेंटर', icon: 'brush', categoryId: 'home_repair' },
      { id: 'daily_wage_worker', name_en: 'Daily Wage Worker', name_hi: 'दिहाड़ी मजदूर', icon: 'hammer', categoryId: 'home_repair' },
      { id: 'raj_mistri', name_en: 'Raj Mistri', name_hi: 'राज मिस्त्री', icon: 'wrench', categoryId: 'home_repair' },
    ],
  },
  {
    id: 'appliance_repair',
    name_en: 'Home Appliance Repair',
    name_hi: 'घर के उपकरण मरम्मत',
    icon: 'wrench',
    services: [
      { id: 'ac_repair', name_en: 'AC Repair & Service', name_hi: 'AC मरम्मत और सर्विस', icon: 'snowflake', categoryId: 'appliance_repair' },
      { id: 'refrigerator_repair', name_en: 'Refrigerator Repair', name_hi: 'फ्रिज मरम्मत', icon: 'snowflake', categoryId: 'appliance_repair' },
      { id: 'washing_machine_repair', name_en: 'Washing Machine Repair', name_hi: 'वॉशिंग मशीन मरम्मत', icon: 'cog', categoryId: 'appliance_repair' },
      { id: 'ro_repair', name_en: 'RO Repair', name_hi: 'RO मरम्मत', icon: 'droplets', categoryId: 'appliance_repair' },
      { id: 'geyser_repair', name_en: 'Geyser Repair', name_hi: 'गीजर मरम्मत', icon: 'flame', categoryId: 'appliance_repair' },
    ],
  },
  {
    id: 'beauty_personal_care',
    name_en: 'Beauty & Personal Care',
    name_hi: 'ब्यूटी और व्यक्तिगत देखभाल',
    icon: 'sparkles',
    services: [
      { id: 'parlour_service', name_en: 'Parlour Service', name_hi: 'पार्लर सेवा', icon: 'scissors', categoryId: 'beauty_personal_care' },
      { id: 'nail_extension', name_en: 'Nail Extension', name_hi: 'नेल एक्सटेंशन', icon: 'sparkles', categoryId: 'beauty_personal_care' },
      { id: 'mehendi_artist', name_en: 'Mehendi Artist', name_hi: 'मेहंदी आर्टिस्ट', icon: 'palette', categoryId: 'beauty_personal_care' },
    ],
  },
  {
    id: 'home_help_cleaning',
    name_en: 'Home Help & Cleaning',
    name_hi: 'घरेलू मदद और सफाई',
    icon: 'sparkles',
    services: [
      { id: 'part_time_maid', name_en: 'Part-time Home Maid', name_hi: 'पार्ट-टाइम घरेलू काम', icon: 'user', categoryId: 'home_help_cleaning' },
      { id: 'dry_clean_press', name_en: 'Dry Clean & Press', name_hi: 'ड्राई क्लीन और प्रेस', icon: 'shirt', categoryId: 'home_help_cleaning' },
    ],
  },
  {
    id: 'vehicle_emergency',
    name_en: 'Vehicle & Emergency Services',
    name_hi: 'वाहन और आपातकालीन सेवाएँ',
    icon: 'truck',
    services: [
      { id: 'part_time_driver', name_en: 'Part-time Driver', name_hi: 'पार्ट-टाइम ड्राइवर', icon: 'car', categoryId: 'vehicle_emergency' },
      { id: 'car_mechanic', name_en: 'Car Mechanic', name_hi: 'कार मैकेनिक', icon: 'wrench', categoryId: 'vehicle_emergency' },
      { id: 'ambulance', name_en: 'Ambulance', name_hi: 'एम्बुलेंस', icon: 'shield-alert', categoryId: 'vehicle_emergency' },
    ],
  },
];

const ALL_SERVICES = JUGNU_CATEGORIES.flatMap(cat => cat.services);

function getServicesByCategoryId(categoryId) {
  const cat = JUGNU_CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.services : [];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

console.log('================================================================');
console.log('🧪 MULTI-SERVICE WORKER REGISTRATION TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assertTest(name, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${name}`);
    if (details) console.log(`   ${details}`);
  } else {
    console.error(`❌ [FAIL] ${name}`);
    if (details) console.error(`   ${details}`);
  }
}

// -----------------------------------------------------------------------------
// 1. REGISTRATION BUSINESS RULES VALIDATION (Client & Payload Validation)
// -----------------------------------------------------------------------------
console.log('--- 1. REGISTRATION BUSINESS RULES ---');

function validateRegistrationPayload(selectedParentCategory, selectedServices) {
  if (!selectedServices || selectedServices.length === 0) {
    return { valid: false, error: 'Please select at least one work service (maximum 2)' };
  }
  if (selectedServices.length > 2) {
    return { valid: false, error: 'A worker may select at most 2 services' };
  }
  if (!selectedParentCategory) {
    return { valid: false, error: 'Parent category must be selected' };
  }

  const parentCat = JUGNU_CATEGORIES.find(c => c.id === selectedParentCategory);
  if (!parentCat) {
    return { valid: false, error: 'Invalid parent category' };
  }

  const validServiceIds = new Set(parentCat.services.map(s => s.id));
  const hasCrossCategory = selectedServices.some(sId => !validServiceIds.has(sId));
  if (hasCrossCategory) {
    return { valid: false, error: 'All selected services must belong to the selected parent category' };
  }

  return { valid: true };
}

// 1.1 One service, valid category -> PASS
const r1 = validateRegistrationPayload('home_repair', ['electrician']);
assertTest('1 service, valid category → PASS', r1.valid, `Services: ['electrician'] in home_repair`);

// 1.2 Two services, same category -> PASS
const r2 = validateRegistrationPayload('appliance_repair', ['ac_repair', 'refrigerator_repair']);
assertTest('2 services, same category → PASS', r2.valid, `Services: ['ac_repair', 'refrigerator_repair'] in appliance_repair`);

// 1.3 Three services, same category -> REJECT
const r3 = validateRegistrationPayload('appliance_repair', ['ac_repair', 'refrigerator_repair', 'washing_machine_repair']);
assertTest('3 services, same category → REJECT', !r3.valid && r3.error.includes('at most 2 services'), `Error message: "${r3.error}"`);

// 1.4 Two services, different categories -> REJECT
const r4 = validateRegistrationPayload('appliance_repair', ['ac_repair', 'electrician']);
assertTest('2 services, different categories → REJECT', !r4.valid && (r4.error.includes('same parent category') || r4.error.includes('selected parent category')), `Error message: "${r4.error}"`);

// 1.5 Zero services -> REJECT
const r5 = validateRegistrationPayload('home_repair', []);
assertTest('0 services → REJECT', !r5.valid && r5.error.includes('at least one'), `Error message: "${r5.error}"`);

// -----------------------------------------------------------------------------
// 2. CANONICAL TAXONOMY INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n--- 2. CANONICAL TAXONOMY INTEGRITY ---');

assertTest(
  'Top-level categories exactly match 5 canonical groups',
  JUGNU_CATEGORIES.length === 5 &&
    JUGNU_CATEGORIES.map(c => c.id).sort().join(',') ===
      ['appliance_repair', 'beauty_personal_care', 'home_help_cleaning', 'home_repair', 'vehicle_emergency'].sort().join(','),
  `Found groups: ${JUGNU_CATEGORIES.map(c => c.id).join(', ')}`
);

let allServicesValid = true;
let totalServicesCount = 0;
for (const cat of JUGNU_CATEGORIES) {
  totalServicesCount += cat.services.length;
  for (const s of cat.services) {
    if (s.categoryId !== cat.id) allServicesValid = false;
  }
}
assertTest(
  'All leaf services reference their exact parent category group',
  allServicesValid,
  `Verified ${totalServicesCount} canonical services across 5 categories`
);

// -----------------------------------------------------------------------------
// 3. DATABASE MIGRATION INVARIANTS & INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n--- 3. DATABASE MIGRATION INVARIANTS ---');

const migrationPath = resolve(rootDir, 'supabase/migrations/202609180028_multi_service_worker_registration.sql');
assertTest('Migration file 202609180028 exists', existsSync(migrationPath));

if (existsSync(migrationPath)) {
  const mig = readFileSync(migrationPath, 'utf-8');

  assertTest(
    'Migration adds parent_category_id foreign key on public.categories',
    mig.includes('ALTER TABLE public.categories') && mig.includes('parent_category_id text REFERENCES public.categories(id)'),
    'ALTER TABLE with foreign key relationship present'
  );

  assertTest(
    'Migration populates parent_category_id for all canonical services',
    mig.includes("UPDATE public.categories SET parent_category_id = 'home_repair'") &&
      mig.includes("UPDATE public.categories SET parent_category_id = 'appliance_repair'") &&
      mig.includes("UPDATE public.categories SET parent_category_id = 'beauty_personal_care'") &&
      mig.includes("UPDATE public.categories SET parent_category_id = 'home_help_cleaning'") &&
      mig.includes("UPDATE public.categories SET parent_category_id = 'vehicle_emergency'"),
    'All 5 parent groups mapped to their respective services'
  );

  assertTest(
    'Migration implements check_worker_categories_invariants database trigger',
    mig.includes('CREATE OR REPLACE FUNCTION public.check_worker_categories_invariants') &&
      mig.includes('CREATE TRIGGER trg_worker_categories_invariants') &&
      mig.includes('AFTER INSERT OR UPDATE ON public.worker_categories'),
    'Trigger attached to public.worker_categories to enforce DB-level invariant'
  );

  assertTest(
    'Migration register_worker RPC accepts worker_category_ids and validates count & category integrity',
    mig.includes('worker_category_ids text[] DEFAULT NULL') &&
      mig.includes('v_count < 1 OR v_count > 2') &&
      mig.includes('v_parent_count <> 1 OR v_parent_id IS NULL'),
    'RPC validates max 2 services and uniform parent category'
  );
}

// -----------------------------------------------------------------------------
// 4. CUSTOMER DISCOVERY & SEARCH MATCHING (2-Service Worker)
// -----------------------------------------------------------------------------
console.log('\n--- 4. CUSTOMER DISCOVERY & SEARCH MATCHING ---');

// Replicate Home.tsx matching logic
const SERVICE_ALIASES = {
  ac: ['ac_repair'],
  'ac repair': ['ac_repair'],
  fridge: ['refrigerator_repair'],
  refrigerator: ['refrigerator_repair'],
  washing: ['washing_machine_repair'],
  electrician: ['electrician'],
  plumber: ['plumber'],
};

function getMatchingServiceIds(query) {
  const q = query.trim().toLowerCase();
  const matched = new Set();
  if (!q) return matched;
  for (const s of ALL_SERVICES) {
    if (s.id.includes(q) || s.name_en.toLowerCase().includes(q) || s.name_hi.toLowerCase().includes(q)) {
      matched.add(s.id);
    }
  }
  const tokens = q.split(/\s+/);
  for (const [alias, sids] of Object.entries(SERVICE_ALIASES)) {
    const isShort = alias.length <= 3;
    const matchedAlias = isShort
      ? tokens.includes(alias) || new RegExp(`(^|[^a-zA-Z0-9\u0900-\u097F])${alias}([^a-zA-Z0-9\u0900-\u097F]|$)`, 'i').test(q)
      : (q.includes(alias) || alias.includes(q));
    if (matchedAlias) {
      sids.forEach(sid => matched.add(sid));
    }
  }
  return matched;
}

function matchWorker(worker, query, selectedCategory, selectedArea) {
  const q = query.trim().toLowerCase();
  const matchedServiceIds = q ? getMatchingServiceIds(q) : new Set();

  // Category filter
  if (selectedCategory) {
    const childServices = getServicesByCategoryId(selectedCategory);
    const targetIds = new Set([selectedCategory, ...childServices.map(s => s.id)]);
    if (!worker.categories.some(c => targetIds.has(c))) return false;
  }

  // Area filter
  if (selectedArea && !worker.areas.includes(selectedArea)) return false;

  // Search query
  if (q) {
    const matchesName = worker.name.toLowerCase().includes(q);
    const matchesTaxonomy = matchedServiceIds.size > 0 && worker.categories.some(c => matchedServiceIds.has(c));

    if (matchedServiceIds.size > 0) {
      if (!matchesTaxonomy && !matchesName) return false;
    } else {
      const matchesBio = (worker.bio || '').toLowerCase().includes(q);
      const matchesCategoryDirect = worker.categories.some(c => c.toLowerCase().includes(q));
      if (!matchesName && !matchesBio && !matchesCategoryDirect) return false;
    }
  }

  return true;
}

const twoServiceWorker = {
  id: 'w-multi',
  name: 'Vikram Singh',
  bio: 'Expert appliance repair technician.',
  categories: ['ac_repair', 'refrigerator_repair'],
  areas: ['251001', '251002'],
};

const singleServiceWorker = {
  id: 'w-single',
  name: 'Samshad',
  bio: 'Experienced plumber serving Muzaffarnagar.',
  categories: ['plumber'],
  areas: ['251001', '251002'],
};

// 4.1 Two-service worker appears for Service 1 ("AC Repair")
assertTest(
  'Two-service worker: appears for Service 1 ("AC Repair")',
  matchWorker(twoServiceWorker, 'AC Repair', '', ''),
  'Matched via canonical service ac_repair'
);

// 4.2 Two-service worker appears for Service 2 ("Refrigerator Repair")
assertTest(
  'Two-service worker: appears for Service 2 ("Refrigerator Repair")',
  matchWorker(twoServiceWorker, 'Refrigerator Repair', '', ''),
  'Matched via canonical service refrigerator_repair'
);

// 4.3 Two-service worker does NOT appear for unprovided Service 3 in same category ("Washing Machine")
assertTest(
  'Two-service worker: does NOT appear for unprovided Service 3 ("Washing Machine")',
  !matchWorker(twoServiceWorker, 'washing machine', '', ''),
  'Correctly excluded from washing_machine_repair search'
);

// 4.4 Two-service worker does NOT appear for unrelated category service ("Electrician")
assertTest(
  'Two-service worker: does NOT appear for unrelated category ("Electrician")',
  !matchWorker(twoServiceWorker, 'electrician', '', ''),
  'Correctly excluded from electrician search'
);

// 4.5 Category Filter Composition
assertTest(
  'Two-service worker: appears under its parent category filter ("appliance_repair")',
  matchWorker(twoServiceWorker, '', 'appliance_repair', ''),
  'Matched parent category filter'
);

assertTest(
  'Two-service worker: excluded under wrong parent category filter ("home_repair")',
  !matchWorker(twoServiceWorker, '', 'home_repair', ''),
  'Strict AND category filtering excluded worker'
);

// 4.6 Area Filter Composition
assertTest(
  'Two-service worker: matches matching area ("251001")',
  matchWorker(twoServiceWorker, '', '', '251001'),
  'Area 251001 matched'
);

assertTest(
  'Two-service worker: excluded for non-matching area ("251003")',
  !matchWorker(twoServiceWorker, '', '', '251003'),
  'Area 251003 excluded worker'
);

// -----------------------------------------------------------------------------
// 5. EXISTING SINGLE-SERVICE WORKER COMPATIBILITY
// -----------------------------------------------------------------------------
console.log('\n--- 5. EXISTING SINGLE-SERVICE WORKER COMPATIBILITY ---');

assertTest(
  'Existing single-service worker (Samshad): appears for its service ("plumber")',
  matchWorker(singleServiceWorker, 'plumber', '', ''),
  'Plumber query matches Samshad'
);

assertTest(
  'Existing single-service worker (Samshad): appears under its category ("home_repair")',
  matchWorker(singleServiceWorker, '', 'home_repair', ''),
  'Home repair category matches Samshad'
);

assertTest(
  'Existing single-service worker (Samshad): excluded for other services ("electrician")',
  !matchWorker(singleServiceWorker, 'electrician', '', ''),
  'Electrician query strictly excludes plumber'
);

assertTest(
  'Existing single-service worker (Samshad): excluded under wrong category ("appliance_repair")',
  !matchWorker(singleServiceWorker, '', 'appliance_repair', ''),
  'Appliance repair category excludes plumber'
);

console.log('\n================================================================');
console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
