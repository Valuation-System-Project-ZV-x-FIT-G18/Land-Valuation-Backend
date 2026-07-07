// Generates a downloadable, OCR-friendly blank Land Site Inspection form (PDF).
import PDFDocument from 'pdfkit'
import { createWriteStream } from 'fs'

const OUT = 'C:/Users/admin/Downloads/Land_Inspection_Blank_Form.pdf'

const sections = [
  ['1. Access & Location', [
    ['Access route description from nearest town', true],
    ['Access road width'], ['Road type (Tarred / Gravel / Other)'],
    ['Road facing direction / Boundary facing road'], ['GPS Coordinates'],
    ['Right of way confirmation'],
  ]],
  ['2. Description of the Land', [
    ['Shape of land'], ['Land position relative to road'], ['Frontage measurement (ft)'],
    ['Flood prone status'], ['Boundaries clearly marked on ground'], ['Soil type'],
    ['Rainwater drainage method'], ['Garbage disposal method'], ['Gate / Entry type'],
    ['Unauthorized structures on land'],
  ]],
  ['3. Boundary Verification', [
    ['North Boundary'], ['East Boundary'], ['South Boundary'], ['West Boundary'],
    ['Physical boundaries match survey plan'],
  ]],
  ['4. Locality Description', [
    ['Character of immediate vicinity'], ['Nearby facilities'], ['Transport frequency'],
    ['Availability of day-to-day needs'],
  ]],
  ['Inspection Details', [
    ['Date of inspection'], ['Technical Officer'], ['Signature'],
  ]],
]

const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 45, right: 45 } })
doc.pipe(createWriteStream(OUT))

const left = doc.page.margins.left
const right = doc.page.width - doc.page.margins.right
const bottom = doc.page.height - doc.page.margins.bottom

const ensure = (h) => { if (doc.y + h > bottom) doc.addPage() }

// Title
doc.font('Helvetica-Bold').fontSize(16).fillColor('#000')
  .text('LAND SITE INSPECTION & VALUATION FORM', { align: 'center' })
doc.moveDown(0.3)
doc.font('Helvetica').fontSize(10).fillColor('#333')
  .text('Project ID: ____________________          Date: ____________________', { align: 'center' })
doc.moveDown(0.6)

// Instructions
doc.font('Helvetica-Bold').fontSize(9).fillColor('#000').text('How to fill in for accurate scanning:')
doc.font('Helvetica').fontSize(9).fillColor('#222').text(
  'Write in dark blue or black ink, in CAPITAL letters. Put your answer on the line under each printed label. ' +
  'Keep each answer on ONE line where possible. Do not change or cover the printed labels, and do not add extra columns.',
  { width: right - left },
)
doc.moveDown(0.6)

const section = (title) => {
  ensure(38)
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#000').text(title)
  const y = doc.y + 2
  doc.moveTo(left, y).lineTo(right, y).lineWidth(1.2).strokeColor('#000').stroke()
  doc.y = y + 8
}

const field = (label, big) => {
  ensure(big ? 62 : 34)
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111').text(`${label}:`, { width: right - left })
  const y = doc.y + (big ? 38 : 16)
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.7).strokeColor('#000').stroke()
  doc.y = y + 6
}

for (const [title, fields] of sections) {
  section(title)
  for (const [label, big] of fields) field(label, big)
}

doc.end()
console.log('Saved:', OUT)
