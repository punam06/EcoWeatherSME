-- Demo users (processor, buyer, admin)
-- Password for all demo users: DemoPass123!
-- Generated with argon2id.

INSERT INTO users (email, password_hash, name, role)
VALUES
  ('processor.demo@ecosortha.local', '$argon2id$v=19$m=65536,t=3,p=4$SZ5P2auoBrj86fK+Jme1Ug$B0EgO63xNZiLejJBJ9p6UFW4zjCaAXnxS4Zh/pXoNeY', 'Demo Processor', 'processor'),
  ('buyer.demo@ecosortha.local',     '$argon2id$v=19$m=65536,t=3,p=4$SZ5P2auoBrj86fK+Jme1Ug$B0EgO63xNZiLejJBJ9p6UFW4zjCaAXnxS4Zh/pXoNeY', 'Demo Buyer',     'buyer'),
  ('admin.demo@ecosortha.local',     '$argon2id$v=19$m=65536,t=3,p=4$SZ5P2auoBrj86fK+Jme1Ug$B0EgO63xNZiLejJBJ9p6UFW4zjCaAXnxS4Zh/pXoNeY', 'Demo Admin',     'admin')
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role;
