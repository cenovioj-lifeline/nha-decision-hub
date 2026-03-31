import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nhwdgstjhugezhqlktie.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5od2Rnc3RqaHVnZXpocWxrdGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTUzMjMsImV4cCI6MjA2ODc3MTMyM30.dsN6HiFYtM1MXxOcyaI-O7vbJxN-si1V3Eth0oIY2JE'

/** Single Supabase client — configured for dhub schema by default */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'dhub' },
})

/** Alias so all existing code keeps working */
export const dhub = {
  from(table: string) {
    return supabase.from(table)
  },
  storage: supabase.storage,
}
