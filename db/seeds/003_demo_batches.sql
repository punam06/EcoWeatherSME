-- Demo batches linked to the demo processor
-- This is idempotent because batch_number is UNIQUE

INSERT INTO batches (
  processor_id,
  batch_number,
  feedstock_type,
  product_name,
  trust_score,
  certificate_url,
  qr_code_url
)
VALUES
(
  (SELECT id FROM users WHERE email='processor.demo@ecosortha.local'),
  'BATCH-DEMO-001',
  'Food waste + molasses',
  'Liquid Nutrient A',
  85,
  NULL,
  NULL
),
(
  (SELECT id FROM users WHERE email='processor.demo@ecosortha.local'),
  'BATCH-DEMO-002',
  'Leaf litter + EM-1',
  'Liquid Nutrient B',
  92,
  NULL,
  NULL
),
(
  (SELECT id FROM users WHERE email='processor.demo@ecosortha.local'),
  'BATCH-DEMO-003',
  'Market waste + jaggery',
  'Carbon Enhancer A',
  88,
  NULL,
  NULL
),
(
  (SELECT id FROM users WHERE email='processor.demo@ecosortha.local'),
  'BATCH-DEMO-004',
  'Rice husk biochar + EM-1',
  'Carbon Enhancer B',
  90,
  NULL,
  NULL
),
(
  (SELECT id FROM users WHERE email='processor.demo@ecosortha.local'),
  'BATCH-DEMO-005',
  'Mixed compost tea',
  'Liquid Nutrient C',
  80,
  NULL,
  NULL
)
ON CONFLICT (batch_number) DO UPDATE SET
  processor_id  = EXCLUDED.processor_id,
  feedstock_type = EXCLUDED.feedstock_type,
  product_name  = EXCLUDED.product_name,
  trust_score   = EXCLUDED.trust_score,
  certificate_url = EXCLUDED.certificate_url,
  qr_code_url   = EXCLUDED.qr_code_url;
