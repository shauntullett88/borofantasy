import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const { email, password, username, teamName } = await request.json()

    if (!email || !password || !username || !teamName) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Use service role key — bypasses RLS so the profile insert always works
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Create the auth user, email confirmation disabled
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirms so they can log straight in
    })

    if (authError) {
      // Surface readable errors — e.g. "User already registered"
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    // Insert profile row — service role bypasses RLS so this always works
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: userId, username: username.trim(), team_name: teamName.trim(), email, is_admin: false })

    if (profileError) {
      // If the profile insert fails, clean up the auth user so they can try again
      await supabaseAdmin.auth.admin.deleteUser(userId)
      if (profileError.code === '23505') {
        return NextResponse.json({ error: 'That name is already taken — please choose another' }, { status: 400 })
      }
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
