import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseModule } from './Common_Pages/database/database.module'
import { MailModule } from './Common_Pages/mail/mail.module'
import { ContactModule } from './Home_Pages/contact/contact.module'
import { AuthModule } from './Home_Pages/auth/auth.module'
import { ApplicantsModule } from './Role_Pages/coordinator/applicants/applicants.module'
import { ProjectsModule } from './Role_Pages/coordinator/projects/projects.module'
import { ValuationsModule } from './Role_Pages/coordinator/valuations/valuations.module'
import { FleetModule } from './Role_Pages/coordinator/fleet/fleet.module'
import { AdminModule } from './Role_Pages/admin/admin.module'
import { MessagesModule } from './Common_Pages/messages/messages.module'
import { NotificationsModule } from './Common_Pages/notifications/notifications.module'
import { DocumentsModule } from './Role_Pages/loan-applicant/documents/documents.module'
import { ProjectDetailsModule } from './Role_Pages/loan-applicant/project-details/project-details.module'
import { AssignmentsModule } from './Role_Pages/technical-officer/assignments/assignments.module'
import { InspectionsModule } from './Role_Pages/technical-officer/inspections/inspections.module'
import { SitePhotosModule } from './Role_Pages/technical-officer/site-photos/site-photos.module'
import { DescriptionsModule } from './Role_Pages/technical-officer/descriptions/descriptions.module'
import { NearbyModule } from './Role_Pages/technical-officer/nearby/nearby.module'
import { MappingModule } from './Role_Pages/technical-officer/mapping/mapping.module'
import { DraftModule } from './Role_Pages/technical-officer/draft/draft.module'
import { ManagerDraftsModule } from './Role_Pages/manager/drafts/manager-drafts.module'
import { ReportAccessModule } from './Role_Pages/client/report-access.module'
import { AiModule } from './Common_Pages/ai/ai.module'
import { BanksModule } from './Role_Pages/coordinator/banks/banks.module'
import { ObjectStorageModule } from './Common_Pages/storage/object-storage.module'
import { ChatbotModule } from './Common_Pages/chatbot/chatbot.module'
import { ValuerProfileModule } from './Role_Pages/manager/valuer-profile/valuer-profile.module'

// The root module. It wires together all the feature modules.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // loads .env everywhere
    DatabaseModule, // PostgreSQL connection
    ObjectStorageModule, // private Supabase object storage
    MailModule, // email sending
    ContactModule, // /api/contact
    AuthModule, // /api/auth/login
    ApplicantsModule, // /api/coordinator/applicants/search
    ProjectsModule, // /api/coordinator/projects
    ValuationsModule, // /api/coordinator/valuations
    FleetModule, // /api/coordinator/fleet
    AdminModule, // /api/admin
    MessagesModule, // /api/messages
    NotificationsModule, // /api/notifications
    DocumentsModule, // /api/applicant/documents
    ProjectDetailsModule, // /api/applicant/project-details
    BanksModule, // /api/coordinator/banks
    AssignmentsModule, // /api/technical-officer/assignments
    InspectionsModule, // /api/technical-officer/inspections
    SitePhotosModule, // /api/technical-officer/site-photos
    AiModule, // Claude API wrapper (global)
    ChatbotModule, // /api/chatbot/message — role-aware RAG assistant
    DescriptionsModule, // /api/technical-officer/descriptions
    NearbyModule, // /api/technical-officer/nearby
    MappingModule, // /api/technical-officer/mapping
    DraftModule, // /api/technical-officer/draft
    ManagerDraftsModule, // /api/manager/drafts
    ValuerProfileModule, // /api/manager/valuer-profile
    ReportAccessModule, // /api/client (bank view + applicant payment)
  ],
})
export class AppModule {}
