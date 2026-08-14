from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "land-valuation-system-technical-report.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#123B46")
GREEN = colors.HexColor("#0E6049")
GOLD = colors.HexColor("#D6B84B")
LIGHT = colors.HexColor("#EEF5F1")
GREY = colors.HexColor("#52616B")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleX", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=25, leading=31, textColor=NAVY, alignment=TA_CENTER, spaceAfter=12))
styles.add(ParagraphStyle(name="SubTitleX", parent=styles["Normal"], fontSize=12, leading=18, textColor=GREY, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="H1X", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=17, leading=22, textColor=NAVY, spaceBefore=8, spaceAfter=10))
styles.add(ParagraphStyle(name="H2X", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=GREEN, spaceBefore=8, spaceAfter=5))
styles.add(ParagraphStyle(name="BodyX", parent=styles["BodyText"], fontSize=8.6, leading=12.7, textColor=colors.HexColor("#20282C"), spaceAfter=5))
styles.add(ParagraphStyle(name="SmallX", parent=styles["BodyText"], fontSize=7.7, leading=11, textColor=GREY))
styles.add(ParagraphStyle(name="CalloutX", parent=styles["BodyText"], fontSize=9, leading=14, textColor=NAVY, backColor=LIGHT, borderColor=colors.HexColor("#B9D2C7"), borderWidth=.6, borderPadding=8, spaceBefore=5, spaceAfter=8))

def p(text, style="BodyX"):
    return Paragraph(text, styles[style])

def bullets(items):
    return [Paragraph(f"• {x}", ParagraphStyle(name=f"b{id(x)}", parent=styles["BodyX"], leftIndent=12, firstLineIndent=-7, spaceAfter=3)) for x in items]

def table(rows, widths=None):
    data = [[p(str(c), "SmallX") for c in row] for row in rows]
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), NAVY), ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"), ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("GRID", (0,0), (-1,-1), .35, colors.HexColor("#B8C4C8")),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT]),
        ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]))
    return t

def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setStrokeColor(NAVY); canvas.setLineWidth(.7)
    canvas.line(18*mm, h-14*mm, w-18*mm, h-14*mm)
    canvas.setFont("Helvetica-Bold", 7.5); canvas.setFillColor(NAVY)
    canvas.drawString(18*mm, h-10.5*mm, "LAND VALUATION MANAGEMENT SYSTEM")
    canvas.setFont("Helvetica", 7.5); canvas.setFillColor(GREY)
    canvas.drawRightString(w-18*mm, h-10.5*mm, "Technical Project Report")
    canvas.line(18*mm, 14*mm, w-18*mm, 14*mm)
    canvas.drawString(18*mm, 9.5*mm, "CODEHUB Land Valuation")
    canvas.drawRightString(w-18*mm, 9.5*mm, f"Page {doc.page}")
    canvas.restoreState()

doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=19*mm, rightMargin=19*mm, topMargin=21*mm, bottomMargin=20*mm, title="Land Valuation Management System - Technical Project Report", author="CODEHUB")
story = []

story += [Spacer(1, 31*mm), p("LAND VALUATION<br/>MANAGEMENT SYSTEM", "TitleX"), Spacer(1, 5*mm), p("Technical Project Report", "SubTitleX"), Spacer(1, 17*mm)]
story.append(Table([[p("SYSTEM TYPE", "SmallX"), p("Full-stack, role-based web application", "BodyX")], [p("FRONTEND", "SmallX"), p("React + TypeScript + Vite", "BodyX")], [p("BACKEND", "SmallX"), p("NestJS + TypeScript", "BodyX")], [p("DATABASE", "SmallX"), p("PostgreSQL (Neon)", "BodyX")], [p("REPORT DATE", "SmallX"), p("14 August 2026", "BodyX")]], colWidths=[40*mm, 90*mm], style=[("BOX",(0,0),(-1,-1),.7,NAVY),("INNERGRID",(0,0),(-1,-1),.3,colors.HexColor("#C8D4D8")),("BACKGROUND",(0,0),(0,-1),LIGHT),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),8),("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7)]))
story += [Spacer(1, 25*mm), p("Prepared from the current source code and package configuration. Environment secret values are intentionally excluded.", "SubTitleX"), PageBreak()]

story += [p("1. Executive Summary", "H1X"), p("The Land Valuation Management System is a modular web application that coordinates the end-to-end valuation process among administrators, coordinators, technical officers, managers, loan applicants and banks. It supports applicant registration, project creation, valuation requests, officer assignment, field inspection, document and photo storage, GPS mapping, nearby-land analysis, description generation, draft review, payment processing and controlled report access."), p("The solution is implemented as two TypeScript applications. A React single-page application provides the user interface and communicates with a NestJS REST API. PostgreSQL stores business data, while private Supabase Object Storage stores uploaded files with database and local fallbacks."), p("Current maturity", "H2X")]
story += bullets(["The core operational workflow and role-oriented screens are implemented.", "PDF generation and the separate Calculate Land Value feature have been removed.", "Legacy HTML draft/report infrastructure remains for manager and client flows.", "The most important production gap is the absence of server-enforced authentication and authorization.", "No automated test suite or database migration framework was found."])
story += [p("2. System Objectives", "H1X")]
story += bullets(["Centralize land valuation requests and project records.", "Reduce manual coordination between applicants, coordinators, technical officers, managers and banks.", "Capture inspection evidence, documents, photographs and geographic information.", "Support nearby comparable-land research and valuation narrative preparation.", "Provide multi-level draft review and approval workflows.", "Maintain private storage for confidential property and financial documents.", "Prepare a foundation for reusable placeholder-based valuation report templates."])

story += [p("3. High-Level Architecture", "H1X"), table([["Layer","Technology","Responsibility"],["Presentation","React 18, TypeScript, Tailwind CSS","Role-based pages, forms, dashboards, maps and report views"],["Development/build","Vite 5","Frontend bundling, local server and /api proxy"],["Application API","NestJS 10","REST controllers, validation and business services"],["Persistence","PostgreSQL via pg","Projects, users, valuations, workflow and analysis data"],["Object storage","Supabase Storage","Private documents, photos, letters and slips"],["External services","Gemini, SerpAPI, OCR.Space, Nominatim, SMTP","AI, market search, OCR, geocoding and email"]], [31*mm, 47*mm, 93*mm]), Spacer(1, 4*mm), p("Development request flow", "H2X"), p("Browser at localhost:3000 -> Vite proxy for /api -> NestJS at localhost:4000/api -> PostgreSQL, object storage or an external integration.", "CalloutX"), PageBreak()]

story += [p("4. Frontend Technology Stack", "H1X"), table([["Package","Version","Use"],["react / react-dom","18.3.1","Component-based user interface"],["typescript","5.5.4","Static type checking"],["vite","5.4.8","Development and production builds"],["react-router-dom","6.26.2","Client-side routes and layouts"],["tailwindcss","3.4.13","Responsive visual styling"],["leaflet","1.9.4","Interactive maps"],["react-leaflet","4.2.1","React bindings for Leaflet"],["postcss / autoprefixer","8.4.47 / 10.4.20","CSS transformation and compatibility"]], [42*mm, 29*mm, 100*mm]), p("Frontend implementation details", "H2X")]
story += bullets(["Functional React components and hooks are used throughout.", "Authentication state is held in React Context and sessionStorage.", "Native fetch() performs REST calls; Axios is not installed.", "Temporary form state is persisted using custom sessionStorage hooks.", "Selected projects and certain drafts use localStorage.", "The @/ alias maps imports to the frontend src directory.", "Strict TypeScript mode is enabled.", "No Redux, Zustand, Formik or React Hook Form dependency is used."])

story += [p("5. Backend Technology Stack", "H1X"), table([["Package","Version","Use"],["@nestjs/common/core/platform-express","10.4.4","REST application framework"],["pg","8.13.0","PostgreSQL connection pool and raw SQL"],["class-validator","0.14.1","DTO request validation"],["class-transformer","0.5.1","Request transformation"],["bcryptjs","2.4.3","Password hashing and verification"],["nodemailer","9.0.1","SMTP email delivery"],["@supabase/supabase-js","2.112.2","Private object storage"],["rxjs","7.8.1","NestJS reactive dependency"]], [52*mm, 29*mm, 90*mm]), p("Backend conventions", "H2X")]
story += bullets(["Global /api route prefix and CORS are enabled.", "A global ValidationPipe uses whitelist, forbidNonWhitelisted and transform.", "Controllers expose endpoints; services contain business logic; modules group features.", "The build targets ES2021 and emits CommonJS files to dist/.", "Raw parameterized SQL is used instead of Prisma, TypeORM or Sequelize."])

story += [PageBreak(), p("6. Functional Modules", "H1X"), table([["Role/area","Implemented capabilities"],["Public","Home, about, services, contact and valuation request"],["Authentication","Internal/external login, password change, recovery, profiles and avatars"],["Admin","Create roles/users and manage user details"],["Coordinator","Requests, applicant and bank registration, projects, valuations, assignments, fleet, status and payment slips"],["Technical Officer","Assignments, inspections, photos, GPS/maps, nearby-land analysis and descriptions"],["Managers L1-L3","Draft checks, corrections, approvals, rejections and final reports"],["Loan Applicant","Project form drafts, document uploads and payments"],["Bank","Authorized report viewing"],["Common services","Messages, notifications, chatbot, email, database and storage"]], [40*mm, 131*mm]), p("Role workflow", "H2X"), p("Applicant request -> coordinator registration -> project -> valuation -> technical officer assignment -> inspection/photos/maps -> nearby analysis -> description preparation -> draft review -> approval/payment -> report access.", "CalloutX")]

story += [p("7. Data and Storage Design", "H1X"), p("PostgreSQL is hosted on Neon and accessed through a shared pg connection pool. Business services use parameterized SQL queries. Several feature services currently create tables or add columns at application startup using CREATE TABLE IF NOT EXISTS and ALTER TABLE ADD COLUMN IF NOT EXISTS."), p("Principal data domains", "H2X")]
story += bullets(["Users, roles, applicants and banks", "Projects, deeds, survey plans, property addresses and land extent", "Valuation requests, assignments, fleet state and attendance/leave", "Applicant documents, inspection records and inspection files", "Site photographs and map analyses", "Nearby comparable evidence and saved land analyses", "Generated descriptions and draft review state", "Messages, notifications, payment slips and valuer profiles"])
story += [p("File storage strategy", "H2X"), p("Uploaded files are stored in a private Supabase bucket. PostgreSQL can retain a binary fallback, and local storage under uploads/objects is used if Supabase is not configured or an upload fails. Object keys include the feature area, date, UUID and sanitized original filename.")]

story += [PageBreak(), p("8. Maps, AI and External Integrations", "H1X"), table([["Integration","Use","Operational notes"],["OpenStreetMap + Leaflet","Map display and location selection","No commercial map SDK dependency"],["Nominatim","Geocoding and locality lookup","Requires responsible usage and availability handling"],["Google Gemini 2.5 Flash","Text/image analysis, descriptions and chatbot assistance","Direct REST call; timeout, retry and fallback logic exist"],["SerpAPI","Discovery of nearby property listings","Used as evidence discovery, not an authoritative final valuation"],["OCR.Space","Inspection-document OCR","Uses configured key or limited demo fallback"],["SMTP via Nodemailer","Workflow and account emails","Credentials remain backend-only"],["Supabase Storage","Private uploaded objects","Service-role key must never reach the frontend"]], [39*mm, 57*mm, 75*mm]), p("AI governance", "H2X"), p("AI output should remain assistive. Property facts, comparable evidence, valuation assumptions and final professional conclusions require review by an authorized valuer. Automated narrative generation must not be treated as an independent valuation opinion."), p("Package observation", "H2X"), p("@anthropic-ai/sdk is installed in the backend package manifest but no active source import was found. It should be removed after confirming that no planned deployment path relies on it." )]

story += [p("9. Authentication and Security Assessment", "H1X"), p("Passwords are hashed with bcrypt using a cost factor of 10. Login responses store basic user details in browser sessionStorage, which clears when the tab closes. Frontend layouts apply role-based route restrictions."), p("Critical security gap", "H2X"), p("The backend does not currently show JWT validation, secure server sessions, authentication guards or role authorization guards. Many API operations accept a user ID, NIC or project ID supplied by the client. Frontend route checks alone cannot protect data or privileged operations.", "CalloutX"), p("Required production controls", "H2X")]
story += bullets(["JWT access tokens or secure HTTP-only session cookies", "NestJS authentication and role guards", "Object-level ownership checks for every project, valuation and file", "Rate limiting and login brute-force protection", "CSRF protection when cookie authentication is selected", "Security headers, restricted CORS and strict upload validation", "Audit logs for assignments, approvals, document access and report changes", "Secret rotation and managed secret storage", "Encrypted backups and tested disaster recovery"])

story += [PageBreak(), p("10. Configuration", "H1X"), p("The backend reads configuration through NestJS ConfigModule. Secret values must not be committed, displayed in reports or exposed to frontend code."), table([["Environment variable","Purpose"],["DATABASE_URL","PostgreSQL connection"],["PORT","Backend port; defaults to 4000"],["SUPABASE_URL","Supabase project endpoint"],["SUPABASE_SECRET_KEY","Backend-only service credential"],["SUPABASE_STORAGE_BUCKET","Private object bucket"],["SMTP_HOST / SMTP_PORT","Mail server"],["SMTP_USER / SMTP_PASS / SMTP_FROM","Mail authentication and sender"],["GEMINI_API_KEY","Gemini API access"],["SERPAPI_API_KEY","Market listing search"],["OCR_SPACE_API_KEY","OCR service access"]], [63*mm, 108*mm]), p("Frontend API configuration", "H2X"), p("During development, Vite proxies relative /api calls to localhost:4000. The NEXT_PUBLIC_API_URL variable follows a Next.js convention and is not used by this Vite application. If a public frontend variable becomes necessary, its name should normally begin with VITE_.")]

story += [p("11. Build, Run and Deployment", "H1X"), table([["Application","Development","Production build/start"],["Frontend","npm run dev","npm run build; deploy dist/ as static assets"],["Backend","npm run start:dev","npm run build; npm run start:prod"]], [37*mm, 61*mm, 73*mm]), p("Recommended deployment topology", "H2X")]
story += bullets(["Serve the Vite production build through a CDN or static web host.", "Run NestJS as a managed Node.js service behind HTTPS and a reverse proxy.", "Restrict database access to the backend environment.", "Keep the Supabase service credential, SMTP password and API keys in a managed secret store.", "Configure production CORS to allow only the deployed frontend origin.", "Add health checks, structured logs, error monitoring and external-service metrics."])

story += [p("12. Report and Document Status", "H1X"), p("The PDF-generation feature and the separate Calculate Land Value feature have been removed. Legacy draft infrastructure remains, including backend data collection, HTML report building utilities, manager review and applicant/bank report views. The Technical Officer sidebar still contains Create Draft, but a matching Technical Officer draft route/page is not currently registered."), p("A complete reusable report-template solution would require:", "H2X")]
story += bullets(["A versioned template model, preferably structured JSON or DOCX templates with controlled placeholders", "A canonical placeholder dictionary and validation rules", "Project/valuation-specific data aggregation", "Online rich-text editing and revision history", "DOCX generation with formatting, images, tables, headers and footers preserved", "Manager approval, locking and controlled report release", "Automated tests that verify every required placeholder is populated"])

story += [PageBreak(), p("13. Quality, Risks and Improvement Roadmap", "H1X"), table([["Priority","Finding","Recommendation"],["Critical","No server-enforced authentication/authorization","Implement secure sessions/JWT, guards and ownership checks"],["Critical","Credentials have been exposed during development","Rotate database, storage, email and API credentials"],["High","No automated tests found","Add unit, API integration and browser end-to-end tests"],["High","Schema changes occur during startup","Adopt versioned migrations and controlled rollbacks"],["High","Draft route/workflow is inconsistent","Complete or remove the remaining Create Draft entry and legacy dependencies"],["Medium","API calls are decentralized","Create a shared typed API client with authentication and normalized errors"],["Medium","Files are duplicated as storage and DB fallback","Define size limits, retention and recovery policy"],["Medium","External APIs can fail or exhaust quotas","Add monitoring, caching, circuit breakers and documented fallbacks"],["Low","No lint/format scripts in package manifests","Add ESLint, Prettier and CI checks"],["Low","Anthropic SDK appears unused","Remove after confirmation"]], [20*mm, 62*mm, 89*mm]), p("Suggested delivery phases", "H2X")]
story += bullets(["Phase 1 - Security foundation: authentication, authorization, secret rotation and audit logging.", "Phase 2 - Engineering quality: migrations, automated tests, linting and CI/CD.", "Phase 3 - Report engine: template storage, placeholders, rich-text editing and DOCX export.", "Phase 4 - Operations: monitoring, backups, quotas, retention and production hardening."])

story += [p("14. Conclusion", "H1X"), p("The project has a broad operational foundation and a clear role-based workflow. React, NestJS and PostgreSQL are appropriate technologies for this type of information system, and the modular folder structure supports continued development. Before production use with confidential valuation and banking data, the system requires server-side authorization, formal migrations, automated testing, secret rotation and a controlled document-generation architecture."), Spacer(1, 5*mm), p("This report reflects the inspected codebase and package configuration as of 14 August 2026. It does not include secret values and is not a penetration-test certification.", "CalloutX")]

# Keep the cover-page break only. Later explicit breaks can create nearly empty
# pages when the preceding section naturally flows onto a new page.
filtered_story = []
cover_break_kept = False
for item in story:
    if isinstance(item, PageBreak):
        if cover_break_kept:
            continue
        cover_break_kept = True
    filtered_story.append(item)

doc.build(filtered_story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUT)
