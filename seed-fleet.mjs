// One-off seed for Fleet Management demo data.
// Adds 20 technical officers, with 5 assigned, 5 on leave, 5 rejected, 5 available.
// Run once:  node seed-fleet.mjs
import { readFileSync } from 'fs'
import pg from 'pg'
import bcrypt from 'bcryptjs'

// Read DATABASE_URL from .env (simple parse, no extra deps).
const env = readFileSync(new URL('./.env', import.meta.url), 'utf8')
const line = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
const url = line ? line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '') : ''
if (!url) {
  console.error('DATABASE_URL not found in .env')
  process.exit(1)
}
const isLocal = url.includes('localhost')
const pool = new pg.Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
})

const firstNames = ['Nuwan', 'Sandun', 'Ishara', 'Tharindu', 'Chamara', 'Dinesh', 'Ruwan', 'Kavindu', 'Lahiru', 'Saman', 'Nadeesha', 'Amila', 'Buddhika', 'Charith', 'Dilan', 'Eranga', 'Gayan', 'Harsha', 'Isuru', 'Janith']
const lastNames = ['Perera', 'Fernando', 'Silva', 'Jayasuriya', 'Bandara', 'Wickramasinghe', 'Gunawardena', 'Rathnayake', 'Dissanayake', 'Herath', 'Wijesinghe', 'Kumara', 'Peiris', 'Senanayake', 'Ekanayake', 'Madushanka', 'Rajapaksa', 'Weerasinghe', 'Alwis', 'Cooray']
const districts = ['Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Galle', 'Matara', 'Jaffna', 'Kurunegala', 'Anuradhapura', 'Ratnapura']
async function main() {
  const passwordHash = await bcrypt.hash('Test@123', 10)
  // 20 technical officers: TO101..TO120.
  for (let i = 0; i < 20; i++) {
    const id = `TO${101 + i}`
    const nic = String(199000000001 + i) // 12-digit NIC
    const phone = `07${String(10000000 + i)}` // 10-digit phone
    await pool.query(
      `INSERT INTO users (user_id, first_name, last_name, nic, role, district, phone, email, password_hash)
       VALUES ($1, $2, $3, $4, 'Technical Officer', $5, $6, $7, $8)
       ON CONFLICT (user_id) DO NOTHING`,
      [id, firstNames[i], lastNames[i], nic, districts[i % districts.length], phone, `${id.toLowerCase()}@codehub.lk`, passwordHash],
    )
  }

  // Projects reference real applicant accounts in the canonical schema.
  await pool.query(
    `INSERT INTO users (user_id, first_name, last_name, nic, role, email, password_hash)
     VALUES ('900000000001', 'Demo', 'Applicant One', '900000000001', 'Loan Applicant', 'applicant1@example.com', $1),
            ('900000000002', 'Demo', 'Applicant Two', '900000000002', 'Loan Applicant', 'applicant2@example.com', $1)
     ON CONFLICT (user_id) DO NOTHING`,
    [passwordHash],
  )

  // Two seed projects to hang the demo valuations on.
  await pool.query(
    `INSERT INTO projects (project_id, applicant_nic, property_type, status)
     VALUES ('seedp01', '900000000001', 'Residential', 'Technical Officer Assigned'),
            ('seedp02', '900000000002', 'Commercial', 'Submitted')
     ON CONFLICT (project_id) DO NOTHING`,
  )

  // 5 ASSIGNED valuations -> TO101..TO105.
  for (let i = 1; i <= 5; i++) {
    await pool.query(
      `INSERT INTO valuations (project_id, valuation_id, applicant_nic, status, technical_officer_id, assigned_date, assigned_time)
       VALUES ('seedp01', $1, '900000000001', 'Technical Officer Assigned', $2, '2026-07-05', '10:00')
       ON CONFLICT (project_id, valuation_id) DO NOTHING`,
      [i, `TO${100 + i}`],
    )
  }

  // 5 REJECTED valuations -> TO106..TO110.
  for (let i = 1; i <= 5; i++) {
    await pool.query(
      `INSERT INTO valuations (project_id, valuation_id, applicant_nic, status, technical_officer_id, rejection_reason)
       VALUES ('seedp02', $1, '900000000002', 'Rejected', $2, 'Schedule conflict on the requested date')
       ON CONFLICT (project_id, valuation_id) DO NOTHING`,
      [i, `TO${105 + i}`],
    )
  }

  // 5 ON LEAVE -> TO111..TO115 (reset first so re-running stays at 5).
  await pool.query(`DELETE FROM to_leaves WHERE to_id LIKE 'TO11%' OR to_id LIKE 'TO12%'`)
  const leaveReasons = ['Annual leave', 'Medical leave', 'Family matter', 'Training programme', 'Personal leave']
  for (let i = 0; i < 5; i++) {
    await pool.query(`INSERT INTO to_leaves (to_id, reason) VALUES ($1, $2)`, [
      `TO${111 + i}`,
      leaveReasons[i],
    ])
  }

  // TO116..TO120 have nothing -> they stay AVAILABLE.
  console.log('Seed complete: 20 officers (5 assigned, 5 rejected, 5 on leave, 5 available).')
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
