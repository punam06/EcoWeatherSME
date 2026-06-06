// Initialize Supabase Client globally
if (typeof window !== 'undefined' && window.supabase && !window.supabaseClient && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
  window.supabaseClient = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );
}

window.getSupabaseClient = () => {
  if (typeof window !== 'undefined' && window.supabaseClient) {
    return window.supabaseClient;
  }
  return null;
};
