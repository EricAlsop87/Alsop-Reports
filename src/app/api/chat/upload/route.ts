import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseServer'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()
    const buffer = Buffer.from(await file.arrayBuffer())

    const mime = file.type || 'application/octet-stream'
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
