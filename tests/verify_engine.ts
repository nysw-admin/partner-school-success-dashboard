import { evaluateSchoolScore } from '../src/engine/grader.ts';
import { evaluateSchoolFlags } from '../src/engine/flagger.ts';
import type { School } from '../src/types/school.ts';

console.log('====================================================');
console.log('NY SUN WORKS — SCORING ENGINE MATHEMATICAL VERIFICATION');
console.log('====================================================');

let passedTests = 0;
let totalTests = 0;

function assertClose(actual: number, expected: number, tolerance: number, label: string) {
  totalTests++;
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    console.log(`[PASS] ${label}: Got ${actual.toFixed(2)}, Expected ${expected.toFixed(2)} (diff: ${diff.toFixed(4)})`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${label}: Got ${actual.toFixed(2)}, Expected ${expected.toFixed(2)} (diff: ${diff.toFixed(4)})`);
  }
}

function assertEquals(actual: any, expected: any, label: string) {
  totalTests++;
  if (actual === expected) {
    console.log(`[PASS] ${label}: ${actual}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${label}: Got ${actual}, Expected ${expected}`);
  }
}

// ----------------------------------------------------
// 1. SCHOOL A: Grade A (93.50), Green — thriving
// ----------------------------------------------------
console.log('\n--- Testing School A (Thriving) ---');
const schoolAScore = evaluateSchoolScore({
  schoolDbn: 'A001',
  schoolName: 'School A',
  bucket1Input: {
    onTimeAssetRate: 0.94,
    lateVsMissingRate: 1.0,
    hasZeroNonOnTimeWeeks: false,
    systemsUptimeRate: 0.97,
    stickersPresent: true,
    partnerSignPresent: true,
    hcUsabilityRating: 3.8,
    amvLabImpressionRating: 3.8,
    surveyCompleted: true,
    gstSupportSurveyNormalized: 0.80,
    harvestsPerMonthSinceNov: 2.6,
    harvestLbsPerMonthPerSystem: 2.4,
    hcVisitorSuitabilityRating: 3.7,
    amvCleanlinessRating: 3.7,
    seedlingsPresentRate: 0.55,
    pestFreeVisitRate: 0.93,
  },
  bucket2Input: {
    programYear: 'Op Y1',
    surveyCompleted: true,
    q14Q16UsageAndEaseNormalized: 0.80,
    q15Q26HelpfulnessConfidenceNormalized: 0.78,
    q18Q19Q22MaterialsUtilizationNormalized: 0.75,
    amvVisitsHeld: 2,
    amvCurriculumConfirmedRate: 1.0,
    latestRubricLevel: 3.4,
    rubricGrowth: 0.65,
    trainingCompletionRate: 0.98,
    attendedAtLeastOnePD: true,
    conversationRate: 0.85,
    hcTeacherRelationshipRating: 3.8,
    amvTeacherInvolvementRating: 3.8,
  },
  bucket3Input: {
    daysLatePastSept30: 15, // 350 / 365 * 10 = 9.59
    hcCustodianInvolvementRating: 3.7,
    hasFallThankYouLetter: true,
    hasSpringLetterOfSupport: true,
    eventsHeld: 0,
    amvVisitsHeld: 2,
    amvPrincipalContactSuccessRate: 0.85, // Direct pooled 0.85 -> 3.69
  },
  weeklyReportsExpected: 30,
  weeklyReportsFiled: 30,
  hcPerformanceExpected: 2,
  hcPerformanceFiled: 2,
  trainingExpected: 4,
  trainingFiled: 4,
  teacherSurveyCompleted: true,
  lettersExpected: 2,
  lettersFiled: 2,
  amvVisitsExpected: 2,
  amvVisitsFiled: 2,
});

assertClose(schoolAScore.bucket1.earnedPoints, 39.08, 0.1, 'School A Bucket 1 Score');
assertClose(schoolAScore.bucket2.earnedPoints, 37.43, 0.1, 'School A Bucket 2 Score');
assertClose(schoolAScore.bucket3.earnedPoints, 16.98, 0.1, 'School A Bucket 3 Score');
assertClose(schoolAScore.overallScore, 93.50, 0.2, 'School A Overall Score');
assertEquals(schoolAScore.letterGrade, 'A', 'School A Grade');
assertEquals(schoolAScore.tier, 'Green — Thriving', 'School A Tier');
assertEquals(schoolAScore.completeness.status, 'Normal', 'School A Completeness');

// ----------------------------------------------------
// 2. SCHOOL C: Grade C (67.65), Yellow — watch
// ----------------------------------------------------
console.log('\n--- Testing School C (Watch) ---');
const schoolCScore = evaluateSchoolScore({
  schoolDbn: 'C001',
  schoolName: 'School C',
  bucket1Input: {
    onTimeAssetRate: 0.896,
    lateVsMissingRate: 0.70,
    hasZeroNonOnTimeWeeks: false,
    systemsUptimeRate: 0.92,
    stickersPresent: true,
    partnerSignPresent: false, // 1/2 branding
    hcUsabilityRating: 2.8,
    amvLabImpressionRating: 2.8,
    surveyCompleted: true,
    gstSupportSurveyNormalized: 0.63,
    harvestsPerMonthSinceNov: 2.1,
    harvestLbsPerMonthPerSystem: 1.9,
    hcVisitorSuitabilityRating: 2.95,
    amvCleanlinessRating: 2.95,
    seedlingsPresentRate: 0.38,
    pestFreeVisitRate: 0.86,
  },
  bucket2Input: {
    programYear: 'Op Y1',
    surveyCompleted: true,
    q14Q16UsageAndEaseNormalized: 0.71,
    q15Q26HelpfulnessConfidenceNormalized: 0.69,
    q18Q19Q22MaterialsUtilizationNormalized: 0.64,
    amvVisitsHeld: 2,
    amvCurriculumConfirmedRate: 0.85,
    latestRubricLevel: 2.7,
    rubricGrowth: 0.375,
    trainingCompletionRate: 0.82,
    attendedAtLeastOnePD: false,
    conversationRate: 0.65,
    hcTeacherRelationshipRating: 2.65,
    amvTeacherInvolvementRating: 2.65,
  },
  bucket3Input: {
    daysLatePastSept30: 60, // 305 / 365 * 10 = 8.36
    hcCustodianInvolvementRating: 2.8,
    hasFallThankYouLetter: true,
    hasSpringLetterOfSupport: false, // 1/2 letters
    eventsHeld: 1,
    eventsPrincipalSupportRating: 2.8,
    amvVisitsHeld: 2,
    amvPrincipalContactSuccessRate: 0.61,
  },
  weeklyReportsExpected: 30,
  weeklyReportsFiled: 27,
  hcPerformanceExpected: 2,
  hcPerformanceFiled: 2,
  trainingExpected: 4,
  trainingFiled: 4,
  teacherSurveyCompleted: true,
  lettersExpected: 2,
  lettersFiled: 1,
  amvVisitsExpected: 2,
  amvVisitsFiled: 2,
});

assertClose(schoolCScore.bucket1.earnedPoints, 29.64, 0.1, 'School C Bucket 1 Score');
assertClose(schoolCScore.bucket2.earnedPoints, 25.15, 0.1, 'School C Bucket 2 Score');
assertClose(schoolCScore.bucket3.earnedPoints, 12.86, 0.1, 'School C Bucket 3 Score');
assertClose(schoolCScore.overallScore, 67.65, 0.2, 'School C Overall Score');
assertEquals(schoolCScore.letterGrade, 'C', 'School C Grade');
assertEquals(schoolCScore.tier, 'Yellow — Watch', 'School C Tier');

// ----------------------------------------------------
// 3. SCHOOL D: Grade D (57.52), Red — intervene
// ----------------------------------------------------
console.log('\n--- Testing School D (Intervene) ---');
const schoolDScore = evaluateSchoolScore({
  schoolDbn: 'D001',
  schoolName: 'School D',
  bucket1Input: {
    onTimeAssetRate: 0.42, // Below floor 0.65 -> earns 0 points
    lateVsMissingRate: 0.15,
    hasZeroNonOnTimeWeeks: false,
    systemsUptimeRate: 0.86,
    stickersPresent: true,
    partnerSignPresent: false,
    hcUsabilityRating: 2.95,
    amvLabImpressionRating: 2.95,
    surveyCompleted: true,
    gstSupportSurveyNormalized: 0.66,
    harvestsPerMonthSinceNov: 2.1,
    harvestLbsPerMonthPerSystem: 2.1,
    hcVisitorSuitabilityRating: 2.95,
    amvCleanlinessRating: 2.95,
    seedlingsPresentRate: 0.36,
    pestFreeVisitRate: 0.83,
  },
  bucket2Input: {
    programYear: 'Op Y1',
    surveyCompleted: true,
    q14Q16UsageAndEaseNormalized: 0.66,
    q15Q26HelpfulnessConfidenceNormalized: 0.66,
    q18Q19Q22MaterialsUtilizationNormalized: 0.61,
    amvVisitsHeld: 2,
    amvCurriculumConfirmedRate: 0.83,
    latestRubricLevel: 2.8,
    rubricGrowth: 0.49,
    trainingCompletionRate: 0.79,
    attendedAtLeastOnePD: true,
    conversationRate: 0.73,
    hcTeacherRelationshipRating: 2.95,
    amvTeacherInvolvementRating: 2.95,
  },
  bucket3Input: {
    daysLatePastSept30: 65, // 300 / 365 * 10 = 8.22
    hcCustodianInvolvementRating: 2.95,
    hasFallThankYouLetter: true,
    hasSpringLetterOfSupport: true,
    eventsHeld: 1,
    eventsPrincipalSupportRating: 2.95,
    amvVisitsHeld: 2,
    amvPrincipalContactSuccessRate: 0.67,
  },
  weeklyReportsExpected: 30,
  weeklyReportsFiled: 26,
  hcPerformanceExpected: 2,
  hcPerformanceFiled: 2,
  trainingExpected: 4,
  trainingFiled: 3,
  teacherSurveyCompleted: true,
  lettersExpected: 2,
  lettersFiled: 2,
  amvVisitsExpected: 2,
  amvVisitsFiled: 2,
});

assertClose(schoolDScore.bucket1.earnedPoints, 17.40, 0.15, 'School D Bucket 1 Score (Failing 41.4%)');
assertClose(schoolDScore.bucket2.earnedPoints, 26.35, 0.2, 'School D Bucket 2 Score');
assertClose(schoolDScore.bucket3.earnedPoints, 13.77, 0.15, 'School D Bucket 3 Score');
assertClose(schoolDScore.overallScore, 57.52, 0.2, 'School D Overall Score');
assertEquals(schoolDScore.letterGrade, 'D', 'School D Grade');
assertEquals(schoolDScore.tier, 'Red — Intervene', 'School D Tier');

// ----------------------------------------------------
// 4. FLAG ENGINE VERIFICATION
// ----------------------------------------------------
console.log('\n--- Testing Flag Engine Rules ---');
const sampleSchool: School = {
  dbn: 'K147',
  name: 'PS 147 Isaac Remsen',
  borough: 'Brooklyn',
  programYear: 'Op Y1',
  assignedGst: 'Yolanda Giannino',
  areaManager: 'Spencer King',
  installationDate: '2013',
  numLabs: 1,
  systemsInstalled: 3,
  hasAquaponics: false,
};

// Test 1: TWO_REPORTS_MISSING
const flagsMissing = evaluateSchoolFlags({
  school: sampleSchool,
  currentDate: '2026-04-17',
  weeklyHistory: [
    { weekEndingDate: '2026-04-03', reportStatus: 'Completed', systemsDownCount: 0, harvestLogged: true, totalHarvestsYtd: 4 },
    { weekEndingDate: '2026-04-10', reportStatus: 'Missing', systemsDownCount: 0, harvestLogged: false, totalHarvestsYtd: 4 },
    { weekEndingDate: '2026-04-17', reportStatus: 'Missing', systemsDownCount: 0, harvestLogged: false, totalHarvestsYtd: 4 },
  ],
  cumulativeAssetCompletionRate: 0.85,
  hasFundingOrBudgetCern: false,
  score: schoolAScore,
});
assertEquals(flagsMissing.some(f => f.id === 'TWO_REPORTS_MISSING'), true, 'Flag: Two Consecutive Reports Missing');

// Test 2: ASSET_COMPLETION_LOW
const flagsLowAssets = evaluateSchoolFlags({
  school: sampleSchool,
  currentDate: '2026-04-17',
  weeklyHistory: [
    { weekEndingDate: '2026-04-17', reportStatus: 'Completed', systemsDownCount: 0, harvestLogged: true, totalHarvestsYtd: 4 },
  ],
  cumulativeAssetCompletionRate: 0.62, // < 70%
  hasFundingOrBudgetCern: false,
  score: schoolAScore,
});
assertEquals(flagsLowAssets.some(f => f.id === 'ASSET_COMPLETION_LOW'), true, 'Flag: Low Asset Completion (<70%)');

// Test 3: SYSTEM_DOWN_3X
const flagsSystemDown = evaluateSchoolFlags({
  school: sampleSchool,
  currentDate: '2026-04-17', // before May 15
  weeklyHistory: [
    { weekEndingDate: '2026-04-03', reportStatus: 'Completed', systemsDownCount: 1, harvestLogged: true, totalHarvestsYtd: 4 },
    { weekEndingDate: '2026-04-10', reportStatus: 'Completed', systemsDownCount: 1, harvestLogged: false, totalHarvestsYtd: 4 },
    { weekEndingDate: '2026-04-17', reportStatus: 'Completed', systemsDownCount: 2, harvestLogged: false, totalHarvestsYtd: 4 },
  ],
  cumulativeAssetCompletionRate: 0.90,
  hasFundingOrBudgetCern: false,
  score: schoolAScore,
});
assertEquals(flagsSystemDown.some(f => f.id === 'SYSTEM_DOWN_3X'), true, 'Flag: 3 Consecutive Reports Down');

// Test 4: HARVEST_DEFICIT (Checked after March 1)
const flagsHarvestDeficit = evaluateSchoolFlags({
  school: sampleSchool,
  currentDate: '2026-04-17',
  weeklyHistory: [
    { weekEndingDate: '2026-04-17', reportStatus: 'Completed', systemsDownCount: 0, harvestLogged: false, totalHarvestsYtd: 1 },
  ],
  cumulativeAssetCompletionRate: 0.90,
  hasFundingOrBudgetCern: false,
  score: schoolAScore,
});
assertEquals(flagsHarvestDeficit.some(f => f.id === 'HARVEST_DEFICIT'), true, 'Flag: Harvest Deficit (<3 after March 1)');

// Test 5: BUDGET_CONCERN
const flagsBudget = evaluateSchoolFlags({
  school: sampleSchool,
  currentDate: '2026-04-17',
  weeklyHistory: [
    { weekEndingDate: '2026-04-17', reportStatus: 'Completed', systemsDownCount: 0, harvestLogged: true, totalHarvestsYtd: 5 },
  ],
  cumulativeAssetCompletionRate: 0.90,
  hasFundingOrBudgetCern: true,
  score: schoolAScore,
});
assertEquals(flagsBudget.some(f => f.id === 'BUDGET_CONCERN'), true, 'Flag: Budget / Contract Concern');

console.log(`\nRESULTS: ${passedTests} / ${totalTests} tests passed.`);
if (passedTests === totalTests) {
  console.log('ALL MATHEMATICAL SPECIFICATIONS & RULES VERIFIED 100%!');
} else {
  process.exit(1);
}
