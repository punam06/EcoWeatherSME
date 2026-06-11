-- Optional investor-demo seed.
-- Creates 10,000 registry rows for pagination/search/filter testing without
-- overwriting real records. Run after migrations and demo users.

INSERT INTO batches (
  processor_id,
  manufacturer_id,
  batch_number,
  feedstock_type,
  product_name,
  category,
  weight_kg,
  packaging_type,
  destination_zone,
  status,
  trust_score,
  evaluation_summary,
  evaluation_breakdown,
  is_locked
)
SELECT
  (SELECT id FROM users WHERE email='processor.demo@climalogix.local'),
  (SELECT id FROM users WHERE email='processor.demo@climalogix.local'),
  'DEMO-LIFE-' || LPAD(gs::TEXT, 5, '0'),
  CASE WHEN gs % 5 = 0 THEN 'dairy' WHEN gs % 3 = 0 THEN 'retail' ELSE 'organic' END,
  'Lifecycle Demo Product ' || gs,
  CASE WHEN gs % 5 = 0 THEN 'dairy' WHEN gs % 3 = 0 THEN 'retail' ELSE 'organic' END,
  50 + (gs % 450),
  CASE WHEN gs % 2 = 0 THEN 'Sealed pouch' ELSE 'Standard carton' END,
  CASE WHEN gs % 4 = 0 THEN 'Old Dhaka' WHEN gs % 4 = 1 THEN 'Mirpur' WHEN gs % 4 = 2 THEN 'Savar' ELSE 'Gulshan' END,
  CASE
    WHEN gs % 11 = 0 THEN 'evaluation_failed'
    WHEN gs % 7 = 0 THEN 'approved'
    WHEN gs % 5 = 0 THEN 'under_review'
    WHEN gs % 3 = 0 THEN 'shipped'
    ELSE 'awaiting_shipment'
  END,
  70 + (gs % 29),
  jsonb_build_object('passed', gs % 11 <> 0, 'score', 70 + (gs % 29), 'reference', 'Demo BARI/BSTI evaluation'),
  jsonb_build_object('components', jsonb_build_object('ph', 100, 'ec', 95, 'temp', 90, 'ratio', 100, 'days', 100)),
  gs % 7 = 0
FROM generate_series(1, 10000) AS gs
ON CONFLICT (batch_number) DO NOTHING;

