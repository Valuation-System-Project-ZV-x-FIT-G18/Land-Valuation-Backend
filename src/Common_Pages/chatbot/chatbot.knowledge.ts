export type KnowledgeSection = { title: string; roles: string[]; content: string }

const ALL = ['Admin', 'Coordinator', 'Technical Officer', 'Manager L1', 'Manager L2', 'Manager L3', 'Loan Applicant', 'Bank']

export const CHATBOT_KNOWLEDGE: KnowledgeSection[] = [
  {
    title: 'Complete valuation workflow', roles: ALL,
    content: 'A loan applicant requests a land valuation. The Coordinator registers the applicant and bank, creates the project and valuation, and assigns a Technical Officer. The Technical Officer completes the site inspection, photos, GPS mapping, nearby-land analysis, descriptions and draft report. Managers review in order L3, L2 and L1. Manager L1 locks the final report. The applicant then pays the valuation fee, after which the Bank can view the released report. Project Status is visible to every logged-in role.',
  },
  {
    title: 'Admin guide', roles: ['Admin'],
    content: 'Admin can create staff accounts from Add User and inspect accounts from User Details. Use strong passwords and confirm the role, NIC and email before creating an account. Admin can use Project Status to follow valuation progress but does not perform inspections or manager approvals.',
  },
  {
    title: 'Coordinator guide', roles: ['Coordinator'],
    content: 'Coordinator handles New Requests and Contact Messages, registers applicants, creates projects and valuations, assigns Technical Officers, manages the vehicle fleet, reviews payment slips and tracks rejected officer assignments. Recommended order: register applicant, create project, create valuation, assign technical officer, then monitor Project Status.',
  },
  {
    title: 'Technical Officer guide', roles: ['Technical Officer'],
    content: 'Technical Officer starts with Assigned Projects. For an assignment, record Inspection Data, upload clear Site Photos, capture GPS and map details, analyse comparable nearby lands, generate property descriptions, and create the valuation draft. Corrections returned by managers appear under Corrections. Complete evidence before submitting a draft.',
  },
  {
    title: 'Manager L3 guide', roles: ['Manager L3'],
    content: 'Manager L3 performs the first management review of Technical Officer drafts. Check evidence, calculations, descriptions and completeness. Approve to send the draft to Manager L2, return it for corrections when repairable, or reject it when unsuitable.',
  },
  {
    title: 'Manager L2 guide', roles: ['Manager L2'],
    content: 'Manager L2 reviews drafts approved by Manager L3. Verify valuation reasoning, comparable evidence and corrections. Approve to send the report to Manager L1, return for corrections, or reject. Approved Drafts and Rejected Drafts show completed decisions.',
  },
  {
    title: 'Manager L1 guide', roles: ['Manager L1'],
    content: 'Manager L1 performs the final review. Check the complete report passed by Manager L2. Locking is the final approval and makes the report ready for the payment and release stage. A locked final report should only be produced after all material issues are resolved.',
  },
  {
    title: 'Loan Applicant guide', roles: ['Loan Applicant'],
    content: 'Loan Applicant fills in requested property details and documents, follows progress in Project Status, and makes payment after the final report is locked. The Bank receives access only after the required payment and release steps are complete. Contact the Coordinator when submitted identity or property data is incorrect.',
  },
  {
    title: 'Bank guide', roles: ['Bank'],
    content: 'Bank users can track Project Status and view a final valuation report after Manager L1 has locked it and the applicant payment has been accepted. If a report is unavailable, confirm that the correct project is selected and that final approval and payment are complete.',
  },
  {
    title: 'Account and support', roles: ALL,
    content: 'Settings is used for profile information. Change Password is required when the system marks an account for a first-login password change. Messages supports communication with other system users, and notifications show workflow updates. Never share passwords or sensitive applicant documents in chatbot messages.',
  },
]
