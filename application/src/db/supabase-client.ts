import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig, SupabaseConfig } from '../config/env.js';
import { Database } from '../types/models.js';

export function createSupabaseClient(
  customConfig?: Partial<SupabaseConfig>
): SupabaseClient<Database> {
  const config = {
    ...getSupabaseConfig(),
    ...customConfig
  };

  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      'Missing Supabase configuration. Both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
    );
  }

  return createClient<Database>(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
