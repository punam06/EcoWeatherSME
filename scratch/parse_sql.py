import re

files = [
    r"D:\user_jabu\hackathon-ev\schema.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\009_trust_layer_v2.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\008_order_lifecycle_logs.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\006_create_checkout_orders.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\004_orders_agent_log.sql",
    r"D:\user_jabu\hackathon-ev\migrations\add_notifications_and_bari_chunks.sql",
    r"D:\user_jabu\hackathon-ev\backend\schema.sql",
    r"D:\user_jabu\hackathon-ev\backend\migrations\001_add_agent_sessions.sql"
]

content = ""
for f in files:
    try:
        with open(f, 'r', encoding='utf-8') as file:
            content += file.read() + "\n\n"
    except Exception as e:
        print(f"Error reading {f}: {e}")

statements = [s.strip() + ";" for s in re.split(r";(?=(?:[^']*'[^']*')*[^']*$)", content) if s.strip()]

seen_tables = set()
seen_policies = set()
seen_indexes = set()
final_statements = []

for stmt in statements:
    clean_stmt = re.sub(r"--.*?\n", "\n", stmt).strip()
    
    match_table = re.search(r"CREATE TABLE IF NOT EXISTS (?:public\.)?([\w_]+)", clean_stmt, re.IGNORECASE)
    if match_table:
        table_name = match_table.group(1).lower()
        if table_name in seen_tables:
            continue
        seen_tables.add(table_name)
    
    match_policy = re.search(r"CREATE POLICY \"?([^\"]+)\"? ON (?:public\.)?([\w_]+)", clean_stmt, re.IGNORECASE)
    if match_policy:
        policy_key = (match_policy.group(1).lower(), match_policy.group(2).lower())
        if policy_key in seen_policies:
            continue
        seen_policies.add(policy_key)
        
    match_index = re.search(r"CREATE INDEX IF NOT EXISTS ([\w_]+)", clean_stmt, re.IGNORECASE)
    if match_index:
        idx_name = match_index.group(1).lower()
        if idx_name in seen_indexes:
            continue
        seen_indexes.add(idx_name)

    match_rls = re.search(r"ALTER TABLE (?:public\.)?([\w_]+) ENABLE ROW LEVEL SECURITY", clean_stmt, re.IGNORECASE)
    if match_rls:
        rls_table = match_rls.group(1).lower()
        if f"rls_{rls_table}" in seen_policies:
            continue
        seen_policies.add(f"rls_{rls_table}")

    final_statements.append(stmt)

final_statements.append("""-- Policy 1: Processors can only read their own batches
CREATE POLICY "SME owner select own batches"
ON batches
FOR SELECT
USING (auth.uid() = processor_id);""")

final_statements.append("""-- Policy 2: Buyers can only read their own orders
CREATE POLICY "Buyer purchase isolation"
ON orders
FOR SELECT
USING (auth.uid() = buyer_id);""")

with open(r"D:\user_jabu\hackathon-ev\supabase.sql", "w", encoding='utf-8') as out:
    out.write("\n\n".join(final_statements))
print("Created supabase.sql successfully")
