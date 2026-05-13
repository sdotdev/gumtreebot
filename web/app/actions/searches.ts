'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function parseKeywords(raw: FormDataEntryValue | null): string[] {
  if (!raw || typeof raw !== 'string') return []
  return raw.split(',').map(k => k.trim()).filter(Boolean)
}

function validateSearch(payload: any): string | null {
  if (!payload.query_text?.trim()) {
    return 'Search term is required'
  }
  if (payload.query_text.length > 200) {
    return 'Search term must be 200 characters or less'
  }
  if (payload.location_text && payload.location_text.length > 100) {
    return 'Location must be 100 characters or less'
  }
  if (payload.category && payload.category.length > 100) {
    return 'Category must be 100 characters or less'
  }
  if (payload.min_price !== null && payload.min_price < 0) {
    return 'Minimum price must be 0 or greater'
  }
  if (payload.max_price !== null && payload.max_price < 0) {
    return 'Maximum price must be 0 or greater'
  }
  if (payload.min_price !== null && payload.max_price !== null && payload.min_price > payload.max_price) {
    return 'Minimum price must be less than maximum price'
  }
  if (payload.radius_km !== null && payload.radius_km < 0) {
    return 'Radius must be 0 or greater'
  }
  if (payload.radius_km !== null && payload.radius_km > 50000) {
    return 'Radius must be 50000 km or less'
  }
  const allKeywords = [...payload.include_keywords, ...payload.exclude_keywords]
  for (const keyword of allKeywords) {
    if (keyword.length > 50) {
      return 'Each keyword must be 50 characters or less'
    }
  }
  if (allKeywords.length > 50) {
    return 'Maximum 50 keywords total allowed'
  }
  return null
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
  const payload = buildSearchPayload(formData)
  const validationError = validateSearch(payload)
  if (validationError) return { error: validationError }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { error } = await supabase.from('searches').insert({ user_id: user.id, ...payload })
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export async function updateSearchAction(id: string, _prev: { error: string } | null, formData: FormData): Promise<{ error: string } | null> {
  const payload = buildSearchPayload(formData)
  const validationError = validateSearch(payload)
  if (validationError) return { error: validationError }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { error } = await supabase
    .from('searches')
    .update({ ...payload, updated_at: new Date().toISOString() })
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

export async function toggleEmailNotificationsAction(enabled: boolean): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('user_settings').upsert({
    user_id: user.id,
    email_enabled: enabled,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) return { error: error.message }
  return null
}
