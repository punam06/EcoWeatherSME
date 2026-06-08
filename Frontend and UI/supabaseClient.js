// Initialize Supabase Client globally
if (typeof window !== 'undefined') {
  if (!window.SUPABASE_URL) {
    window.SUPABASE_URL = 'https://pdeskdcdyhbldwfgbowz.supabase.co';
  }
  if (!window.SUPABASE_ANON_KEY) {
    window.SUPABASE_ANON_KEY = 'sb_publishable_H-_gcEncBp26k2iCHKOb_g_3RDQSr_M';
  }
  if (window.supabase && !window.supabaseClient && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    window.supabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
  }
}

window.getSupabaseClient = () => {
  if (typeof window !== 'undefined' && window.supabaseClient) {
    return window.supabaseClient;
  }
  return null;
};
