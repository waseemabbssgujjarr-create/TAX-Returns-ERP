/** Minimal PDF 1.4 text builder — Latin Helvetica only (Playwright path later for Urdu glyphs). */

function pdfEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

const PAGE_HEIGHT = 792
const TOP = 780
const BOTTOM = 48
const LINE_HEIGHT = 14
const LINES_PER_PAGE = Math.floor((TOP - BOTTOM) / LINE_HEIGHT)

function buildPageContent(pageLines: string[]): string {
  const contentParts: string[] = ['BT', '/F1 11 Tf', `50 ${TOP} Td`, `${LINE_HEIGHT} TL`]
  pageLines.forEach((line, i) => {
    if (i === 0) contentParts.push(`(${pdfEscape(line)}) Tj`)
    else contentParts.push(`T* (${pdfEscape(line)}) Tj`)
  })
  contentParts.push('ET')
  return contentParts.join('\n')
}

/** Multi-page staff PDF. Non-ASCII stripped for Helvetica safety. */
export function buildSimplePdf(lines: string[]): Buffer {
  const safeLines = lines.map((line) => line.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?'))

  const pages: string[][] = []
  for (let i = 0; i < safeLines.length; i += LINES_PER_PAGE) {
    pages.push(safeLines.slice(i, i + LINES_PER_PAGE))
  }
  if (pages.length === 0) pages.push(['(empty)'])

  const fontObj = 3 + pages.length * 2
  const pageObjNums = pages.map((_, p) => 3 + p * 2)

  const objBodies: string[] = []
  objBodies.push(`1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj`)
  objBodies.push(
    `2 0 obj<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>endobj`,
  )

  for (let p = 0; p < pages.length; p++) {
    const pageObj = 3 + p * 2
    const contentObj = pageObj + 1
    const stream = buildPageContent(pages[p]!)
    objBodies.push(
      `${pageObj} 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 ${PAGE_HEIGHT}] /Contents ${contentObj} 0 R /Resources << /Font << /F1 ${fontObj} 0 R >> >> >>endobj`,
    )
    objBodies.push(
      `${contentObj} 0 obj<< /Length ${Buffer.byteLength(stream, 'utf8')} >>stream\n${stream}\nendstream endobj`,
    )
  }
  objBodies.push(`${fontObj} 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj`)

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (const obj of objBodies) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += `${obj}\n`
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objBodies.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer<< /Size ${objBodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`
  return Buffer.from(pdf, 'utf8')
}

/** @internal exported for tests */
export const _pdfInternals = { LINES_PER_PAGE }
