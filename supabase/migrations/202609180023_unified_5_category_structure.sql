-- Migration: 202609180023_unified_5_category_structure.sql
-- Description: Insert the authoritative 5 primary categories and 18 service IDs into public.categories

-- 1. Insert 5 Primary Top-Level Categories
INSERT INTO public.categories (id, name_en, name_hi, icon, sort_order)
VALUES
  ('home_repair', 'Home Repair & Work', 'घर की मरम्मत और काम', 'home', 1),
  ('appliance_repair', 'Home Appliance Repair', 'घर के उपकरण मरम्मत', 'wrench', 2),
  ('beauty_personal_care', 'Beauty & Personal Care', 'ब्यूटी और व्यक्तिगत देखभाल', 'sparkles', 3),
  ('home_help_cleaning', 'Home Help & Cleaning', 'घरेलू मदद और सफाई', 'sparkles', 4),
  ('vehicle_emergency', 'Vehicle & Emergency Services', 'वाहन और आपातकालीन सेवाएँ', 'truck', 5)
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_hi = EXCLUDED.name_hi,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- 2. Insert/Update all 18 Services (satisfies foreign key constraints for worker_categories and bookings)
INSERT INTO public.categories (id, name_en, name_hi, icon, sort_order)
VALUES
  -- Category 1 Services: Home Repair & Work
  ('electrician', 'Electrician', 'बिजली मिस्त्री', 'zap', 10),
  ('plumber', 'Plumber', 'प्लंबर', 'wrench', 11),
  ('carpenter', 'Carpenter', 'बढ़ई', 'hammer', 12),
  ('painter', 'Painter', 'पेंटर', 'brush', 13),
  ('daily_wage_worker', 'Daily Wage Worker', 'दिहाड़ी मजदूर', 'hammer', 14),
  ('raj_mistri', 'Raj Mistri', 'राज मिस्त्री', 'wrench', 15),

  -- Category 2 Services: Home Appliance Repair
  ('ac_repair', 'AC Repair & Service', 'AC मरम्मत और सर्विस', 'snowflake', 20),
  ('refrigerator_repair', 'Refrigerator Repair', 'फ्रिज मरम्मत', 'snowflake', 21),
  ('washing_machine_repair', 'Washing Machine Repair', 'वॉशिंग मशीन मरम्मत', 'cog', 22),
  ('ro_repair', 'RO Repair', 'RO मरम्मत', 'droplets', 23),
  ('geyser_repair', 'Geyser Repair', 'गीजर मरम्मत', 'flame', 24),

  -- Category 3 Services: Beauty & Personal Care
  ('parlour_service', 'Parlour Service', 'पार्लर सेवा', 'scissors', 30),
  ('nail_extension', 'Nail Extension', 'नेल एक्सटेंशन', 'sparkles', 31),
  ('mehendi_artist', 'Mehendi Artist', 'मेहंदी आर्टिस्ट', 'palette', 32),

  -- Category 4 Services: Home Help & Cleaning
  ('part_time_maid', 'Part-time Home Maid', 'पार्ट-टाइम घरेलू काम', 'user', 40),
  ('dry_clean_press', 'Dry Clean & Press', 'ड्राई क्लीन और प्रेस', 'shirt', 41),

  -- Category 5 Services: Vehicle & Emergency Services
  ('part_time_driver', 'Part-time Driver', 'पार्ट-टाइम ड्राइवर', 'car', 50),
  ('car_mechanic', 'Car Mechanic', 'कार मैकेनिक', 'wrench', 51),
  ('ambulance', 'Ambulance', 'एम्बुलेंस', 'truck', 52)
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_hi = EXCLUDED.name_hi,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- 3. Legacy compatibility mappings (Preserve historical IDs for existing worker profiles and bookings)
INSERT INTO public.categories (id, name_en, name_hi, icon, sort_order)
VALUES
  ('ac', 'AC Repair & Service', 'AC मरम्मत और सर्विस', 'snowflake', 90),
  ('cleaning', 'Part-time Home Maid', 'पार्ट-टाइम घरेलू काम', 'user', 91),
  ('men_salon', 'Parlour Service', 'पार्लर सेवा', 'scissors', 92),
  ('women_spa', 'Parlour Service', 'पार्लर सेवा', 'scissors', 93)
ON CONFLICT (id) DO NOTHING;
