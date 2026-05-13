'use client'

import { useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'

export default function SettingsPage() {
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const { data } = await supabase
            .from('user_settings')
            .select('email_enabled')
            .eq('user_id', user.id)
            .single()

          setEmailEnabled(data?.email_enabled !== false)
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const toggleEmails = () => {
    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return

        const { error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            email_enabled: !emailEnabled,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })

        if (error) {
          toast.error('Failed to update settings')
        } else {
          setEmailEnabled(!emailEnabled)
          toast.success(
            !emailEnabled
              ? 'Email notifications enabled'
              : 'Email notifications disabled'
          )
        }
      } catch (err) {
        toast.error('Failed to update settings')
      }
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your notification preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Control whether you receive email alerts when listings match your searches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {emailEnabled ? 'Notifications enabled' : 'Notifications disabled'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {emailEnabled
                  ? 'You will receive emails when new listings match your searches'
                  : 'You will not receive email notifications'}
              </p>
            </div>
            <Button
              onClick={toggleEmails}
              disabled={isPending || loading}
              variant={emailEnabled ? 'outline' : 'default'}
            >
              {loading
                ? 'Loading...'
                : emailEnabled
                ? 'Disable'
                : 'Enable'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">About Notifications</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            • When the scraper finds new listings matching your searches, they're grouped into a single email per search
          </p>
          <p>
            • Each email contains all matching listings with direct links to view on Gumtree
          </p>
          <p>
            • Even if notifications are disabled, you can still view all matches in the Alerts section
          </p>
          <p>
            • You can manage which searches are active from the dashboard
          </p>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-base text-blue-900 dark:text-blue-100">Privacy</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200">
          <p>
            We only use your email to send notifications about your searches. We never share your email with third parties.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
