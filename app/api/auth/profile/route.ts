import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ isAdmin: false, subscriptionTier: 'free' })

  const token = authHeader.replace('Bearer ', '')

  // Use anon client to verify the token and get user
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await anonClient.auth.getUser(token)
  if (!user) return NextResponse.json({ isAdmin: false, subscriptionTier: 'free' })

  // Use service role client to bypass RLS and read profile
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('is_admin, subscription_tier')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    isAdmin: profile?.is_admin === true,
    subscriptionTier: profile?.subscription_tier ?? 'free'
  })
}
