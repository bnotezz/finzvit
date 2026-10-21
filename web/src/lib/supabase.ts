import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || '';

// Сучасний канонічний стандарт Supabase: Publishable API Key (sb_publishable_... / sbp_...)
const supabasePublishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

let client: SupabaseClient | null = null;

if (supabaseUrl && supabasePublishableKey) {
  try {
    client = createClient(supabaseUrl, supabasePublishableKey);
  } catch (e) {
    console.warn('Не вдалося ініціалізувати клієнт Supabase:', e);
  }
}

export const supabase = client;
