export type AssetType = 'Character' | 'Prop' | 'Weapon' | 'Vehicle';
export type AssetStatus = 'Not Started' | 'Base input' | 'Grey scale Model(1st pass)' | 'Texture' | 'Final Review' | 'Approved' | 'RM Approved' | 'Completed';
export type VersionStage = 'Base input' | 'Grey scale Model(1st pass)' | 'Texture' | 'Final Package' | string;
export type VersionStatus = 'Pending Review' | 'Corrections Needed' | 'Approved' | 'RM Approved';
export type StudioName = 'Xentrix' | 'Innovative Colors' | 'Inhouse' | 'Other';
export interface Asset {
  id: string;
  parentId?: string; // ID of the main asset if this is a variation
  name: string;
  type: AssetType;
  status: AssetStatus;
  assignedArtists: string[];
  createdAt: number;
  updatedAt: number;
  
  // Custom Stages
  extraStages?: string[];
  pipelineOrder?: string[];
  
  // Inventory fields
  isReady?: boolean;
  masterDriveLink?: string;
  
  // Refined tracking fields
  studio?: StudioName;
  priority?: 'Primary' | 'Secondary';
  inputExpectedDate?: string;
  inputCompletedDate?: string;
  refSent?: string; // "Yes" / "No"
  refSentDate?: string;
  firstPassExpectedDate?: string;
  firstPassReceived?: string; // "Yes" / "No"
  firstPassReceivedDate?: string;
  greyScaleExpectedDate?: string;
  reviewed?: string; // "Yes" / "No"
  reviewedDate?: string;
  finalVersionExpectedDate?: string;
  finalVersionReceivedDate?: string;
  finalReviewOutcome?: string; // "Rework", "Approved", etc.
  emailLink?: string;

  // Automation tracking
  reviewDueAt?: number;
  vendorActionDueAt?: number;
  warningSentAt?: number; // Timestamp of when the 10m warning was sent
  deadlineAlertSent?: boolean; // Flag if the final deadline alert was sent
  vendorNotified?: string; // "Yes" / "No"
  vendorNotifiedDate?: string;
  sendToVendor?: string; // "Yes" / "No"
  sendToVendorDate?: string;

  // Granular Approval Flags
  bmApproved?: boolean;
  fpApproved?: boolean;
  gsApproved?: boolean;
  finalApproved?: boolean;

  // Granular Stage Timestamps
  bmUploadedAt?: number;
  bmReviewedAt?: number;
  bmNotifiedAt?: number;
  
  fpUploadedAt?: number;
  fpReviewedAt?: number;
  fpNotifiedAt?: number;
  
  gsUploadedAt?: number;
  gsReviewedAt?: number;
  gsNotifiedAt?: number;
  
  finalUploadedAt?: number;
  finalReviewedAt?: number;
  finalReviewedAtModel?: number;
  finalReviewedAtRig?: number;
  finalNotifiedAt?: number;
}

export interface Version {
  id: string;
  assetId: string;
  stage: VersionStage;
  versionNumber: number;
  driveLink: string;
  reviewNoteLink: string;
  reviewNote?: string; // Added for text notes
  status: VersionStatus;
  reviewerId?: string; 
  // Split Reviewers for Final Package
  reviewerModelId?: string;
  reviewerRigId?: string;
  statusModel?: VersionStatus;
  statusRig?: VersionStatus;
  reviewNoteModel?: string;
  reviewNoteLinkModel?: string;
  reviewNoteRig?: string;
  reviewNoteLinkRig?: string;
  reviewedAt?: number; 
  reviewedAtModel?: number;
  reviewedAtRig?: number;
  refSent?: 'Yes' | 'No'; 
  emailLink?: string; // Added per version
  createdAt: number;
}

export type TeamRole = 'Artist' | 'Reviewer' | 'Ops';

export type ReviewerExpertise = 'Model/Texture' | 'Rig/Animation';

export interface TeamMember {
  id: string;
  name: string;
  role: TeamRole;
  active: boolean;
  slackId?: string; // Slack User ID for tagging
  slackEnabled?: boolean; // Individual toggle
  reviewerStages?: VersionStage[]; // Stages this reviewer is assigned to
  reviewerExpertise?: ReviewerExpertise[]; // Specialty for Final Package
}

export interface GlobalSettings {
  id: 'app_settings';
  slackNotificationsEnabled: boolean;
}
