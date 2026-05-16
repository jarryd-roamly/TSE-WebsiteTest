// app/api/upload/route.ts
// Handles all media uploads for The Travel Catalogue
// Flow: File → Supabase Storage → CDN URL → suppliers.images JSONB updated
// Uses SERVICE_ROLE_KEY (server-side only — never exposed to client)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── Service role client (server-side only) ────────────────────────────────────
// NEVER use service role key client-side. This file is server-only.
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ── File path convention ──────────────────────────────────────────────────────
// supplier-media/
//   [supplier_id]/
//     images/
//       [timestamp]-[sanitised-filename]
//     reels/
//       [timestamp]-[sanitised-filename]
//     documents/
//       [timestamp]-[sanitised-filename]

function buildStoragePath(
  supplierId: string,
  mediaType: 'images' | 'reels' | 'documents',
  filename: string
): string {
  const ts        = Date.now();
  const sanitised = filename
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-');
  return `${supplierId}/${mediaType}/${ts}-${sanitised}`;
}

// ── POST /api/upload ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData   = await req.formData();
    const file       = formData.get('file') as File | null;
    const supplierId = formData.get('supplier_id') as string | null;
    const mediaType  = (formData.get('media_type') as string | null) ?? 'images';
    const caption    = (formData.get('caption') as string | null) ?? '';
    const roomType   = (formData.get('room_type') as string | null) ?? 'general';
    const isPrimary     = formData.get('is_primary') === 'true';
    const uploadedBy    = (formData.get('uploaded_by') as string | null) ?? 'supplier';
    // TSE admin uploads skip the review queue and go live immediately
    const autoApprove   = uploadedBy === 'admin';

    // ── Validation ──────────────────────────────────────────────────────────
    if (!file)       return NextResponse.json({ error: 'No file provided' },       { status: 400 });
    if (!supplierId) return NextResponse.json({ error: 'supplier_id required' },   { status: 400 });

    const validImageTypes = ['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
    const validVideoTypes = ['video/mp4','video/quicktime','video/mov'];
    const isImage = validImageTypes.includes(file.type);
    const isVideo = validVideoTypes.includes(file.type);

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: `File type ${file.type} not allowed` }, { status: 400 });
    }

    // Image size: 20MB max. Video: 500MB max.
    const maxSize = isVideo ? 500 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Max ${isVideo ? '500MB' : '20MB'}` },
        { status: 400 }
      );
    }

    // ── Upload to Supabase Storage ───────────────────────────────────────────
    const supabase   = getServiceClient();
    const type       = isVideo ? 'reels' : 'images';
    const storagePath = buildStoragePath(supplierId, type as any, file.name);

    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('supplier-media')
      .upload(storagePath, buffer, {
        contentType:  file.type,
        cacheControl: '31536000', // 1 year cache
        upsert:       false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // ── Get public CDN URL ───────────────────────────────────────────────────
    const { data: urlData } = supabase.storage
      .from('supplier-media')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // ── Update suppliers table ───────────────────────────────────────────────
    // Fetch current supplier data
    const { data: supplier, error: fetchError } = await supabase
      .from('suppliers')
      .select('images, reels')
      .eq('id', supplierId)
      .single();

    if (fetchError) {
      console.error('Supplier fetch error:', fetchError);
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    if (isImage) {
      // Build new image record
      const currentImages: any[] = supplier.images ?? [];

      // If this is primary, unset all others
      const updatedImages = isPrimary
        ? currentImages.map((img: any) => ({ ...img, is_primary: false }))
        : [...currentImages];

      const newImage = {
        id:        `img_${Date.now()}`,
        url:       publicUrl,
        path:      storagePath,      // stored for deletion later
        caption,
        room_type: roomType,
        is_primary: isPrimary || currentImages.length === 0, // first image auto-primary
        order:     currentImages.length,
        status:    autoApprove ? 'approved' : 'pending',
        width:     null,             // filled by client after load
        height:    null,
        uploaded_at: new Date().toISOString(),
        uploaded_by: uploadedBy,
      };

      updatedImages.push(newImage);

      const { error: updateError } = await supabase
        .from('suppliers')
        .update({ images: updatedImages })
        .eq('id', supplierId);

      if (updateError) {
        console.error('Supplier update error:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success:  true,
        url:      publicUrl,
        path:     storagePath,
        image_id: newImage.id,
        status:   'pending',
        message:  autoApprove ? 'Image uploaded and live.' : 'Image uploaded. Pending admin review before going live.',
      });

    } else {
      // Video / Reel
      const currentReels: any[] = supplier.reels ?? [];

      const newReel = {
        id:          `reel_${Date.now()}`,
        url:         publicUrl,
        path:        storagePath,
        type:        (formData.get('reel_type') as string) ?? 'room',
        caption,
        approved:    false,
        status:      autoApprove ? 'approved' : 'pending',
        duration_s:  null,           // filled by client after load
        uploaded_at: new Date().toISOString(),
      };

      currentReels.push(newReel);

      const { error: updateError } = await supabase
        .from('suppliers')
        .update({ reels: currentReels })
        .eq('id', supplierId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success:  true,
        url:      publicUrl,
        path:     storagePath,
        reel_id:  newReel.id,
        status:   'pending',
        message:  autoApprove ? 'Reel uploaded and live.' : 'Reel uploaded. Pending admin review before going live.',
      });
    }

  } catch (err: any) {
    console.error('Upload route error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Upload failed' },
      { status: 500 }
    );
  }
}

// ── DELETE /api/upload ────────────────────────────────────────────────────────
// Removes a file from storage and its record from the supplier's images/reels array
export async function DELETE(req: NextRequest) {
  try {
    const { supplier_id, file_id, file_path, media_type } = await req.json();

    if (!supplier_id || !file_id || !file_path) {
      return NextResponse.json({ error: 'supplier_id, file_id, and file_path required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Remove from storage
    const { error: storageError } = await supabase.storage
      .from('supplier-media')
      .remove([file_path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      // Continue anyway — update DB even if storage delete fails
    }

    // Remove from supplier record
    const { data: supplier, error: fetchError } = await supabase
      .from('suppliers')
      .select('images, reels')
      .eq('id', supplier_id)
      .single();

    if (fetchError) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    if (media_type === 'reels') {
      const updatedReels = (supplier.reels ?? []).filter((r: any) => r.id !== file_id);
      await supabase.from('suppliers').update({ reels: updatedReels }).eq('id', supplier_id);
    } else {
      const updatedImages = (supplier.images ?? []).filter((img: any) => img.id !== file_id);
      // If we deleted the primary, make the first remaining image primary
      if (updatedImages.length > 0 && !updatedImages.some((img: any) => img.is_primary)) {
        updatedImages[0].is_primary = true;
      }
      await supabase.from('suppliers').update({ images: updatedImages }).eq('id', supplier_id);
    }

    return NextResponse.json({ success: true, message: 'File deleted' });

  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Delete failed' }, { status: 500 });
  }
}

// ── PATCH /api/upload ─────────────────────────────────────────────────────────
// Update metadata (caption, room_type, is_primary, status) without re-uploading
export async function PATCH(req: NextRequest) {
  try {
    const { supplier_id, file_id, updates, media_type } = await req.json();

    if (!supplier_id || !file_id) {
      return NextResponse.json({ error: 'supplier_id and file_id required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data: supplier, error: fetchError } = await supabase
      .from('suppliers')
      .select('images, reels')
      .eq('id', supplier_id)
      .single();

    if (fetchError) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    if (media_type === 'reels') {
      const updatedReels = (supplier.reels ?? []).map((r: any) =>
        r.id === file_id ? { ...r, ...updates } : r
      );
      await supabase.from('suppliers').update({ reels: updatedReels }).eq('id', supplier_id);
    } else {
      let updatedImages = supplier.images ?? [];

      // If setting primary, unset all others first
      if (updates.is_primary) {
        updatedImages = updatedImages.map((img: any) => ({ ...img, is_primary: false }));
      }
      updatedImages = updatedImages.map((img: any) =>
        img.id === file_id ? { ...img, ...updates } : img
      );

      await supabase.from('suppliers').update({ images: updatedImages }).eq('id', supplier_id);
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Update failed' }, { status: 500 });
  }
}
