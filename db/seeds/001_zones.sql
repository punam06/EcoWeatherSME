INSERT INTO zone_microclimate_profiles (zone, uhi_offset, building_density, vegetation_fraction, wind_corridor_factor, thermal_mass_coefficient)
VALUES
  ('Old Dhaka', 1.8, 0.85, 0.10, 0.60, 1.20),
  ('Gulshan', 1.2, 0.60, 0.30, 0.85, 1.05),
  ('Dhanmondi', 1.4, 0.70, 0.22, 0.75, 1.10),
  ('Uttara', 1.1, 0.55, 0.28, 0.80, 1.00),
  ('Motijheel', 1.9, 0.90, 0.05, 0.50, 1.30),
  ('Mirpur', 1.3, 0.75, 0.18, 0.70, 1.15),
  ('Banani', 1.2, 0.65, 0.25, 0.85, 1.05),
  ('Mohammadpur', 1.4, 0.78, 0.15, 0.65, 1.12),
  ('Paltan', 1.8, 0.88, 0.08, 0.55, 1.25),
  ('Tejgaon', 1.6, 0.82, 0.12, 0.60, 1.18),
  ('Badda', 1.5, 0.80, 0.14, 0.68, 1.14),
  ('Khilgaon', 1.3, 0.72, 0.19, 0.72, 1.08),
  ('Baridhara', 0.9, 0.45, 0.40, 0.90, 0.95),
  ('Bashundhara', 1.0, 0.50, 0.35, 0.88, 0.98),
  ('Rampura', 1.4, 0.76, 0.16, 0.70, 1.10)
ON CONFLICT (zone) DO NOTHING;
