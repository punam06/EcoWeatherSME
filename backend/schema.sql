-- Placeholder table to instantly test database reads/writes
CREATE TABLE IF NOT EXISTS test_logs (
    id SERIAL PRIMARY KEY,
    message VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert a test record
INSERT INTO test_logs (message) VALUES ('Initial database connection test successfully created table and inserted data.');
