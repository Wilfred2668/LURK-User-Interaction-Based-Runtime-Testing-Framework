import dotenv from 'dotenv';

dotenv.config();

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  const supabaseUrl = process.env['SUPABASE_URL'] || '';
  const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || '';

  return {
    supabaseUrl,
    supabaseServiceRoleKey
  };
}
