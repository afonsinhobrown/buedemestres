import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mhipgiiwcsuhtsnbpttv.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oaXBnaWl3Y3N1aHRzbmJwdHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTIwODAsImV4cCI6MjEwNjc2ODA4MH0.U6hNtWFzjMc1NXndSJurHDtSTTIFhrPlnHgGswJrUQs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
