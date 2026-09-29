-- Seed Chris Coach's AI Roleplay modules in training order
-- Run this AFTER the 00020_roleplay_modules.sql migration

INSERT INTO roleplay_modules (name, category, sort_order, is_active)
VALUES
  ('Present Auto & Renters and Close',                              'Auto',    0, true),
  ('Auto Lead – Deliver Price & Overcome "Too Expensive"',          'Auto',    1, true),
  ('Present Auto Insurance Coverage & Price and Close the Sale',    'Auto',    2, true),
  ('Find Auto Lead Customer Pain Point',                            'Auto',    3, true),
  ('Auto Lead – Deliver Price & Overcome "I Need to Think About It"', 'Auto', 4, true),
  ('Auto Lead – "What''s the Price?"',                              'Auto',    5, true),
  ('Auto Lead – Overcome "Doesn''t Want Life Insurance"',           'Auto',    6, true),
  ('Auto Lead w/ "I Already Went with Someone" Objection',          'Auto',    7, true)
ON CONFLICT DO NOTHING;
