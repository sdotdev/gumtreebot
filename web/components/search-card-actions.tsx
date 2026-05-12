'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toggleSearchAction, deleteSearchAction } from '@/app/actions/searches'
import Link from 'next/link'

interface Props {
  id: string
  active: boolean
  queryText: string
  matchCount: number
}

export function SearchCardActions({ id, active, queryText, matchCount }: Props) {
  const [togglePending, startToggle] = useTransition()
  const [deletePending, startDelete] = useTransition()

  function handleToggle() {
    startToggle(async () => {
      const result = await toggleSearchAction(id, !active)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(active ? 'Search paused' : 'Search resumed')
      }
    })
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteSearchAction(id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`"${queryText}" deleted`)
      }
    })
  }

  return (
    <>
      <Button asChild size="sm" variant="outline">
        <Link href={`/dashboard/searches/${id}/edit`}>Edit</Link>
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={handleToggle}
        disabled={togglePending}
      >
        {active ? 'Pause' : 'Resume'}
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="destructive" disabled={deletePending}>
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete search?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{queryText}&rdquo; will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button asChild size="sm" variant="ghost" className="ml-auto gap-1.5">
        <Link href={`/alerts?search_id=${id}`}>
          Matches
          <Badge
            variant={matchCount > 0 ? 'default' : 'secondary'}
            className="text-xs px-1.5 py-0"
          >
            {matchCount}
          </Badge>
        </Link>
      </Button>
    </>
  )
}
