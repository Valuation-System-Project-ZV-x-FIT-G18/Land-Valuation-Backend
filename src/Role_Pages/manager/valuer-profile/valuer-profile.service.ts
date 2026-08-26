import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { SaveValuerProfileDto } from './dto/valuer-profile.dto'

@Injectable()
export class ValuerProfileService {
  private readonly logger = new Logger(ValuerProfileService.name)
  constructor(private readonly db: DatabaseService) {}



  private async assertManagerL1(userId: string) {
    const id = userId.trim()
    if (!id) throw new BadRequestException('User ID is required.')
    const result = await this.db.query('SELECT role FROM users WHERE user_id = $1', [id])
    if (!result.rows[0]) throw new NotFoundException('User not found.')
    if (result.rows[0].role !== 'Manager L1') throw new ForbiddenException('This profile is only available to Manager L1.')
    return id
  }

  private map(row: Record<string, any>) {
    return {
      userId: row.user_id,
      valuerName: row.valuer_name,
      conflictOfInterest: row.conflict_of_interest,
      conflictDetails: row.conflict_details,
      professionalQualifications: row.professional_qualifications,
      ivslRegistrationNumber: row.ivsl_registration_number,
      ricsRegistrationNumber: row.rics_registration_number,
      ricsMembership: row.rics_membership,
      relevantExperience: row.relevant_experience,
      indemnityStatus: row.indemnity_status,
      indemnityPolicyNumber: row.indemnity_policy_number,
      indemnityExpiryDate: row.indemnity_expiry_date ? new Date(row.indemnity_expiry_date).toISOString().slice(0, 10) : '',
      updatedAt: row.updated_at,
    }
  }

  async get(userId: string) {
    const id = await this.assertManagerL1(userId)
    const result = await this.db.query('SELECT * FROM valuer_profiles WHERE user_id = $1', [id])
    return { profile: result.rows[0] ? this.map(result.rows[0]) : null }
  }

  async save(dto: SaveValuerProfileDto) {
    const id = await this.assertManagerL1(dto.userId)
    if (dto.conflictOfInterest === 'Conflict Disclosed' && !dto.conflictDetails?.trim())
      throw new BadRequestException('Conflict details are required when a conflict is disclosed.')
    if (dto.indemnityStatus !== 'Not Available' && (!dto.indemnityPolicyNumber?.trim() || !dto.indemnityExpiryDate))
      throw new BadRequestException('Policy number and expiry date are required for the selected insurance status.')

    const result = await this.db.query(`INSERT INTO valuer_profiles (
      user_id, valuer_name, conflict_of_interest, conflict_details, professional_qualifications,
      ivsl_registration_number, rics_registration_number, rics_membership, relevant_experience,
      indemnity_status, indemnity_policy_number, indemnity_expiry_date, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
    ON CONFLICT (user_id) DO UPDATE SET
      valuer_name=EXCLUDED.valuer_name, conflict_of_interest=EXCLUDED.conflict_of_interest,
      conflict_details=EXCLUDED.conflict_details, professional_qualifications=EXCLUDED.professional_qualifications,
      ivsl_registration_number=EXCLUDED.ivsl_registration_number, rics_registration_number=EXCLUDED.rics_registration_number,
      rics_membership=EXCLUDED.rics_membership,
      relevant_experience=EXCLUDED.relevant_experience, indemnity_status=EXCLUDED.indemnity_status,
      indemnity_policy_number=EXCLUDED.indemnity_policy_number, indemnity_expiry_date=EXCLUDED.indemnity_expiry_date,
      updated_at=now() RETURNING *`, [id, dto.valuerName.trim(), dto.conflictOfInterest,
      dto.conflictOfInterest === 'Conflict Disclosed' ? dto.conflictDetails?.trim() ?? '' : '',
      dto.professionalQualifications.trim(), dto.ivslRegistrationNumber.trim(), dto.ricsRegistrationNumber?.trim() ?? '', dto.ricsMembership?.trim() ?? '',
      dto.relevantExperience, dto.indemnityStatus,
      dto.indemnityStatus === 'Not Available' ? '' : dto.indemnityPolicyNumber?.trim() ?? '',
      dto.indemnityStatus === 'Not Available' ? null : dto.indemnityExpiryDate || null])
    return { ok: true, profile: this.map(result.rows[0]) }
  }
}
