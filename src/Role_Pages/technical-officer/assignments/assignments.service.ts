import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'

// What a technical officer needs for their assigned site visits: the project's
// location, the scheduled date/time, and the owner's details.
@Injectable()
export class AssignmentsService {
  constructor(private readonly db: DatabaseService) {}

  async list(toId: string) {
    const id = (toId ?? '').trim()
    if (!id) return []

    const r = await this.db.query(
      `SELECT v.id AS valuation_row_id, v.valuation_id, v.project_id, v.status, to_char(v.assigned_date, 'YYYY-MM-DD') AS assigned_date, v.assigned_time,
              p.property_type, p.owner_name_as_per_deed, p.applicant_nic,
              p.property_number, p.street_name, p.village_town, p.gn_division,
              p.ds_division, p.district, p.province, p.postal_code,
              p.latitude, p.longitude,
              p.survey_plan_number, p.deed_number, p.land_traditional_name,
              p.extent_perches, p.extent_acres,
              u.first_name, u.last_name, u.nic AS owner_nic, u.phone, u.email, u.address,
              COALESCE(d.review_status, '') AS review_status,
              COALESCE(d.reject_reason, '') AS reject_reason
         FROM valuations v
         JOIN projects p ON p.project_id = v.project_id
         LEFT JOIN users u ON u.user_id = p.applicant_nic
         LEFT JOIN drafts d ON d.project_id = v.project_id
        WHERE v.technical_officer_id = $1
        ORDER BY v.assigned_date, v.assigned_time, v.project_id`,
      [id],
    )

    return r.rows.map((x) => {
      const owner = `${x.first_name ?? ''} ${x.last_name ?? ''}`.trim()
      const address = [x.property_number, x.street_name, x.village_town, x.district, x.province]
        .filter((s) => s && String(s).trim())
        .join(', ')
      return {
        valuationId: Number(x.valuation_id),
        valuationRowId: Number(x.valuation_row_id),
        projectId: x.project_id as string,
        status: x.status as string,
        reviewStatus: (x.review_status as string) ?? '',
        rejectReason: (x.reject_reason as string) ?? '',
        date: x.assigned_date as string,
        time: x.assigned_time as string,
        owner: {
          name: owner || (x.owner_name_as_per_deed as string) || '—',
          nameAsPerDeed: (x.owner_name_as_per_deed as string) ?? '',
          nic: (x.owner_nic as string) || (x.applicant_nic as string),
          phone: (x.phone as string) ?? '',
          email: (x.email as string) ?? '',
          address: (x.address as string) ?? '',
        },
        location: {
          address,
          gnDivision: (x.gn_division as string) ?? '',
          dsDivision: (x.ds_division as string) ?? '',
          district: (x.district as string) ?? '',
          province: (x.province as string) ?? '',
          postalCode: (x.postal_code as string) ?? '',
          latitude: (x.latitude as string) ?? '',
          longitude: (x.longitude as string) ?? '',
        },
        project: {
          propertyType: (x.property_type as string) ?? '',
          surveyPlanNumber: (x.survey_plan_number as string) ?? '',
          deedNumber: (x.deed_number as string) ?? '',
          landName: (x.land_traditional_name as string) ?? '',
          extentPerches: (x.extent_perches as string) ?? '',
          extentAcres: (x.extent_acres as string) ?? '',
        },
      }
    })
  }
}
