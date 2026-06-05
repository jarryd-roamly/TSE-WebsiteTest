// app/api/region-video/route.ts
// Simplified: file upload now happens client-side direct to R2
// This route only handles the Supabase DB record update

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

// POST: { region: string, url: string } → upsert into cinematic_videos
export async function POST(req: NextRequest) {
  try {
    const { region, url } = await req.json();

    if (!region) return NextResponse.json({ error: 'region required' }, { status: 400 });
    if (!url)    return NextResponse.json({ error: 'url required'    }, { status: 400 });

    const { error } = await sb()
      .from('cinematic_videos')
      .upsert({ region, url }, { onConflict: 'region' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, region, url });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: { region: string } → remove from cinematic_videos
export async function DELETE(req: NextRequest) {
  try {
    const { region } = await req.json();
    if (!region) return NextResponse.json({ error: 'region required' }, { status: 400 });

    const { error } = await sb()
      .from('cinematic_videos')
      .delete()
      .eq('region', region);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
