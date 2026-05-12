import { supabase } from './supabase.js'

export async function startRun(searchId) {
  const { data, error } = await supabase
    .from('scrape_runs')
    .insert({ search_id: searchId, status: 'running' })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function finishRun(runId, listingsFound) {
  await supabase.from('scrape_runs')
    .update({ status: 'completed', finished_at: new Date().toISOString(), listings_found: listingsFound })
    .eq('id', runId)
}

export async function failRun(runId, errorMessage) {
  await supabase.from('scrape_runs')
    .update({ status: 'failed', finished_at: new Date().toISOString(), error_message: String(errorMessage) })
    .eq('id', runId)
}
