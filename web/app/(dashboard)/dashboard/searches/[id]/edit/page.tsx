import { createClient } from '@/lib/supabase/server'
import { updateSearchAction } from '@/app/actions/searches'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchFormWrapper } from '@/components/search-form-wrapper'
import { redirect } from 'next/navigation'

interface Search {
  id: string
  query_text: string
  location_text: string | null
  min_price: number | null
  max_price: number | null
  radius_km: number | null
  category: string | null
  include_keywords: string[]
  exclude_keywords: string[]
  active: boolean
}

export default async function EditSearchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: search } = await supabase
    .from('searches')
    .select('*')
    .eq('id', id)
    .single()

  if (!search) redirect('/dashboard')

  const s = search as Search
  const updateWithId = updateSearchAction.bind(null, s.id)

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Edit Search</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Search details</CardTitle>
        </CardHeader>
        <CardContent>
          <SearchFormWrapper action={updateWithId} submitLabel="Save changes">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="query_text" className="text-sm font-medium">Search term <span className="text-destructive">*</span></label>
              <Input id="query_text" name="query_text" type="text" required defaultValue={s.query_text} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="location_text" className="text-sm font-medium">Location</label>
              <Input id="location_text" name="location_text" type="text" defaultValue={s.location_text ?? ''} placeholder="e.g. London" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="min_price" className="text-sm font-medium">Min price (£)</label>
                <Input id="min_price" name="min_price" type="number" min="0" step="0.01" defaultValue={s.min_price ?? ''} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="max_price" className="text-sm font-medium">Max price (£)</label>
                <Input id="max_price" name="max_price" type="number" min="0" step="0.01" defaultValue={s.max_price ?? ''} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="radius_km" className="text-sm font-medium">Radius (km)</label>
              <p className="text-xs text-muted-foreground">Distance from the location to search within. Leave blank for nationwide.</p>
              <Input id="radius_km" name="radius_km" type="number" min="0" defaultValue={s.radius_km ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="category" className="text-sm font-medium">Category</label>
              <p className="text-xs text-muted-foreground">Gumtree category slug, e.g. <code className="font-mono">for-sale-cars-vans-motorbikes</code>. Leave blank to search all.</p>
              <Input id="category" name="category" type="text" defaultValue={s.category ?? ''} placeholder="e.g. for-sale-phones-pdas" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="include_keywords" className="text-sm font-medium">Must include keywords</label>
              <p className="text-xs text-muted-foreground">Listing title must contain at least one of these (comma-separated).</p>
              <Input id="include_keywords" name="include_keywords" type="text" defaultValue={s.include_keywords?.join(', ') ?? ''} placeholder="e.g. iphone, 128gb" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="exclude_keywords" className="text-sm font-medium">Exclude keywords</label>
              <p className="text-xs text-muted-foreground">Skip listings whose title contains any of these (comma-separated).</p>
              <Input id="exclude_keywords" name="exclude_keywords" type="text" defaultValue={s.exclude_keywords?.join(', ') ?? ''} placeholder="e.g. cracked, spares" />
            </div>
            <div className="flex items-center gap-2">
              <input id="active" name="active" type="checkbox" value="on" defaultChecked={s.active} className="h-4 w-4 rounded border-input" />
              <label htmlFor="active" className="text-sm font-medium">Active</label>
            </div>
          </SearchFormWrapper>
        </CardContent>
      </Card>
    </div>
  )
}
