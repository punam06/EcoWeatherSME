-- Remove ALL existing readings for ALL batches owned by the demo processor
DELETE FROM iot_readings
WHERE batch_id IN (
  SELECT b.id
  FROM batches b
  JOIN users u ON u.id = b.processor_id
  WHERE u.email = 'processor.demo@ecosortha.local'
);
-- Demo IoT readings linked to demo batches by batch_number
INSERT INTO iot_readings (batch_id, ph, ec, temperature, em1_ratio, fermentation_days)
VALUES
-- Readings for BATCH-DEMO-001 (Liquid Nutrient A)
(
  (SELECT id FROM batches WHERE batch_number='BATCH-DEMO-001'),
  4.30, 3.20, 27.50, '1:1:20', 7
),
(
  (SELECT id FROM batches WHERE batch_number='BATCH-DEMO-001'),
  4.10, 3.40, 28.00, '1:1:20', 9
),
(
  (SELECT id FROM batches WHERE batch_number='BATCH-DEMO-001'),
  4.00, 3.50, 29.00, '1:1:20', 10
),

-- Readings for BATCH-DEMO-002 (Liquid Nutrient B)
(
  (SELECT id FROM batches WHERE batch_number='BATCH-DEMO-002'),
  4.50, 3.10, 26.80, '1:1:20', 5
),
(
  (SELECT id FROM batches WHERE batch_number='BATCH-DEMO-002'),
  4.20, 3.60, 27.50, '1:1:20', 8
),
(
  (SELECT id FROM batches WHERE batch_number='BATCH-DEMO-002'),
  3.90, 3.80, 28.20, '1:1:20', 12
),

-- Readings for BATCH-DEMO-003 (Organic Humic Booster)
(
  (SELECT id FROM batches WHERE batch_number='BATCH-DEMO-003'),
  5.20, 2.80, 31.00, '1:2:15', 3
),
(
  (SELECT id FROM batches WHERE batch_number='BATCH-DEMO-003'),
  4.80, 3.10, 32.50, '1:2:15', 6
),
(
  (SELECT id FROM batches WHERE batch_number='BATCH-DEMO-003'),
  4.40, 3.30, 30.00, '1:2:15', 9
),

-- Readings for BATCH-DEMO-004 (Bio-Enzyme Solution)
(
  (SELECT id FROM batches WHERE batch_number='BATCH-DEMO-004'),
  4.00, 4.10, 29.50, '1:1:10', 14
),
(
  (SELECT id FROM batches WHERE batch_number='BATCH-DEMO-004'),
  3.70, 4.30, 29.00, '1:1:10', 21
),

-- Readings for BATCH-DEMO-005 (Premium Folia Spritz)
(
  (SELECT id FROM batches WHERE batch_number='BATCH-DEMO-005'),
  4.60, 2.90, 27.00, '1:1:20', 4
),
(
  (SELECT id FROM batches WHERE batch_number='BATCH-DEMO-005'),
  4.10, 3.20, 27.80, '1:1:20', 8
);
