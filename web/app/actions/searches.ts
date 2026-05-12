'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function parseKeywords(raw: FormDataEntryValue | null): string[] {
  if (!raw || typeof raw !== 'string') return []
  return raw.split(',').map(k => k.trim()).filter(Boolean)
}

function buildSearchPayload(formData: FormData) {
  return {
    query_text: formData.get('query_text') as string,
    location_text: (formData.get('location_text') as string) || null,
    min_price: formData.get('min_price') ? Number(formData.get('min_price')) : null,
    max_price: formData.get('max_price') ? Number(formData.get('max_price')) : null,
    radius_km: formData.get('radius_km') ? Number(formData.get('radius_km')) : null,
    category: (formData.get('category') as string) || null,
    include_keywords: parseKeywords(formData.get('include_keywords')),
    exclude_keywords: parseKeywords(formData.get('exclude_keywords')),
    active: formData.get('active') === 'on',
  }
}

export async function createSearchAction(_prev: { error: string } | null, formData: FormData): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { error } = await supabase.from('searches').insert({ user_id: user.id, ...buildSearchPayload(formData) })
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export async function updateSearchAction(id: string, _prev: { error: string } | null, formData: FormData): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { error } = await supabase
    .from('searches')
    .update({ ...buildSearchPayload(formData), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export async function toggleSearchAction(id: string, active: boolean): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { error } = await supabase.from('searches')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return null
}

export async function deleteSearchAction(id: string): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { error } = await supabase.from('searches').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return null
}
