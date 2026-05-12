'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type ActionFn = (prev: { error: string } | null, formData: FormData) => Promise<{ error: string } | null>

interface Props {
  action: ActionFn
  submitLabel: string
  children: React.ReactNode
}

export function SearchFormWrapper({ action, submitLabel, children }: Props) {
  const [state, formAction, pending] = useActionState(action, null)

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {children}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
