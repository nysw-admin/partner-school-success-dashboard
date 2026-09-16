/**
 * Raw data structures matching exports from Accelo CRM, SurveyMonkey,
 * and Google Drive as defined in live data sources.
 */

export interface GSTWeeklySupportRaw {
  title: string;
  schoolDbn: string;
  schoolName: string;
  visitDate: string;             // YYYY-MM-DD
  gstMember: string;
  systemsNotRunning?: string[];  // e.g. ["Tower 2", "Vine System"]
  systemsWithLeaks?: string[];
  issuesWithPests?: boolean | string;
  inPersonTeacherConversation?: boolean;
  didHarvestToday?: boolean;
  harvestRecent?: boolean;
  systemsHarvested?: string[];
  harvestWeightLbs?: number;
  typesOfCrops?: string;
  distributedTo?: string;
  studentsEngagedHarvest?: number;
  seedlingsPlanted?: boolean;
  nextHarvestEstimate?: string;
  generalNotes?: string;
  // AQX fields
  aqxPh?: number;
  aqxAmmonia?: number;
  aqxNitrites?: number;
  aqxNitrates?: number;
  aqxTempF?: number;
  aquaponicsNotes?: string;
}

export interface HCPerformanceRaw {
  title: string;
  schoolDbn: string;
  date: string;
  gstMember: string;
  teacherRelationshipRating: number;   // 1-4 scale
  teacherEngagementRating: number;     // 1-4 scale
  teacherCommsOutsideVisitRating: number; // 1-4 scale
  custodianInvolvementRating: number;  // 1-4 scale (A3)
  labUsabilityRating: number;          // 1-4 scale (C4)
  visitorSuitabilityRating: number;    // 1-4 scale (C8)
  labAvailabilityRating: number;       // 1-4 scale
  stickersOnSystems: boolean;          // C3 (2 pts)
  partnerSchoolSignPresent: boolean;   // C3 (2 pts)
  fundingOrBudgetCern: boolean;        // Flag 5 & Snapshot
  knownUsabilityIssuesNotes?: string;
}

export interface EdCurriculumTrainingRaw {
  title: string;
  schoolDbn: string;
  date: string;
  specialist: string;
  sessionCompletedName: string;        // Specific session name or "PD"
  sessionDurationMinutes: number;
  sessionType: 'Curriculum' | 'PD';    // PD rows are filtered out from T5, T6, T7
  wasNoShow?: boolean;
  teacherEngagement?: number;          // 1-4
  rubricKnowledge?: number;            // 1-4
  rubricSkills?: number;               // 1-4
  rubricFarmerScientist?: number;      // 1-4
  rubricGlobalCitizen?: number;        // 1-4
  rubricCurriculum?: number;           // 1-4
  comments?: string;
}

export interface EventsRaw {
  title: string;
  schoolDbn: string;
  date: string;
  manager: string;
  approxAttendees?: number;
  principalSupportRating?: number;     // 1-4 (A9)
  harvestReported?: boolean;
  harvestWeightLbs?: number;
  harvestDistribution?: string;
  keyLearnings?: string;
}

export interface AreaManagerVisitRaw {
  title: string;
  schoolDbn: string;
  date: string;
  areaManager: string;
  inPersonTeacherConversation?: boolean; // T10
  inPersonPrincipalConversation?: boolean; // A9
  followUpEmailSent?: boolean;         // A9
  teacherUsingCurriculum?: boolean;    // T4
  labImpressionRating: number;         // 1-4 (C4)
  teacherInvolvementRating: number;    // 1-4 (T11)
  labCleanlinessRating: number;        // 1-4 (C8)
  notes?: string;
  aquaponicsNotes?: string;
}

export interface TeacherSurveyRaw {
  schoolDbn: string;
  schoolName: string;
  surveyDate: string;
  isCompleted: boolean;
  // Q14: Curriculum frequency (2 statements normalized 0-1)
  q14CurriculumFrequencyNormalized: number;
  // Q16: Ease of implementation (normalized 0-1)
  q16EaseOfImplementationNormalized: number;
  // Q15: Helpfulness (4 statements normalized 0-1)
  q15HelpfulnessNormalized: number;
  // Q26: Climate change teaching preparedness (normalized 0-1)
  q26ClimatePreparednessNormalized: number;
  // Q18: Physical materials selection rate (out of 4)
  q18PhysicalMaterialsRate: number;
  // Q19: Digital resources selection rate (out of 5)
  q19DigitalResourcesRate: number;
  // Q22: Harvest lesson aspects rate (out of 5)
  q22HarvestLessonAspectsRate: number;
  // Q28: Support services experience (6 statements normalized 0-1)
  q28SupportServicesNormalized: number;
  // Q30: Support staff rating (5 statements normalized 0-1)
  q30StaffRatingNormalized: number;
  // Q31: Overall satisfaction (1-5 stars normalized 0-1)
  q31StaffSatisfactionNormalized: number;
}

export interface MaintenancePlanRaw {
  schoolDbn: string;
  schoolName: string;
  proposalSentDate?: string;
  proposalAcceptedDate?: string;       // Proposal acceptance date for A1
  contractStatus: string;
}

export interface WeeklyAssetReportItem {
  schoolDbn: string;
  weekEndingDate: string;              // e.g. "2026-04-17"
  gstName: string;
  status: 'Completed' | 'Late' | 'Missing';
}
