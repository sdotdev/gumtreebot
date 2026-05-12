import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Never miss a Gumtree deal
        </h1>
        <p className="text-lg text-muted-foreground">
          Get emailed the moment a new listing matches your search.
        </p>
        <div className="flex gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Sign up</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Log in</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
