import { z } from 'zod';

export const INCIDENT_STATUSES = ['new', 'need_info', 'under_review', 'resolved'] as const;
export const INCIDENT_KINDS = ['reported_lost', 'damaged', 'other'] as const;
export const INCIDENT_DECISIONS = ['no_change', 'confirmed_lost', 'confirmed_damaged'] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentKind = (typeof INCIDENT_KINDS)[number];
export type IncidentDecision = (typeof INCIDENT_DECISIONS)[number];

export const incidentCreateSchema = z.object({
  copyId: z.string().uuid(),
  kind: z.enum(INCIDENT_KINDS),
  description: z.string().trim().min(10).max(2000),
  evidence: z.string().trim().max(4000).optional(),
});
export type IncidentCreate = z.infer<typeof incidentCreateSchema>;

export const incidentInfoSchema = z.object({
  evidence: z.string().trim().min(1).max(4000),
});
export type IncidentInfo = z.infer<typeof incidentInfoSchema>;

export const incidentRequestInfoSchema = z.object({
  requestInfo: z.string().trim().min(10).max(1000),
});
export type IncidentRequestInfo = z.infer<typeof incidentRequestInfoSchema>;

export const incidentDecisionSchema = z.object({
  decision: z.enum(INCIDENT_DECISIONS),
  reason: z.string().trim().min(10).max(2000),
});
export type IncidentDecisionInput = z.infer<typeof incidentDecisionSchema>;

export interface IncidentDto {
  id: string;
  copyId: string;
  copyCode: string;
  workTitle: string;
  loanId: string | null;
  kind: IncidentKind;
  status: IncidentStatus;
  description: string;
  evidence: string | null;
  requestInfo: string | null;
  decision: IncidentDecision | null;
  decisionReason: string | null;
  reportedByName: string;
  decidedByName: string | null;
  createdAt: string;
  decidedAt: string | null;
}
