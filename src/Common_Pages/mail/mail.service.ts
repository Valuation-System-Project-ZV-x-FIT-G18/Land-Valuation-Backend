//02
import { Injectable, Logger } from '@nestjs/common'
import * as nodemailer from 'nodemailer'

// Sends emails. Uses real SMTP when SMTP_HOST is configured in .env,
// otherwise falls back to an Ethereal test inbox (logs a preview URL).
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private transporter: nodemailer.Transporter | null = null

  private async getTransporter() {
    if (this.transporter) return this.transporter

    const host = process.env.SMTP_HOST
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    if (host && user && pass) {
      const port = Number(process.env.SMTP_PORT ?? 465)
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      })
      this.logger.log(`Using SMTP host ${host} (real email delivery).`)
    } else {
      // No SMTP configured -> use a throwaway test inbox (NOT delivered for real).
      const test = await nodemailer.createTestAccount()
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: test.user, pass: test.pass },
      })
      this.logger.warn(
        'SMTP not configured — using an Ethereal test inbox (emails are not really delivered).',
      )
    }
    return this.transporter
  }

  // Sends a loan applicant their login credentials. Never throws.
  async sendApplicantWelcome(to: string, password: string) {
    try {
      const transporter = await this.getTransporter()
      const from =
        process.env.SMTP_FROM ??
        'CODEHUB Land Valuation <landvaluation.codehub@gmail.com>'

      const info = await transporter.sendMail({
        from,
        to,
        subject: 'Your CODEHUB Land Valuation account',
        text:
          `Hello,\n\n` +
          `An account has been created for you on the CODEHUB Land Valuation system.\n\n` +
          `You can log in using your email address and the password below:\n` +
          `  Email address: ${to}\n` +
          `  Password: ${password}\n\n` +
          `Go to the External Login page and sign in with these details. Your account type is detected automatically.\n\n` +
          `For your security, please change your password after your first login.\n\n` +
          `Regards,\nCODEHUB Land Valuation Team`,
        html:
          `<p>Hello,</p>` +
          `<p>An account has been created for you on the <b>CODEHUB Land Valuation</b> system.</p>` +
          `<p>You can log in using your email address and the password below:</p>` +
          `<table cellpadding="6" style="border-collapse:collapse">` +
          `<tr><td><b>Email address</b></td><td>${to}</td></tr>` +
          `<tr><td><b>Password</b></td><td>${password}</td></tr></table>` +
          `<p>Go to the <b>External Login</b> page and sign in with these details. Your account type is detected automatically.</p>` +
          `<p style="color:#b45309"><b>For your security, please change your password after your first login.</b></p>` +
          `<p>Regards,<br/>CODEHUB Land Valuation Team</p>`,
      })

      const preview = nodemailer.getTestMessageUrl(info)
      if (preview) this.logger.log(`Applicant email preview: ${preview}`)
      else this.logger.log(`Applicant email sent to ${to}`)
      return true
    } catch (err) {
      this.logger.error(`Failed to send applicant email to ${to}: ${(err as Error).message}`)
      return false
    }
  }

  // Notifies the loan applicant or the bank that a project was created.
  // Never throws (a failed email must not fail project creation).
  async sendProjectCreated(
    to: string,
    info: {
      projectId: string
      nic: string
      ownerName: string
      audience: 'applicant' | 'bank'
    },
  ) {
    try {
      const transporter = await this.getTransporter()
      const from =
        process.env.SMTP_FROM ?? 'CODEHUB Land Valuation <landvaluation.codehub@gmail.com>'

      const intro =
        info.audience === 'bank'
          ? 'A new land valuation project has been created for your client.'
          : 'A new land valuation project has been created for you.'
      const ownerRow = info.ownerName ? `  Owner: ${info.ownerName}\n` : ''
      const ownerHtml = info.ownerName
        ? `<tr><td><b>Owner</b></td><td>${info.ownerName}</td></tr>`
        : ''

      const sent = await transporter.sendMail({
        from,
        to,
        subject: `Project ${info.projectId} created — CODEHUB Land Valuation`,
        text:
          `Hello,\n\n${intro}\n\n` +
          `  Project ID: ${info.projectId}\n` +
          `  Applicant NIC: ${info.nic}\n` +
          ownerRow +
          `\nYou can track its progress on the CODEHUB Land Valuation system.\n\n` +
          `Regards,\nCODEHUB Land Valuation Team`,
        html:
          `<p>Hello,</p><p>${intro}</p>` +
          `<table cellpadding="6" style="border-collapse:collapse">` +
          `<tr><td><b>Project ID</b></td><td>${info.projectId}</td></tr>` +
          `<tr><td><b>Applicant NIC</b></td><td>${info.nic}</td></tr>` +
          ownerHtml +
          `</table>` +
          `<p>You can track its progress on the CODEHUB Land Valuation system.</p>` +
          `<p>Regards,<br/>CODEHUB Land Valuation Team</p>`,
      })

      const preview = nodemailer.getTestMessageUrl(sent)
      if (preview) this.logger.log(`Project-created email preview: ${preview}`)
      else this.logger.log(`Project-created email sent to ${to}`)
      return true
    } catch (err) {
      this.logger.error(
        `Failed to send project-created email to ${to}: ${(err as Error).message}`,
      )
      return false
    }
  }

  // Tells the loan applicant their valuation report draft is now under review.
  async sendDraftUnderReview(to: string, projectId: string) {
    try {
      const transporter = await this.getTransporter()
      const from = process.env.SMTP_FROM ?? 'CODEHUB Land Valuation <landvaluation.codehub@gmail.com>'
      const sent = await transporter.sendMail({
        from,
        to,
        subject: `Valuation report under review — Project ${projectId}`,
        text:
          `Hello,\n\nYour valuation report for project ${projectId} has been prepared by our ` +
          `technical officer and is now under review by our valuation managers. We will let you ` +
          `know once it is finalised.\n\nRegards,\nCODEHUB Land Valuation Team`,
        html:
          `<p>Hello,</p><p>Your valuation report for project <b>${projectId}</b> has been prepared ` +
          `and is now <b>under review</b> by our valuation managers. We will notify you once it is ` +
          `finalised.</p><p>Regards,<br/>CODEHUB Land Valuation Team</p>`,
      })
      const preview = nodemailer.getTestMessageUrl(sent)
      if (preview) this.logger.log(`Draft-under-review email preview: ${preview}`)
      else this.logger.log(`Draft-under-review email sent to ${to}`)
      return true
    } catch (err) {
      this.logger.error(`Failed to send draft-under-review email to ${to}: ${(err as Error).message}`)
      return false
    }
  }

  // Tells the loan applicant / bank that the valuation report is finalised.
  // The applicant is asked to make the payment to view it. Never throws.
  async sendReportFinalised(to: string, projectId: string, audience: 'applicant' | 'bank') {
    try {
      const transporter = await this.getTransporter()
      const from = process.env.SMTP_FROM ?? 'CODEHUB Land Valuation <landvaluation.codehub@gmail.com>'
      const action =
        audience === 'applicant'
          ? 'Please log in and make the payment to view and download your report.'
          : 'You can view the report from your bank portal once the applicant completes the payment.'
      const sent = await transporter.sendMail({
        from,
        to,
        subject: `Valuation report created — Project ${projectId}`,
        text:
          `Hello,\n\nThe valuation report for project ${projectId} has been created and finalised. ` +
          `${action}\n\nRegards,\nCODEHUB Land Valuation Team`,
        html:
          `<p>Hello,</p><p>The valuation report for project <b>${projectId}</b> has been ` +
          `<b>created and finalised</b>. ${action}</p><p>Regards,<br/>CODEHUB Land Valuation Team</p>`,
      })
      const preview = nodemailer.getTestMessageUrl(sent)
      if (preview) this.logger.log(`Report-finalised email preview: ${preview}`)
      else this.logger.log(`Report-finalised email sent to ${to}`)
      return true
    } catch (err) {
      this.logger.error(`Failed to send report-finalised email to ${to}: ${(err as Error).message}`)
      return false
    }
  }

  // Notifies the loan applicant or the bank that a technical officer has been
  // assigned to their project. Never throws.
  async sendTechnicalOfficerAssigned(
    to: string,
    info: { projectId: string; officerName: string; audience: 'applicant' | 'bank' },
  ) {
    try {
      const transporter = await this.getTransporter()
      const from =
        process.env.SMTP_FROM ?? 'CODEHUB Land Valuation <landvaluation.codehub@gmail.com>'

      const intro =
        info.audience === 'bank'
          ? 'A technical officer has been assigned to your client’s valuation.'
          : 'A technical officer has been assigned to your land valuation.'

      const sent = await transporter.sendMail({
        from,
        to,
        subject: `Technical officer assigned — Project ${info.projectId}`,
        text:
          `Hello,\n\n${intro}\n\n` +
          `  Project ID: ${info.projectId}\n` +
          `  Technical Officer: ${info.officerName}\n\n` +
          `The officer will proceed with the site inspection and valuation.\n\n` +
          `Regards,\nCODEHUB Land Valuation Team`,
        html:
          `<p>Hello,</p><p>${intro}</p>` +
          `<table cellpadding="6" style="border-collapse:collapse">` +
          `<tr><td><b>Project ID</b></td><td>${info.projectId}</td></tr>` +
          `<tr><td><b>Technical Officer</b></td><td>${info.officerName}</td></tr>` +
          `</table>` +
          `<p>The officer will proceed with the site inspection and valuation.</p>` +
          `<p>Regards,<br/>CODEHUB Land Valuation Team</p>`,
      })

      const preview = nodemailer.getTestMessageUrl(sent)
      if (preview) this.logger.log(`TO-assigned email preview: ${preview}`)
      else this.logger.log(`TO-assigned email sent to ${to}`)
      return true
    } catch (err) {
      this.logger.error(
        `Failed to send TO-assigned email to ${to}: ${(err as Error).message}`,
      )
      return false
    }
  }

  // Sends a new staff member (created by an admin) their email + password,
  // asking them to change it on first login. Never throws.
  async sendStaffWelcome(to: string, password: string, role: string) {
    try {
      const transporter = await this.getTransporter()
      const from =
        process.env.SMTP_FROM ?? 'CODEHUB Land Valuation <landvaluation.codehub@gmail.com>'

      const info = await transporter.sendMail({
        from,
        to,
        subject: `You are registered as ${role} — CODEHUB Land Valuation`,
        text:
          `Hello,\n\n` +
          `You have been registered on the CODEHUB Land Valuation system as a ${role}.\n\n` +
          `Your login details are:\n` +
          `  Email address: ${to}\n` +
          `  Password: ${password}\n\n` +
          `Please sign in on the Internal Login page and change your password. ` +
          `For your security, you will be asked to set a new password on your first login.\n\n` +
          `Regards,\nCODEHUB Land Valuation Team`,
        html:
          `<p>Hello,</p>` +
          `<p>You have been registered on the <b>CODEHUB Land Valuation</b> system as a <b>${role}</b>.</p>` +
          `<p>Your login details are:</p>` +
          `<table cellpadding="6" style="border-collapse:collapse">` +
          `<tr><td><b>Email address</b></td><td>${to}</td></tr>` +
          `<tr><td><b>Password</b></td><td>${password}</td></tr></table>` +
          `<p style="color:#b45309"><b>Please sign in on the Internal Login page and change your password.</b> ` +
          `You will be asked to set a new password on your first login.</p>` +
          `<p>Regards,<br/>CODEHUB Land Valuation Team</p>`,
      })

      const preview = nodemailer.getTestMessageUrl(info)
      if (preview) this.logger.log(`Staff welcome email preview: ${preview}`)
      else this.logger.log(`Staff welcome email sent to ${to}`)
      return true
    } catch (err) {
      this.logger.error(`Failed to send staff welcome email to ${to}: ${(err as Error).message}`)
      return false
    }
  }

  // Confirms payment received + valuation complete. Never throws.
  async sendPaymentReceived(to: string, projectId: string, audience: 'applicant' | 'bank') {
    try {
      const transporter = await this.getTransporter()
      const from = process.env.SMTP_FROM ?? 'CODEHUB Land Valuation <landvaluation.codehub@gmail.com>'
      const line =
        audience === 'applicant'
          ? 'Your payment has been received and the valuation is now complete. The finalised report is available to your bank.'
          : 'The applicant has completed the payment. The finalised valuation report is now available for you to view.'
      const info = await transporter.sendMail({
        from,
        to,
        subject: `Payment received — valuation complete — Project ${projectId}`,
        text: `Hello,\n\n${line}\n\n  Project ID: ${projectId}\n\nRegards,\nCODEHUB Land Valuation Team`,
        html:
          `<p>Hello,</p><p>${line}</p>` +
          `<table cellpadding="6" style="border-collapse:collapse"><tr><td><b>Project ID</b></td><td>${projectId}</td></tr></table>` +
          `<p>Regards,<br/>CODEHUB Land Valuation Team</p>`,
      })
      const preview = nodemailer.getTestMessageUrl(info)
      if (preview) this.logger.log(`Payment-received email preview: ${preview}`)
      else this.logger.log(`Payment-received email sent to ${to}`)
      return true
    } catch (err) {
      this.logger.error(`Failed to send payment-received email to ${to}: ${(err as Error).message}`)
      return false
    }
  }

  // Sends a temporary password after an email-based forgot-password request.
  // The user must change it on next login. Never throws.
  async sendPasswordReset(to: string, password: string) {
    try {
      const transporter = await this.getTransporter()
      const from = process.env.SMTP_FROM ?? 'CODEHUB Land Valuation <landvaluation.codehub@gmail.com>'
      const info = await transporter.sendMail({
        from,
        to,
        subject: 'Your password has been reset — CODEHUB Land Valuation',
        text:
          `Hello,\n\nYou requested a password reset. Use the details below to sign in:\n\n` +
          `  Email address: ${to}\n  New Password: ${password}\n\n` +
          `For your security, you will be asked to set a new password right after you log in.\n\n` +
          `If you did not request this, please contact us.\n\nRegards,\nCODEHUB Land Valuation Team`,
        html:
          `<p>Hello,</p><p>You requested a password reset. Use the details below to sign in:</p>` +
          `<table cellpadding="6" style="border-collapse:collapse">` +
          `<tr><td><b>Email address</b></td><td>${to}</td></tr>` +
          `<tr><td><b>New Password</b></td><td>${password}</td></tr></table>` +
          `<p style="color:#b45309"><b>You will be asked to set a new password right after you log in.</b></p>` +
          `<p>If you did not request this, please contact us.</p>` +
          `<p>Regards,<br/>CODEHUB Land Valuation Team</p>`,
      })
      const preview = nodemailer.getTestMessageUrl(info)
      if (preview) this.logger.log(`Password-reset email preview: ${preview}`)
      else this.logger.log(`Password-reset email sent to ${to}`)
      return true
    } catch (err) {
      this.logger.error(`Failed to send password-reset email to ${to}: ${(err as Error).message}`)
      return false
    }
  }

  // Notifies a technical officer that they've been assigned a valuation, with
  // the scheduled inspection date/time. Never throws.
  async sendOfficerAssignment(
    to: string,
    info: { projectId: string; date: string; time: string },
  ) {
    try {
      const transporter = await this.getTransporter()
      const from =
        process.env.SMTP_FROM ?? 'CODEHUB Land Valuation <landvaluation.codehub@gmail.com>'

      const sent = await transporter.sendMail({
        from,
        to,
        subject: `New assignment — Project ${info.projectId}`,
        text:
          `Hello,\n\n` +
          `You have been assigned to inspect and value a property.\n\n` +
          `  Project ID: ${info.projectId}\n` +
          `  Date: ${info.date}\n` +
          `  Time: ${info.time}\n\n` +
          `Please review the project details on the CODEHUB Land Valuation system.\n\n` +
          `Regards,\nCODEHUB Land Valuation Team`,
        html:
          `<p>Hello,</p>` +
          `<p>You have been assigned to inspect and value a property.</p>` +
          `<table cellpadding="6" style="border-collapse:collapse">` +
          `<tr><td><b>Project ID</b></td><td>${info.projectId}</td></tr>` +
          `<tr><td><b>Date</b></td><td>${info.date}</td></tr>` +
          `<tr><td><b>Time</b></td><td>${info.time}</td></tr></table>` +
          `<p>Please review the project details on the CODEHUB Land Valuation system.</p>` +
          `<p>Regards,<br/>CODEHUB Land Valuation Team</p>`,
      })

      const preview = nodemailer.getTestMessageUrl(sent)
      if (preview) this.logger.log(`Officer-assignment email preview: ${preview}`)
      else this.logger.log(`Officer-assignment email sent to ${to}`)
      return true
    } catch (err) {
      this.logger.error(
        `Failed to send officer-assignment email to ${to}: ${(err as Error).message}`,
      )
      return false
    }
  }

  // Send a newly-registered bank its email login and password. Never throws.
  async sendBankWelcome(to: string, password: string, bankName: string) {
    try {
      const transporter = await this.getTransporter()
      const from = process.env.SMTP_FROM ?? 'CODEHUB Land Valuation <landvaluation.codehub@gmail.com>'
      const info = await transporter.sendMail({
        from,
        to,
        subject: 'Your CODEHUB bank access',
        text:
          `Hello,\n\n` +
          `${bankName} has been registered on the CODEHUB Land Valuation system.\n\n` +
          `Log in on the External Login page with:\n` +
          `  Email address: ${to}\n` +
          `  Password: ${password}\n\n` +
          `You can view the finalised valuation reports for your projects once they are released.\n` +
          `Please change your password after your first login.\n\n` +
          `Regards,\nCODEHUB Land Valuation Team`,
        html:
          `<p>Hello,</p>` +
          `<p><b>${bankName}</b> has been registered on the <b>CODEHUB Land Valuation</b> system.</p>` +
          `<p>Log in on the <b>External Login</b> page with:</p>` +
          `<table cellpadding="6" style="border-collapse:collapse">` +
          `<tr><td><b>Email address</b></td><td>${to}</td></tr>` +
          `<tr><td><b>Password</b></td><td>${password}</td></tr></table>` +
          `<p>You can view the finalised valuation reports for your projects once they are released.</p>` +
          `<p style="color:#b45309"><b>Please change your password after your first login.</b></p>` +
          `<p>Regards,<br/>CODEHUB Land Valuation Team</p>`,
      })
      const preview = nodemailer.getTestMessageUrl(info)
      if (preview) this.logger.log(`Bank-welcome email preview: ${preview}`)
      else this.logger.log(`Bank-welcome email sent to ${to}`)
      return true
    } catch (err) {
      this.logger.error(`Failed to send bank-welcome email to ${to}: ${(err as Error).message}`)
      return false
    }
  }

  // Auto-acknowledge a public contact message. Never throws.
  async sendAcknowledgement(to: string, name: string, kind: 'message') {
    try {
      const transporter = await this.getTransporter()
      const from = process.env.SMTP_FROM ?? 'CODEHUB Land Valuation <landvaluation.codehub@gmail.com>'
      const first = (name || '').trim().split(/\s+/)[0] || 'there'
      const info = await transporter.sendMail({
        from,
        to,
        subject: `We received your ${kind} — CODEHUB Land Valuation`,
        text:
          `Hi ${first},\n\n` +
          `Thank you for reaching out to CODEHUB Land Valuation. ` +
          `We have received your ${kind} and our team will contact you soon.\n\n` +
          `Regards,\nCODEHUB Land Valuation Team`,
        html:
          `<p>Hi ${first},</p>` +
          `<p>Thank you for reaching out to <b>CODEHUB Land Valuation</b>. ` +
          `We have received your ${kind} and our team will <b>contact you soon</b>.</p>` +
          `<p>Regards,<br/>CODEHUB Land Valuation Team</p>`,
      })
      const preview = nodemailer.getTestMessageUrl(info)
      if (preview) this.logger.log(`Acknowledgement email preview: ${preview}`)
      else this.logger.log(`Acknowledgement email sent to ${to}`)
      return true
    } catch (err) {
      this.logger.error(`Failed to send acknowledgement to ${to}: ${(err as Error).message}`)
      return false
    }
  }
}
