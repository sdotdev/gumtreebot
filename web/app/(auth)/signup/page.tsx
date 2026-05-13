import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signupAction } from '@/app/actions/auth'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Create an account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signupAction} className="flex flex-col gap-4">
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                {message}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="display_name" className="text-sm font-medium">
                Display name
              </label>
              <Input id="display_name" name="display_name" type="text" required autoComplete="name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input id="password" name="password" type="password" required autoComplete="new-password" />
            </div>
            <Button type="submit" className="w-full">
              Sign up
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Button asChild variant="link" className="h-auto p-0">
              <Link href="/login">
                Log in
              </Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
