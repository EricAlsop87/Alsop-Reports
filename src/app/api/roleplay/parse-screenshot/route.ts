import { NextRequest, NextResponse } from "next/server"
import { createWorker } from "tesseract.js"
import sharp from "sharp"

// ── Score regex: matches "83 (06/18/2026)" or "74 (09/21/2026)" ─────────────
const SCORE_PATTERN = /(\d{1,3})\s*[\(\[]\s*(\d{2}\/\d{2}\/\d{4})\s*[\)\]]/g

// ── Convert MM/DD/YYYY → YYYY-MM-DD ──────────────────────────────────────────
function toISODate(mdy: string): string {
  const [mm, dd, yyyy] = mdy.split("/")
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`
}

// ── Clamp score ───────────────────────────────────────────────────────────────
function clampScore(n: number): number | null {
  return n >= 0 && n <= 100 ? n : null
}

export async function POST(req: NextRequest) {
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null

  try {
    const formData = await req.formData()
    const file = formData.get("image") as File | null

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    // ── 1. Convert to buffer ──────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // ── 2. Preprocess with Sharp ──────────────────────────────────────────────
    // The score cells have a light/white background with dark text — good for OCR.
    // We: resize to increase DPI equivalent, convert to greyscale, normalise contrast.
    const processed = await sharp(inputBuffer)
      .resize({ width: 2400, withoutEnlargement: false }) // scale up for better OCR
      .greyscale()
      .normalise()                                         // auto contrast
      .sharpen()
      .toBuffer()

    // ── 3. Run Tesseract ──────────────────────────────────────────────────────
    worker = await createWorker("eng", 1, {
      // Suppress Tesseract logger noise in server logs
      logger: () => {},
      errorHandler: () => {},
    })

    // PSM 6 = assume a single uniform block of text (good for tables)
    await worker.setParameters({
      tessedit_pageseg_mode: "6" as any,
      // Whitelist characters relevant to our data
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -()/.",
    })

    const { data } = await worker.recognize(processed)
    await worker.terminate()
    worker = null

    // ── 4. Parse lines & extract scores ──────────────────────────────────────
    // Strategy: split into lines, for each line collect all score matches.
    // The 3 score columns appear in order: Beginner, Intermediate, Advanced.
    const lines = data.text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 3)

    const TIERS = ["Beginner", "Intermediate", "Advanced"] as const
    type Tier = typeof TIERS[number]

    type ParsedRow = {
      lineText: string
      rowIndex: number
      scores: { tier: Tier; score: number; completedAt: string }[]
    }

    const parsedRows: ParsedRow[] = []
    let rowIndex = 0

    for (const line of lines) {
      const matches: { tier: Tier; score: number; completedAt: string }[] = []
      let m: RegExpExecArray | null
      SCORE_PATTERN.lastIndex = 0

      // Collect all score+date pairs from this line
      while ((m = SCORE_PATTERN.exec(line)) !== null) {
        const rawScore = parseInt(m[1], 10)
        const clamped = clampScore(rawScore)
        if (clamped !== null) {
          matches.push({
            tier: TIERS[matches.length] ?? "Beginner",
            score: clamped,
            completedAt: toISODate(m[2]),
          })
        }
      }

      if (matches.length > 0) {
        parsedRows.push({ lineText: line, rowIndex, scores: matches })
        rowIndex++
      }
    }

    // ── 5. Build response ─────────────────────────────────────────────────────
    // parsedRows[N] corresponds to module at position N in the ordered module list.
    // The calling client is responsible for mapping rowIndex → module.id.
    return NextResponse.json({
      success: true,
      rowCount: parsedRows.length,
      rows: parsedRows.map((r) => ({
        rowIndex: r.rowIndex,
        scores: r.scores,
        rawLine: r.lineText,
      })),
    })
  } catch (err: any) {
    console.error("[roleplay/parse-screenshot] error:", err)
    if (worker) {
      try { await worker.terminate() } catch {}
    }
    return NextResponse.json(
      { error: err.message ?? "OCR failed" },
      { status: 500 }
    )
  }
}
