import { supabase } from './supabase.js'

export async function fetchActiveSearches() {
  const { data, error } = await supabase
    .from('searches')
    .select('*')
    .eq('active', true)
  if (error) throw error
  return data ?? []
}
