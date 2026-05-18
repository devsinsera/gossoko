// src/types/moderation.ts

export type ReportType = 'spam' | 'offensive' | 'inappropriate_image' | 'fake_venue' | 'impersonation' | 'other';

export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

export type ModerationAction = 'hide' | 'remove' | 'warn_user' | 'suspend_user' | 'ban_user' | 'approve';

export type ContentType = 'review' | 'comment' | 'user' | 'venue';

export type QueuePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ContentReport {
  id: string;
  created_at: string;
  reported_by: string;
  report_type: ReportType;
  reason: string;
  content_type: ContentType;
  content_id: string;
  status: ModerationStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  resolution_notes: string | null;
}

export interface ModerationQueueItem {
  id: string;
  created_at: string;
  content_type: ContentType;
  content_id: string;
  priority: QueuePriority;
  auto_flagged: boolean;
  auto_flag_reason: string | null;
  status: ModerationStatus;
  assigned_to: string | null;
  assigned_at: string | null;
  content: any; // The actual content (review, comment, etc)
  reporter_count: number; // How many reports this content has
}

export interface SpamDetectionResult {
  isSpam: boolean;
  score: number;
  reasons: string[];
  requiresReview: boolean;
}

export interface VerificationResult {
  isValid: boolean;
  errors: string[];
  verificationCode: string | null;
  expiresAt: string | null;
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  spam: 'Spam',
  offensive: 'Offensive Content',
  inappropriate_image: 'Inappropriate Image',
  fake_venue: 'Fake Venue',
  impersonation: 'Impersonation',
  other: 'Other',
};

export const MODERATION_STATUS_LABELS: Record<ModerationStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  hidden: 'Hidden',
};

export const QUEUE_PRIORITY_LABELS: Record<QueuePriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const QUEUE_PRIORITY_LEVELS: Record<QueuePriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  urgent: 4,
};
