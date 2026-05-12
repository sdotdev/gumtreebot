import { supabase } from './supabase.js'

export async function fetchActiveSearches() {
  try {
    const { data, error } = await supabase
      .from('searches')
      .select('*')
      .eq('active', true)
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error('Error fetching active searches:', err.message, err.stack)
    throw err
  }
}
