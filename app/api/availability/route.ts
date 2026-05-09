import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zhkpxmcoklbmpsdcjffb.supabase.co'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_LjKnraC4RwaYLS9F-P-kww_nKljckkn'

type Pillar = 'hotel'|'flight'|'charter'|'transfer'|'activity'
const MARGINS:Record<Pillar,number> = {
  hotel:1.15, flight:1.08, charter:1.08, transfer:1.20, activity:1.18
}

function getSupabase(){
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

export async function POST(req:NextRequest){
  const start = Date.now()
  let body:any
  try { body = await req.json() }
  catch { return NextResponse.json({success:false,error:'Invalid JSON'},{status:400}) }

  const { supplier_id, pillar='hotel', check_in, nights=1, pax_count=2, room_type } = body
  if(!supplier_id||!check_in){
    return NextResponse.json({success:false,error:'Missing supplier_id or check_in'},{status:400})
  }

  const supabase = getSupabase()

  const cacheKey = `${supplier_id}:${pillar}:${check_in}:${nights}:${pax_count}:${room_type||'any'}`
  const { data:cached } = await supabase
    .from('availability_cache')
    .select('response_payload')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single()

  if(cached){
    return NextResponse.json({
      success:true,
      result:{...cached.response_payload, cache_hit:true, response_ms:Date.now()-start}
    })
  }

  const { data:supplier } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', supplier_id)
    .single()

  const netRate = 50000
  const margin = MARGINS[pillar as Pillar] || 1.15
  const displayRate = Math.round(netRate * margin)
  const available = Math.random() > 0.15

  const result = {
    supplier_id, pillar, check_in, available,
    options: available ? [{
      label: room_type || (supplier?.name ? `${supplier.name} — Standard Room` : 'Standard Room'),
      available: true,
      capacity_remaining: Math.floor(Math.random()*3)+1,
      rate_zar: netRate,
      display_rate_zar: displayRate,
      meal_basis: 'All-inclusive',
      addons: [{label:'Early check-in', extra_zar:1800}],
      external_ref: 'DEMO_001'
    }] : [],
    source: 'supabase',
    cache_hit: false,
    response_ms: Date.now()-start
  }

  await supabase.from('availability_cache').upsert({
    cache_key: cacheKey,
    provider: 'supabase',
    supplier_id,
    response_payload: result,
    is_available: available,
    expires_at: new Date(Date.now()+300000).toISOString()
  }, { onConflict:'cache_key' })

  return NextResponse.json({success:true, result})
}

export async function DELETE(req:NextRequest){
  const { hold_token, reason='user_cancelled' } = await req.json()
  if(!hold_token){
    return NextResponse.json({error:'hold_token required'},{status:400})
  }
  const supabase = getSupabase()
  await supabase
    .from('availability_holds')
    .update({
      status:'released',
      released_at: new Date().toISOString(),
      release_reason: reason
    })
    .eq('hold_token', hold_token)
    .eq('status','active')
  return NextResponse.json({success:true})
}