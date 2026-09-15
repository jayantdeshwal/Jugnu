-- Migration: 202609150022_add_urban_company_categories.sql
-- Description: Add Cleaning, Men's Salon, and Women's Salon/Spa categories inspired by Urban Company

INSERT INTO public.categories (id, name_en, name_hi, icon, sort_order)
VALUES
  ('cleaning', 'Cleaning & Pest Control', 'सफ़ाई एवं कीट नियंत्रण', 'sparkles', 6),
  ('men_salon', 'Men''s Salon & Grooming', 'पुरुष सैलून व ग्रूमिंग', 'scissors', 7),
  ('women_spa', 'Women''s Salon & Spa', 'महिला सैलून व स्पा', 'flower', 8)
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_hi = EXCLUDED.name_hi,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;
