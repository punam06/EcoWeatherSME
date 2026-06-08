import os
import re

files = [
    r"D:\user_jabu\hackathon-ev\backend\migrations\001_add_agent_sessions.sql",
    r"D:\user_jabu\hackathon-ev\backend\schema.sql",
    r"D:\user_jabu\hackathon-ev\db\migrations\001_refresh_tokens.sql",
    r"D:\user_jabu\hackathon-ev\db\seeds\001_zones.sql",
    r"D:\user_jabu\hackathon-ev\db\seeds\002_demo_users.sql",
    r"D:\user_jabu\hackathon-ev\db\seeds\003_demo_batches.sql",
    r"D:\user_jabu\hackathon-ev\db\seeds\004_demo_iot_readings.sql",
    r"D:\user_jabu\hackathon-ev\migrations\add_auth_sync_trigger.sql",
    r"D:\user_jabu\hackathon-ev\migrations\add_notifications_and_bari_chunks.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\001_initial_schema.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\002_pgvector_setup.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\004_orders_agent_log.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\005_esg_metrics.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\006_create_checkout_orders.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\007_create_orders.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\008_order_lifecycle_logs.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\009_trust_layer_v2.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\010_qa_reports_column_alignment.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\011_provenance_event_types_alignment.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\012_qr_scans.sql",
    r"D:\user_jabu\hackathon-ev\supabase\migrations\20260602194600_add_base_price_to_batches.sql",
    r"D:\user_jabu\hackathon-ev\schema.sql"
]

all_statements = []

for f in files:
    try:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
            # Split by semicolon, but this is naive. Let's just collect raw text for now and we will parse it.
            all_statements.append(f"-- Source: {f}\n" + content + "\n")
    except Exception as e:
        print(f"Error reading {f}: {e}")

with open(r"D:\user_jabu\hackathon-ev\all_sql_dump.txt", "w", encoding='utf-8') as out:
    out.write("\n".join(all_statements))
