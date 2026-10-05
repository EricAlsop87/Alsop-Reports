import { NextRequest, NextResponse } from 'next/server'

interface CacheEntry {
  title: string | null
  timestamp: number
}

// In-memory server cache to avoid repeated external requests
const PREVIEW_CACHE = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function cleanTitle(raw: string): string {
  let cleaned = decodeHtmlEntities(raw)
  // Strip Google Workspace brand suffixes
  cleaned = cleaned
    .replace(/\s*-\s*Google\s+(?:Sheets|Docs|Slides|Drive|Forms)(?:\s*-\s*Google\s+Drive)?$/i, '')
    .trim()
  return cleaned
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const targetUrl = searchParams.get('url')?.trim()

    if (!targetUrl) {
      return NextResponse.json({ success: false, error: 'URL parameter is required' }, { status: 400 })
    }

    let parsed: URL
    try {
      parsed = new URL(targetUrl)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return NextResponse.json({ success: false, error: 'Invalid URL protocol' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid URL format' }, { status: 400 })
    }

    // Check memory cache
    const cached = PREVIEW_CACHE.get(targetUrl)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(
        { success: !!cached.title, title: cached.title, url: targetUrl, cached: true },
        {
          headers: {
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
          },
        }
      )
    }

    // Fetch HTML with a short timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    let html = ''
    let isOk = false
    try {
      const res = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      })
      isOk = res.ok
      if (isOk) {
        html = await res.text()
      }
    } catch (fetchErr) {
      // Abort or network failure
    } finally {
      clearTimeout(timeout)
    }

    let foundTitle: string | null = null

    if (isOk && html) {
      // 1. og:title
      const ogMatch =
        html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
        html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i)

      // 2. twitter:title
      const twMatch =
        html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i) ||
        html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']twitter:title["']/i)

      // 3. <title> tag
      const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)

      const rawTitle = ogMatch?.[1] || twMatch?.[1] || titleTagMatch?.[1]
      if (rawTitle) {
        const processed = cleanTitle(rawTitle)
        // Avoid generic non-titles like "Google Docs: Sign-in"
        if (
          processed &&
          !/sign[- ]in/i.test(processed) &&
          !/access denied/i.test(processed) &&
          !/login/i.test(processed)
        ) {
          foundTitle = processed
        }
      }
    }

    // Store in cache
    PREVIEW_CACHE.set(targetUrl, { title: foundTitle, timestamp: Date.now() })

    return NextResponse.json(
      { success: !!foundTitle, title: foundTitle, url: targetUrl },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    )
  } catch (err: any) {
    return NextResponse.json({ success: false, title: null, error: err.message }, { status: 500 })
  }
}
