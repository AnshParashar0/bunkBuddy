import '@testing-library/jest-dom';

if (!import.meta.env.VITE_SUPABASE_URL) {
  Object.assign(import.meta.env, { VITE_SUPABASE_URL: 'https://x.supabase.co' });
}
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  Object.assign(import.meta.env, { VITE_SUPABASE_ANON_KEY: 'x' });
}
