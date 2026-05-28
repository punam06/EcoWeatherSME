-- Demo users (processor, buyer, admin)
-- password_hash is a placeholder for Task 1; replace in Task 2 (auth)

INSERT INTO users (email, password_hash, name, role)
VALUES
  ('processor.demo@ecosortha.local', 'dev-placeholder-hash', 'Demo Processor', 'processor'),
  ('buyer.demo@ecosortha.local',     'dev-placeholder-hash', 'Demo Buyer',     'buyer'),
  ('admin.demo@ecosortha.local',     'dev-placeholder-hash', 'Demo Admin',     'admin')
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role;
