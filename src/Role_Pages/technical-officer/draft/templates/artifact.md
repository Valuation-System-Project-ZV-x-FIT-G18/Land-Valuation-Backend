# Land-only valuation report template contract

- Reference: `valuation-report-land-only.docx`
- Source SHA-256: `290A80D6EFBAA52401A1E6C89CD3E8731FC93AF58AAA6FA15AFD878A59A2CC5D`
- File size: 81,649 bytes
- Sections: 1
- Page system: A4 portrait, 0.75-inch margins on all sides
- Content inventory: 348 paragraphs, 10 tables, 127 named `{placeholder}` slots
- Images: 22 anchored/floating drawing objects; preserve their anchors and relationships
- Fields/content controls: none

## Preservation contract

The DOCX is the visual authority. Preserve its page geometry, anchored artwork,
tables, paragraph/run formatting, relationships, and package parts. Replace only
the named placeholder text or explicitly designated image slots. Do not rebuild
the document from a blank file.

## Slot groups

- Applicant, bank, property and reference details
- Survey plan, deed, extent, boundary and inspection details
- Survey/map/site-photo image slots
- Legal, planning, valuation-method and evidence narratives
- Three fixed comparable-land rows
- Conclusion, land-only summary, certification and valuer profile

## Fidelity gates

- The retained DOCX hash must remain unchanged.
- Replacement must preserve styling around each placeholder.
- Image replacement must preserve the intended size and position.
- Building valuation, building-cost and insurance-value content must not be
  reintroduced into this land-only template.
- Rendered visual QA is currently unresolved because LibreOffice/soffice is not
  installed in the local runtime; perform Word/LibreOffice render QA before the
  first production release.
