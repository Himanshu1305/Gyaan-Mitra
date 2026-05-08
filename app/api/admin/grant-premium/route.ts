import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // Service role client — bypasses RLS
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body = await req.json()
    const { targetUserId, action } = body

    if (!targetUserId || !action) {
      return NextResponse.json({ error: 'Missing targetUserId or action' }, { status: 400 })
    }

    const tier = action === 'grant' ? 'premium' : 'free'

    // Update profiles table
    const { error: profileError } = await serviceClient
      .from('profiles')
      .update({ subscription_tier: tier })
      .eq('id', targetUserId)

    if (profileError) {
      console.error('Profile update error:', profileError)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Upsert subscriptions table
    const { error: subError } = await serviceClient
      .from('subscriptions')
      .upsert({
        user_id: targetUserId,
        plan: tier,
        status: 'active',
        granted_by_admin: true,
        start_date: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (subError) {
      console.error('Subscription upsert error:', subError)
      // Don't fail — profile was already updated
    }

    return NextResponse.json({ success: true, action, targetUserId })

  } catch (err) {
    console.error('Grant premium error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
