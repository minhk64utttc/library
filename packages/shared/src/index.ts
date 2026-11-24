export { ROLES, isRole } from './auth/roles';
export type { Role } from './auth/roles';

export { PERMISSIONS, ROLE_PERMISSIONS, permissionsFor } from './auth/permissions';
export type { Permission } from './auth/permissions';

export {
  roleSchema,
  loginInputSchema,
  changePasswordInputSchema,
  accountSummarySchema,
} from './contracts/auth.schema';
export type { LoginInput, ChangePasswordInput, AccountSummary } from './contracts/auth.schema';

export { profileContactInputSchema } from './contracts/profile.schema';
export type { ProfileContactInput } from './contracts/profile.schema';

export {
  publisherInputSchema,
  publisherUpdateSchema,
  editionInputSchema,
  callNumberUpdateSchema,
  recordListQuerySchema,
  publisherListQuerySchema,
  recordInputSchema,
  recordUpdateSchema,
  recordRejectSchema,
} from './contracts/catalog.schema';
export type {
  PublisherInput,
  PublisherUpdate,
  EditionInput,
  CallNumberUpdate,
  RecordListQuery,
  PublisherListQuery,
  RecordInput,
  RecordUpdate,
  RecordReject,
  PublisherDto,
  EditionDto,
  CatalogRecordDto,
  Paginated,
} from './contracts/catalog.schema';

export {
  copyStatusSchema,
  locationInputSchema,
  copyBulkCreateSchema,
  copyUpdateSchema,
} from './contracts/holdings.schema';
export type {
  LocationInput,
  CopyBulkCreate,
  CopyUpdate,
  LocationDto,
  CopyDto,
} from './contracts/holdings.schema';

export {
  loanInputSchema,
  reservationInputSchema,
  reservationCreateSchema,
  policyUpdateSchema,
  finePaymentSchema,
  fineWaiverRequestSchema,
  fineWaiverDecisionSchema,
  policyVersionCreateSchema,
  policyScopeSchema,
} from './contracts/circulation.schema';
export type {
  LoanInput,
  ReservationInput,
  ReservationCreate,
  PolicyUpdate,
  PolicyVersionCreate,
  PolicyScopeQuery,
  PolicyDto,
  LoanDto,
  LoanCopyOption,
  BorrowerDto,
  ReservationDto,
  FineDto,
  FinePaymentInput,
  FineWaiverRequestInput,
  FineWaiverDecision,
  FinePaymentDto,
  FinePaymentResult,
  FineWaiverRequestDto,
  FineReceiptDto,
} from './contracts/circulation.schema';

export { paginationQuerySchema, pageQuerySchema } from './contracts/pagination.schema';
export type { PaginationQuery, PageQuery } from './contracts/pagination.schema';
export * from './contracts/inventory.schema';
export * from './contracts/public.schema';
export * from './contracts/me.schema';
export * from './contracts/cards.schema';
export * from './contracts/digital.schema';
export * from './contracts/management.schema';

export {
  INCIDENT_STATUSES,
  INCIDENT_KINDS,
  INCIDENT_DECISIONS,
  incidentCreateSchema,
  incidentInfoSchema,
  incidentRequestInfoSchema,
  incidentDecisionSchema,
} from './contracts/incidents.schema';
export type {
  IncidentStatus,
  IncidentKind,
  IncidentDecision,
  IncidentCreate,
  IncidentAttachmentDto,
  IncidentInfo,
  IncidentRequestInfo,
  IncidentDecisionInput,
  IncidentDto,
} from './contracts/incidents.schema';

export {
  accountCreateSchema,
  accountUpdateSchema,
  accountResetPasswordSchema,
  accountListQuerySchema,
} from './contracts/accounts.schema';
export type {
  AccountCreate,
  AccountUpdate,
  AccountResetPassword,
  AccountListQuery,
  AccountDto,
} from './contracts/accounts.schema';

export {
  LOAN_STATUSES,
  COPY_STATUSES,
  RECORD_STATUSES,
  RESERVATION_STATUSES,
  FINE_STATUSES,
} from './enums';
export type {
  LoanStatus,
  CopyStatus,
  RecordStatus,
  ReservationStatus,
  FineStatus,
} from './enums';
