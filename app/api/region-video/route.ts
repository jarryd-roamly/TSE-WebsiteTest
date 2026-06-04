// app/api/admin/region-video/route.ts
// Uploads a region cinematic MP4 and upserts into cinematic_videos table
// Uses SERVICE_ROLE_KEY — server-side only

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const form   = await req.formData();
    const file   = form.get('file') as File | null;
    const region = (form.get('region') as string | null)?.trim();

    if (!file)   return NextResponse.json({ error: 'No file'          }, { status: 400 });
    if (!region) return NextResponse.json({ error: 'region required'  }, { status: 400 });

    const validTypes = ['video/mp4', 'video/quicktime', 'video/mov'];
    if (!validTypes.includes(file.type))
      return NextResponse.json({ error: `File type ${file.type} not allowed` }, { status: 400 });
    if (file.size > 500 * 1024 * 1024)
      return NextResponse.json({ error: 'Max 500MB'                          }, { status: 400 });

    const client    = sb();
    const ts        = Date.now();
    const safe      = file.name.toLowerCase().replace(/[^a-z0-9.\-_]/g, '-');
    const storagePath = `cinematic/${region}/${ts}-${safe}`;

    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await client.storage
      .from('supplier-media')
      .upload(storagePath, buf, { contentType: file.type, cacheControl: '31536000', upsert: true });

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const { data: { publicUrl } } = client.storage
      .from('supplier-media')
      .getPublicUrl(storagePath);

    // Upsert into cinematic_videos — one row per region
    const { error: dbErr } = await client
      .from('cinematic_videos')
      .upsert({ region, url: publicUrl }, { onConflict: 'region' });

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    return NextResponse.json({ success: true, url: publicUrl, region });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { region } = await req.json();
    if (!region) return NextResponse.json({ error: 'region required' }, { status: 400 });
    const { error } = sb().from('cinematic_videos').delete().eq('region', region);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
