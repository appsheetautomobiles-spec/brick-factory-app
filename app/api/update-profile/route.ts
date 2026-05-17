import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, fullName } = await req.json();
    if (!userId || !fullName?.trim()) {
      return NextResponse.json({ error: 'Missing userId or fullName' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({ full_name: fullName.trim() })
      .eq('id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
