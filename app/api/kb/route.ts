import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// /api/kb — Knowledge Base CRUD
//
// GET    /api/kb                  list entries (filtered)
// GET    /api/kb?id=uuid          single entry
// POST   /api/kb                  create entry
// PATCH  /api/kb?id=uuid          update entry (creates new version)
// DELETE /api/kb?id=uuid          archive entry (never hard delete)
//
// POST   /api/kb?action=flag      flag an entry
// POST   /api/kb?action=verify    mark entry verified (admin only)
// POST   /api/kb?action=validate  trigger external web validation
//
// Role permissions (read from session stored in Supabase or cookie):
//   edition_admin   → full CRUD + delete + verify
//   edition_ops     → create + edit own + flag
//   edition_content → create + edit own + flag
//   edition_finance → flag only
//   supplier_*      → no access
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

// Use service role for writes, anon for reads
function db(useService = false) {
  return createClient(SUPABASE_URL, useService ? SERVICE_KEY : SUPABASE_KEY);
}

// ── Auth helper ───────────────────────────────────────────────────────────────
// Reads session from the tse_session cookie set by admin login.
// Returns null if not authenticated or not an edition team member.
function getSession(req: NextRequest): {
  name:  string;
  email: string;
  role:  string;
} | null {
  const header = req.headers.get('x-tse-session');
  if (!header) return null;
  try {
    const session = JSON.parse(header);
    if (session?.type !== 'edition') return null;
    return { name: session.name, email: session.email, role: session.role };
  } catch {
    return null;
  }
}

function canWrite(role: string): boolean {
  return ['edition_admin', 'edition_ops', 'edition_content'].includes(role);
}

function canAdmin(role: string): boolean {
  return role === 'edition_admin';
}

// Safe columns to return — never return guardrails or commercial entries
// to non-admin roles. The full set is returned for edition_admin.
const PUBLIC_COLUMNS  = 'id,edition_id,entry_type,claim_type,region_slug,supplier_id,linked_name,title,highlights,tips,logistics_notes,seasonal_notes,guidance_importance,internal_only,status,version,created_by_name,created_at,evidence_strength,ext_confirm_count,ext_query_count,flag_count,times_used_in_planner,last_used_at';
const INTERNAL_COLUMNS = PUBLIC_COLUMNS + ',guardrails,specialist_recs,override_ai,supersedes_id,change_reason,created_by_email,created_by_role,updated_by_name,updated_by_email,updated_at,verified_by,verified_at,verification_sources,flags,ext_sources,last_validated_at,visit_id';

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const session = getSession(req);

  const id          = searchParams.get('id');
  const regionSlug  = searchParams.get('region_slug');
  const supplierId  = searchParams.get('supplier_id');
  const entryType   = searchParams.get('entry_type');
  const claimType   = searchParams.get('claim_type');
  const status      = searchParams.get('status') ?? 'active';
  const importance  = searchParams.get('guidance_importance');
  const overrideOnly = searchParams.get('override_only') === 'true';
  const internalOnly = searchParams.get('internal_only');
  const authorEmail = searchParams.get('created_by_email');
  const editionId   = searchParams.get('edition_id') ?? 'safari';
  const limit       = Math.min(Number(searchParams.get('limit')) || 50, 200);
  const offset      = Number(searchParams.get('offset')) || 0;

  // Non-admin sessions can only see non-commercial, non-internal entries
  // (same as the RLS policy — belt-and-suspenders)
const isAdmin   = session && canAdmin(session.role)
  const isEdition = session && canWrite(session.role)

  const cols = isAdmin ? INTERNAL_COLUMNS : PUBLIC_COLUMNS;
  const supabase = db(false);

  // Single entry fetch
  if (id) {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select(cols)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    // Strip commercial/internal from non-edition viewers
    if (!isEdition) {
      if ((data as any).internal_only || (data as any).claim_type === 'commercial') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, entry: data });
  }

  // List with filters
  let query = supabase
    .from('knowledge_base')
    .select(cols, { count: 'exact' })
    .eq('edition_id', editionId)
    .order('guidance_importance', { ascending: false })
    .order('evidence_strength',   { ascending: false })
    .order('created_at',          { ascending: false })
    .range(offset, offset + limit - 1);

  // Status filter
  if (status !== 'all') query = query.eq('status', status);

  // Region filter
  if (regionSlug) {
    const slugs = regionSlug.split(',').filter(Boolean);
    if (slugs.length === 1) query = query.eq('region_slug', slugs[0]);
    else                    query = query.in('region_slug', slugs);
  }

  // Supplier filter
  if (supplierId) query = query.eq('supplier_id', supplierId);

  // Entry type filter
  if (entryType) query = query.eq('entry_type', entryType);

  // Claim type filter
  if (claimType) query = query.eq('claim_type', claimType);

  // Guidance importance filter
  if (importance) query = query.eq('guidance_importance', Number(importance));

  // Override-only filter
  if (overrideOnly) query = query.eq('override_ai', true);

  // Internal/public filter
  if (internalOnly === 'true')  query = query.eq('internal_only', true);
  if (internalOnly === 'false') query = query.eq('internal_only', false);

  // Author filter
  if (authorEmail && isEdition) query = query.eq('created_by_email', authorEmail);

  // Non-edition viewers: strip commercial and internal entries
  if (!isEdition) {
    query = query
      .eq('internal_only', false)
      .neq('claim_type', 'commercial');
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[KB GET]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    entries: data ?? [],
    total:   count ?? 0,
    offset,
    limit,
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action  = searchParams.get('action');
  const session = getSession(req);

  // All POST actions require edition team auth
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 });
  }

  const body = await req.json();

  // ── Flag an entry ──────────────────────────────────────────────────────────
  if (action === 'flag') {
    const { id, reason, note } = body;
    if (!id || !reason) {
      return NextResponse.json({ success: false, error: 'id and reason required' }, { status: 400 });
    }

    const supabase = db(true);

    // Fetch current flags
    const { data: current } = await supabase
      .from('knowledge_base')
      .select('flags, flag_count, status')
      .eq('id', id)
      .single();

    if (!current) {
      return NextResponse.json({ success: false, error: 'Entry not found' }, { status: 404 });
    }

    const existingFlags: any[] = current.flags ?? [];
    const newFlag = {
      by_name:    session.name,
      by_email:   session.email,
      by_role:    session.role,
      reason,
      note:       note ?? null,
      flagged_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('knowledge_base')
      .update({
        flags:      [...existingFlags, newFlag],
        flag_count: (current.flag_count ?? 0) + 1,
        status:     'flagged',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Entry flagged' });
  }

  // ── Verify an entry (admin only) ───────────────────────────────────────────
  if (action === 'verify') {
    if (!canAdmin(session.role)) {
      return NextResponse.json({ success: false, error: 'Admin only' }, { status: 403 });
    }

    const { id } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const { error } = await db(true)
      .from('knowledge_base')
      .update({
        verified_by: session.email,
        verified_at: new Date().toISOString(),
        status:      'active',
        updated_at:  new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Entry verified' });
  }

  // ── Trigger external validation for a factual entry ───────────────────────
  if (action === 'validate') {
    if (!canWrite(session.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 403 });
    }

    const { id } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const { data: entry } = await db(false)
      .from('knowledge_base')
      .select('id, title, claim_type, highlights, tips, logistics_notes, linked_name, region_slug')
      .eq('id', id)
      .single();

    if (!entry || entry.claim_type === 'experiential') {
      return NextResponse.json({
        success: false,
        error: 'Validation only runs on factual, logistical, and health entries',
      }, { status: 400 });
    }

    // Build a search query from the entry content
    const searchQuery = [
      entry.linked_name,
      ...(entry.highlights ?? []).slice(0, 2),
      entry.logistics_notes?.slice(0, 100),
    ].filter(Boolean).join(' ');

    // Use Claude web search to find confirming/querying sources
    const sources = await runWebValidation(entry.title, searchQuery, entry.linked_name);

    const confirms = sources.filter((s: any) => s.verdict === 'confirms').length;
    const queries  = sources.filter((s: any) => s.verdict === 'queries').length;

    const { error } = await db(true)
      .from('knowledge_base')
      .update({
        ext_sources:        sources,
        ext_confirm_count:  confirms,
        ext_query_count:    queries,
        last_validated_at:  new Date().toISOString(),
        updated_at:         new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      confirms,
      queries,
      sources,
    });
  }

  // ── Create new entry ───────────────────────────────────────────────────────
  if (!canWrite(session.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 403 });
  }

  const {
    edition_id = 'safari',
    entry_type, claim_type = 'experiential',
    supplier_id, region_slug, linked_name, visit_id,
    title, highlights, tips, guardrails, specialist_recs,
    logistics_notes, seasonal_notes,
    guidance_importance = 1,
    internal_only = true,
  } = body;

  if (!entry_type || !linked_name || !title) {
    return NextResponse.json({
      success: false,
      error: 'entry_type, linked_name and title are required',
    }, { status: 400 });
  }

  // Commercial entries are always internal_only — enforce server-side
  const effectiveInternal = claim_type === 'commercial' ? true : internal_only;

  const payload = {
    edition_id,
    entry_type,
    claim_type,
    supplier_id:        supplier_id  ?? null,
    region_slug:        region_slug  ?? null,
    linked_name,
    visit_id:           visit_id     ?? null,
    title,
    highlights:         highlights   ?? [],
    tips:               tips         ?? [],
    guardrails:         guardrails   ?? [],
    specialist_recs:    specialist_recs ?? [],
    logistics_notes:    logistics_notes ?? null,
    seasonal_notes:     seasonal_notes  ?? null,
    guidance_importance,
    internal_only:      effectiveInternal,
    status:             'active',
    version:            1,
    created_by_name:    session.name,
    created_by_email:   session.email,
    created_by_role:    session.role,
    created_at:         new Date().toISOString(),
    evidence_strength:  1,
    verification_sources: [],
    flag_count:         0,
    flags:              [],
    ext_confirm_count:  0,
    ext_query_count:    0,
    ext_sources:        [],
    times_used_in_planner: 0,
  };

  const { data, error } = await db(true)
    .from('knowledge_base')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[KB POST]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, entry: data }, { status: 201 });
}

// ── PATCH — update entry (creates new version, supersedes old) ────────────────
export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id      = searchParams.get('id');
  const session = getSession(req);

  if (!session || !canWrite(session.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
  }

  const body = await req.json();
  const { change_reason, ...fields } = body;

  if (!change_reason) {
    return NextResponse.json({
      success: false,
      error: 'change_reason is required for all updates',
    }, { status: 400 });
  }

  const supabase = db(true);

  // Fetch the current entry
  const { data: current, error: fetchError } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ success: false, error: 'Entry not found' }, { status: 404 });
  }

  // Non-admins can only edit their own entries
  if (!canAdmin(session.role) && current.created_by_email !== session.email) {
    return NextResponse.json({
      success: false,
      error: 'You can only edit your own entries. Flag this entry to request a change.',
    }, { status: 403 });
  }

  // Mark the old entry as superseded
  await supabase
    .from('knowledge_base')
    .update({ status: 'superseded', updated_at: new Date().toISOString() })
    .eq('id', id);

  // Enforce commercial = always internal
  const effectiveInternal = (fields.claim_type ?? current.claim_type) === 'commercial'
    ? true
    : (fields.internal_only ?? current.internal_only);

  // Create the new version
  const newVersion = {
    ...current,
    ...fields,
    id:               undefined, // let Supabase generate new UUID
    internal_only:    effectiveInternal,
    status:           'active',
    version:          (current.version ?? 1) + 1,
    supersedes_id:    id,
    change_reason,
    created_by_name:  session.name,
    created_by_email: session.email,
    created_by_role:  session.role,
    created_at:       new Date().toISOString(),
    updated_by_name:  null,
    updated_by_email: null,
    updated_at:       null,
    // Reset validation state on new version
    ext_confirm_count: 0,
    ext_query_count:   0,
    ext_sources:       [],
    last_validated_at: null,
    times_used_in_planner: 0,
    flag_count:        0,
    flags:             [],
  };

  const { data: newEntry, error: insertError } = await supabase
    .from('knowledge_base')
    .insert(newVersion)
    .select()
    .single();

  if (insertError) {
    console.error('[KB PATCH]', insertError.message);
    // Roll back the supersede
    await supabase
      .from('knowledge_base')
      .update({ status: 'active' })
      .eq('id', id);
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success:         true,
    entry:           newEntry,
    superseded_id:   id,
    new_version:     newEntry.version,
  });
}

// ── DELETE — archive only, never hard delete ──────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id      = searchParams.get('id');
  const session = getSession(req);

  if (!session || !canAdmin(session.role)) {
    return NextResponse.json({ success: false, error: 'Admin only' }, { status: 403 });
  }

  if (!id) {
    return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
  }

  const { error } = await db(true)
    .from('knowledge_base')
    .update({
      status:           'archived',
      updated_by_name:  session.name,
      updated_by_email: session.email,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Entry archived. Knowledge is preserved — use status=archived filter to view.',
  });
}

// ── Web validation helper ─────────────────────────────────────────────────────
// Uses Claude with web search to find confirming or querying sources.
// Only runs on factual/logistical entries — never on experiential or commercial.
async function runWebValidation(
  title:       string,
  searchQuery: string,
  linkedName:  string,
): Promise<any[]> {
  if (!ANTHROPIC_KEY) return [];

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 800,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search',
        }],
        system: 'You validate travel knowledge base entries against current online sources. Return ONLY JSON.',
        messages: [{
          role:    'user',
          content: `Search for current information about: "${searchQuery}"

Find 2-3 sources that either CONFIRM or QUERY this KB entry:
Title: ${title}
Property/Region: ${linkedName}

Return ONLY this JSON array (no markdown):
[{
  "url": "https://...",
  "source_type": "google_review|bushbreaks|competitor|health_gov|airline|web",
  "snippet": "brief relevant excerpt under 100 chars",
  "verdict": "confirms|queries|neutral"
}]

"queries" = the source raises questions about this claim's accuracy.
"confirms" = the source supports this claim.
Only include sources directly relevant to the claim. Max 3 sources.`,
        }],
      }),
    });

    const data = await res.json();

    // Extract text from response (may include tool_use blocks)
    const text = (data.content ?? [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    const s = text.indexOf('[');
    const e = text.lastIndexOf(']');
    if (s === -1 || e <= s) return [];

    const sources = JSON.parse(text.slice(s, e + 1));
    return Array.isArray(sources)
      ? sources.map((src: any) => ({ ...src, checked_at: new Date().toISOString() }))
      : [];
  } catch {
    return [];
  }
}
