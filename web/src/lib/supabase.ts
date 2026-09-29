import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || '';

// Сучасний стандарт Supabase: Publishable API Key (sb_publishable_... / sbp_...)
// Підтримує зворотну сумісність із застарілим PUBLIC_SUPABASE_ANON_KEY
const supabasePublishableKey = 
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 
  '';

let client: SupabaseClient | null = null;

if (supabaseUrl && supabasePublishableKey) {
  try {
    client = createClient(supabaseUrl, supabasePublishableKey);
  } catch (e) {
    console.warn('Не вдалося ініціалізувати клієнт Supabase:', e);
  }
}

export const supabase = client;
