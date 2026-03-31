import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nhwdgstjhugezhqlktie.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5od2Rnc3RqaHVnZXpocWxrdGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTUzMjMsImV4cCI6MjA2ODc3MTMyM30.dsN6HiFYtM1MXxOcyaI-O7vbJxN-si1V3Eth0oIY2JE'

/** Standard Supabase client — used for auth and storage */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Supabase client configured to target the dhub schema.
 * All .from() and .rpc() calls go through PostgREST with
 * Accept-Profile: dhub and Content-Profile: dhub headers.
 */
export const dhubClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'dhub' },
  global: {
    headers: {
      'Accept-Profile': 'dhub',
      'Content-Profile': 'dhub',
    },
  },
})

/** Convenience: dhub.from('requests').select('*') */
export const dhub = {
  from(table: string) {
    return dhubClient.from(table)
  },
  rpc(fn: string, args?: Record<string, unknown>) {
    return dhubClient.rpc(fn, args)
  },
  storage: supabase.storage,
}
