// Supabase project credentials. Both values are intentionally committed:
// the publishable/anon key is public by design — row-level security (see
// supabase/schema.sql) is what protects the data, and every row is scoped
// to the signed-in user. Leave both empty to run in local-only mode
// (all data in this browser's localStorage, no login).
export const SUPABASE_URL = 'https://oieiarowblugqzpzydpu.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_cQ1LKiERx5LCn22pOzxcQQ_WA2uY-KJ'
