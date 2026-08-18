import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import puppeteer from 'puppeteer'
import { existsSync } from 'fs'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { ObjectStorageService } from '../../../Common_Pages/storage/object-storage.service'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

type PdfKind = 'draft' | 'final'

@Injectable()
export class PdfReportService {
  constructor(private readonly db: DatabaseService, private readonly storage: ObjectStorageService) {}

  private async browserPath() {
    const configured = process.env.PDF_CHROME_PATH?.trim()
    const candidates = [
      configured,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ].filter((path): path is string => Boolean(path))
    const installed = candidates.find((path) => existsSync(path))
    if (installed) return installed
    try { return await puppeteer.executablePath() } catch { return undefined }
  }

  async generate(projectId: string, kind: PdfKind, user: AuthUser, authorization: string) {
    const id = projectId.trim()
    const result = await this.db.query(
      `SELECT d.data->>'reportHtml' AS report_html, d.review_status,
              COALESCE(d.paid, false) AS paid,
              COALESCE(d.final_report_object_key, '') AS final_report_object_key,
              EXISTS (
                SELECT 1 FROM valuations v
                 WHERE v.project_id = d.project_id AND v.technical_officer_id = $2
              ) AS assigned_to_officer,
              EXISTS (
                SELECT 1 FROM valuations v
                 WHERE v.project_id = d.project_id
                   AND v.details->>'bankBranchCode' = $2
              ) AS linked_to_bank
         FROM drafts d WHERE d.project_id = $1`,
      [id, user.userId],
    )
    const row = result.rows[0]
    if (!row || !String(row.report_html ?? '').trim()) throw new NotFoundException('Saved report content not found.')

    const status = String(row.review_status ?? 'draft')
    const locked = status === 'locked'
    if (kind === 'final') {
      if (!locked) throw new ForbiddenException('The final PDF is available only after the report is locked.')
      const requestingBank = user.role === 'Bank' && Boolean(row.linked_to_bank) && Boolean(row.paid)
      if (user.role !== 'Manager L1' && !requestingBank) {
        throw new ForbiddenException('Only Manager L1 or the requesting bank with confirmed payment can download the finalized PDF.')
      }
      if (row.final_report_object_key) {
        const stored = await this.storage.read(String(row.final_report_object_key))
        if (stored) return stored
        throw new NotFoundException('The finalized PDF could not be found in object storage.')
      }
    } else {
      if (locked) throw new ForbiddenException('Use the finalized PDF for a locked report.')
      const manager = user.role.startsWith('Manager L')
      const assignedOfficer = user.role === 'Technical Officer' && Boolean(row.assigned_to_officer)
      if (!manager && !assignedOfficer) throw new ForbiddenException('You do not have access to this draft PDF.')
    }

    return this.render(String(row.report_html), id, kind, authorization)
  }

  // Render the exact approved HTML into a PDF. Manager L1 uses this before
  // locking so the immutable artifact can be persisted in object storage.
  async render(reportHtml: string, projectId: string, kind: PdfKind, authorization = '') {
    const id = projectId.trim()
    const origin = `http://127.0.0.1:${process.env.PORT ?? 4000}`
    const watermark = kind === 'draft'
      ? '<div class="draft-watermark">DRAFT – FOR REVIEW</div>'
      : ''
    const htmlDocument = `<!doctype html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'"><base href="${origin}/">
<style>
  @page { size: A4; margin: 20mm 18mm 22mm 18mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111; }
  body { font-family: Georgia, "Times New Roman", serif; font-size: 10.5pt; line-height: 1.5; }
  .report-root { width: 100%; max-width: 100%; }
  /* Authored report pages use a 1000px browser-preview height. The printable
     area inside our A4 margins is shorter, so constrain those page wrappers
     to the real content box instead of allowing their footer to spill. */
  .report-page { width: 100%; min-height: 235mm !important; display: flex !important; flex-direction: column !important; break-after: page !important; page-break-after: always !important; }
  .report-page:last-child { break-after: page !important; page-break-after: always !important; }
  .report-page > [style*="border-top:2px solid #1f3a4d"],
  .report-page > [style*="border-top: 2px solid #1f3a4d"] { margin-top: auto !important; }
  .report-page > [style*="min-height:1000px"],
  .report-page > [style*="min-height: 1000px"] { min-height: 235mm !important; }
  h1, h2, h3, h4 { break-after: avoid-page; page-break-after: avoid; }
  p { orphans: 3; widows: 3; }
  table { width: 100% !important; max-width: 100% !important; border-collapse: collapse; }
  table.keep-table { break-inside: avoid-page !important; page-break-inside: avoid !important; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr, figure, .keep-together { break-inside: avoid-page; page-break-inside: avoid; }
  th, td { padding: 5px 7px; overflow-wrap: anywhere; }
  img { max-width: 100% !important; height: auto; object-fit: contain; break-inside: avoid-page; }
  .page-break { break-before: page; page-break-before: always; }
  [style*="page-break-after:always"], [style*="page-break-after: always"] { break-after: page; }
  .image-unavailable { display: flex; min-height: 40mm; align-items: center; justify-content: center; border: 1px solid #bbb; color: #666; font: 9pt Arial, sans-serif; }
  .draft-watermark { position: fixed; z-index: 9999; top: 44%; left: 13%; transform: rotate(-34deg); color: rgba(150, 30, 30, .13); font: 700 42pt Arial, sans-serif; letter-spacing: 4px; pointer-events: none; }
</style></head><body>${watermark}<main class="report-root">${reportHtml}</main></body></html>`

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: await this.browserPath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    try {
      const page = await browser.newPage()
      // CSP prevents saved report markup from executing scripts. JavaScript
      // remains enabled for our isolated image-loading timeout below.
      await page.setJavaScriptEnabled(true)
      await page.setRequestInterception(true)
      page.on('request', (request) => {
        const headers = request.url().startsWith(origin) && authorization
          ? { ...request.headers(), authorization }
          : request.headers()
        void request.continue({ headers })
      })
      await page.setContent(htmlDocument, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await page.evaluate(async () => {
        const root = document.querySelector('.report-root')
        for (const element of Array.from(root?.querySelectorAll<HTMLElement>('[style*="page-break-after"]') ?? [])) {
          if (element.style.pageBreakAfter === 'always') {
            element.classList.add('report-page')
          }
        }
        // Short report tables (boundaries, comparables, values, etc.) should
        // move as a unit instead of leaving only their heading/header behind.
        // Longer tables may paginate, with their heading row repeated.
        for (const table of Array.from(root?.querySelectorAll<HTMLTableElement>('table') ?? [])) {
          const rows = Array.from(table.rows)
          const firstRow = rows[0]
          if (!table.tHead && firstRow?.querySelector('th')) {
            const head = document.createElement('thead')
            head.appendChild(firstRow)
            table.insertBefore(head, table.firstChild)
          }
          if (rows.length <= 6) table.classList.add('keep-table')
        }
        // Old browser previews may have persisted this onerror fallback more
        // than once. The renderer supplies one consistent placeholder below.
        for (const span of Array.from(root?.querySelectorAll('span') ?? [])) {
          if (span.textContent?.includes('Survey plan not available as an image')) span.remove()
        }
        const images = Array.from(document.images)
        await Promise.all(images.map((image) => new Promise<void>((resolve) => {
          const finish = () => resolve()
          if (image.complete) return finish()
          image.addEventListener('load', finish, { once: true })
          image.addEventListener('error', finish, { once: true })
          setTimeout(finish, 12_000)
        })))
        for (const image of images) {
          if (image.naturalWidth > 0) continue
          const placeholder = document.createElement('div')
          placeholder.className = 'image-unavailable'
          placeholder.textContent = 'Image unavailable'
          image.replaceWith(placeholder)
        }
      })
      await page.emulateMediaType('print')
      const title = kind === 'draft' ? 'Draft Valuation Report' : 'Final Valuation Report'
      return Buffer.from(await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `<div style="box-sizing:border-box;width:100%;padding:0 18mm;font:8px Arial;color:#666;display:flex;justify-content:space-between"><span>${title} — ${id}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
      }))
    } finally {
      await browser.close()
    }
  }
}
