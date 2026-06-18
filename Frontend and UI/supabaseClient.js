// Initialize Supabase Client globally
if (typeof window !== 'undefined') {
  if (!window.SUPABASE_URL) {
    window.SUPABASE_URL = 'https://pdeskdcdyhbldwfgbowz.supabase.co';
  }
  if (!window.SUPABASE_ANON_KEY) {
    window.SUPABASE_ANON_KEY = 'sb_publishable_H-_gcEncBp26k2iCHKOb_g_3RDQSr_M';
  }
  
  function initSupabaseClient() {
    if (window.supabase && !window.supabaseClient && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      window.supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
      );
    }
  }
  
  // Try immediately in case supabase SDK is already loaded
  initSupabaseClient();
  
  // If not yet available, retry when the SDK loads
  if (!window.supabaseClient && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      initSupabaseClient();
      if (window.supabaseClient) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    // Fallback: stop observing after 5s
    setTimeout(() => observer.disconnect(), 5000);
  }
}

window.getSupabaseClient = () => {
  if (typeof window !== 'undefined' && window.supabaseClient) {
    return window.supabaseClient;
  }
  return null;
};
