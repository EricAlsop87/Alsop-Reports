import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabaseServer'

// ── Security limits ──
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documents
  'application/pdf', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
])

/**
 * POST /api/chat/upload
 *
 * Uploads a file to Supabase Storage (chat-media bucket).
 *
 * 🔒 Requires: Authenticated user
 * 🛡️ Limits: 20MB max, allowlisted MIME types only
 */
export async function POST(req: NextRequest) {
  // ── Auth check: require logged-in user ──
  try {
    const supabaseSession = await createSupabaseServerClient()
    const { data: { user } } = await supabaseSession.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized — please log in' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // ── File size validation ──
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 20MB.' },
        { status: 413 }
      )
    }

    // ── MIME type validation ──
    const mime = file.type || 'application/octet-stream'
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return NextResponse.json(
        { error: `File type "${mime}" is not allowed.` },
        { status: 415 }
      )
    }

    const supabase = createSupabaseAdmin()
    const buffer = Buffer.from(await file.arrayBuffer())

    const originalName = file.name || 'attachment'
    let ext = 'bin'

    if (mime.includes('pdf') || originalName.endsWith('.pdf')) ext = 'pdf'
    else if (mime.includes('png') || originalName.endsWith('.png')) ext = 'png'
    else if (mime.includes('jpeg') || mime.includes('jpg') || originalName.endsWith('.jpg') || originalName.endsWith('.jpeg')) ext = 'jpg'
    else if (mime.includes('webp') || originalName.endsWith('.webp')) ext = 'webp'
    else if (mime.includes('gif') || originalName.endsWith('.gif')) ext = 'gif'
    else if (mime.includes('svg') || originalName.endsWith('.svg')) ext = 'svg'
    else if (mime.includes('word') || originalName.endsWith('.docx') || originalName.endsWith('.doc')) ext = 'docx'
    else if (mime.includes('sheet') || mime.includes('excel') || originalName.endsWith('.xlsx') || originalName.endsWith('.xls')) ext = 'xlsx'
    else if (mime.includes('csv') || originalName.endsWith('.csv')) ext = 'csv'
    else if (mime.includes('text') || originalName.endsWith('.txt')) ext = 'txt'
    else {
      const parts = originalName.split('.')
      if (parts.length > 1) ext = parts.pop() || 'bin'
    }

    // Clean safe filename
    const sanitizedBase = originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30)
    const fileName = `uploads/${Date.now()}-${sanitizedBase}.${ext}`

    const { error } = await supabase.storage
      .from('chat-media')
      .upload(fileName, buffer, {
        contentType: mime,
        upsert: true,
      })

    if (error) {
      console.error('Storage upload error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: pubData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(fileName)

    return NextResponse.json({
      url: pubData.publicUrl,
      fileName,
      originalName,
      fileType: mime,
      fileSize: file.size,
      ext
    })
  } catch (err: any) {
    console.error('Upload route error:', err)
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 })
  }
}
