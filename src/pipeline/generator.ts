import type { School, Borough, ProgramYear } from '../types/school.ts';
import type { SchoolScore } from '../types/score.ts';
import type { ActiveFlag, FlaggedSchoolReport } from '../types/flags.ts';
import { evaluateSchoolScore } from '../engine/grader.ts';
import { evaluateSchoolFlags, buildFlaggedSchoolReport, type WeeklyLogHistoryItem } from '../engine/flagger.ts';
import realCohortData from '../../data/cohort.json';

export interface SchoolWithData {
  school: School;
  score: SchoolScore;
  flags: ActiveFlag[];
  weeklyHistory: WeeklyLogHistoryItem[];
  snapshot: {
    nextHarvestEstimate: string;
    generalNotes: string;
    cropsHarvested: string[];
    distributionDestinations: string[];
    knownIssues: string;
    aquaponicsNotes?: string;
    studentExperimentFrequency: string;
    teachersTrainedNames: string[];
    labAvailability: string;
  };
}

export function generateRealisticCohort(): {
  schools: SchoolWithData[];
  flaggedReports: FlaggedSchoolReport[];
} {
  if (realCohortData && realCohortData.schools && realCohortData.schools.length > 0) {
    return {
      schools: realCohortData.schools as unknown as SchoolWithData[],
      flaggedReports: realCohortData.flaggedReports as unknown as FlaggedSchoolReport[],
    };
  }

  const baseSchools: Array<{
    dbn: string;
    name: string;
    borough: Borough;
    programYear: ProgramYear;
    assignedGst: string;
    areaManager: string;
    curriculumSpecialist: string;
    installationDate: string;
    systemsInstalled: number;
    hasAquaponics: boolean;
    archetype: 'thriving' | 'healthy' | 'watch' | 'intervene' | 'below_floor_f' | 'provisional' | 'incomplete';
  }> = [
    // Real schools from NYSW data links
    { dbn: 'K089', name: 'PS 089 Cypress Hills', borough: 'Brooklyn', programYear: 'Op Y3+', assignedGst: 'Yolanda Giannino', areaManager: 'Spencer King', curriculumSpecialist: 'Heather Holz', installationDate: '2011', systemsInstalled: 3, hasAquaponics: false, archetype: 'healthy' },
    { dbn: 'K130', name: 'PS 130 The Parkside', borough: 'Brooklyn', programYear: 'Op Y1', assignedGst: 'Spencer King', areaManager: 'Spencer King', curriculumSpecialist: 'Becky Fox', installationDate: '2019', systemsInstalled: 4, hasAquaponics: true, archetype: 'thriving' },
    { dbn: 'K147', name: 'PS 147 Isaac Remsen', borough: 'Brooklyn', programYear: 'Op Y2', assignedGst: 'Yolanda Giannino', areaManager: 'Spencer King', curriculumSpecialist: 'Heather Holz', installationDate: '2013', systemsInstalled: 3, hasAquaponics: false, archetype: 'watch' },
    { dbn: 'K159', name: 'PS 159 Isaac Pitkin', borough: 'Brooklyn', programYear: 'Implementation', assignedGst: 'Jasmin', areaManager: 'Amanda Low', curriculumSpecialist: 'Heather Holz', installationDate: '2022', systemsInstalled: 3, hasAquaponics: false, archetype: 'thriving' },
    { dbn: 'M199', name: 'PS 199 Jessie Isador Straus', borough: 'Manhattan', programYear: 'Op Y3+', assignedGst: 'Jasmin', areaManager: 'Amanda Low', curriculumSpecialist: 'Shakira Provasoli', installationDate: '2017', systemsInstalled: 4, hasAquaponics: false, archetype: 'thriving' },
    { dbn: 'Q620', name: 'Thomas A Edison Career & Tech HS', borough: 'Queens', programYear: 'Op Y1', assignedGst: 'Amanda Low', areaManager: 'Amanda Low', curriculumSpecialist: 'Megan Roberts', installationDate: '2020', systemsInstalled: 5, hasAquaponics: true, archetype: 'healthy' },
    { dbn: 'X208', name: 'PS 208 The Spofford School', borough: 'Bronx', programYear: 'Op Y2', assignedGst: 'Jasmin', areaManager: 'Spencer King', curriculumSpecialist: 'Becky Fox', installationDate: '2018', systemsInstalled: 3, hasAquaponics: false, archetype: 'below_floor_f' },
    { dbn: 'M028', name: 'PS 028 Wright Brothers', borough: 'Manhattan', programYear: 'Op Y2', assignedGst: 'Jasmin', areaManager: 'Amanda Low', curriculumSpecialist: 'Shakira Provasoli', installationDate: '2019', systemsInstalled: 3, hasAquaponics: false, archetype: 'below_floor_f' },
    { dbn: 'X434', name: 'Bronx High School of Business', borough: 'Bronx', programYear: 'Op Y3+', assignedGst: 'Jasmin', areaManager: 'Spencer King', curriculumSpecialist: 'Heather Holz', installationDate: '2016', systemsInstalled: 4, hasAquaponics: false, archetype: 'intervene' },
    { dbn: 'X186', name: 'PS 186 Walter J. Damrosch', borough: 'Bronx', programYear: 'Op Y1', assignedGst: 'Jasmin', areaManager: 'Spencer King', curriculumSpecialist: 'Becky Fox', installationDate: '2021', systemsInstalled: 3, hasAquaponics: false, archetype: 'healthy' },
    { dbn: 'X492', name: 'Urban Assembly School for Wildlife Conservation', borough: 'Bronx', programYear: 'Op Y3+', assignedGst: 'Jasmin', areaManager: 'Spencer King', curriculumSpecialist: 'Heather Holz', installationDate: '2015', systemsInstalled: 3, hasAquaponics: false, archetype: 'watch' },
    { dbn: 'X219', name: 'IS 219 New Venture School', borough: 'Bronx', programYear: 'Op Y1', assignedGst: 'Jasmin', areaManager: 'Spencer King', curriculumSpecialist: 'Becky Fox', installationDate: '2020', systemsInstalled: 4, hasAquaponics: false, archetype: 'thriving' },
    { dbn: 'X244', name: 'PS 244 The New School', borough: 'Bronx', programYear: 'Op Y2', assignedGst: 'Jasmin', areaManager: 'Spencer King', curriculumSpecialist: 'Shakira Provasoli', installationDate: '2018', systemsInstalled: 3, hasAquaponics: false, archetype: 'below_floor_f' },
    { dbn: 'M311', name: 'Amistad Dual Language School', borough: 'Manhattan', programYear: 'Op Y3+', assignedGst: 'Jasmin', areaManager: 'Amanda Low', curriculumSpecialist: 'Shakira Provasoli', installationDate: '2014', systemsInstalled: 3, hasAquaponics: false, archetype: 'healthy' },
    { dbn: 'M132', name: 'PS 132 Juan Pablo Duarte', borough: 'Manhattan', programYear: 'Op Y1', assignedGst: 'Jasmin', areaManager: 'Amanda Low', curriculumSpecialist: 'Megan Roberts', installationDate: '2021', systemsInstalled: 4, hasAquaponics: false, archetype: 'provisional' },
    { dbn: 'M152', name: 'PS 152 Dyckman Valley', borough: 'Manhattan', programYear: 'Op Y2', assignedGst: 'Jasmin', areaManager: 'Amanda Low', curriculumSpecialist: 'Becky Fox', installationDate: '2017', systemsInstalled: 3, hasAquaponics: false, archetype: 'incomplete' },

    // Additional realistic partner schools across boroughs
    { dbn: 'K284', name: 'PS 284 Gregory Jackson', borough: 'Brooklyn', programYear: 'Op Y1', assignedGst: 'Yolanda Giannino', areaManager: 'Spencer King', curriculumSpecialist: 'Heather Holz', installationDate: '2021', systemsInstalled: 3, hasAquaponics: false, archetype: 'healthy' },
    { dbn: 'K380', name: 'PS 380 John Wayne', borough: 'Brooklyn', programYear: 'Op Y2', assignedGst: 'Yolanda Giannino', areaManager: 'Spencer King', curriculumSpecialist: 'Heather Holz', installationDate: '2019', systemsInstalled: 4, hasAquaponics: false, archetype: 'intervene' },
    { dbn: 'K415', name: 'Sunset Park Prep', borough: 'Brooklyn', programYear: 'Op Y3+', assignedGst: 'Spencer King', areaManager: 'Spencer King', curriculumSpecialist: 'Becky Fox', installationDate: '2015', systemsInstalled: 4, hasAquaponics: true, archetype: 'thriving' },
    { dbn: 'M075', name: 'PS 075 Emily Dickinson', borough: 'Manhattan', programYear: 'Op Y1', assignedGst: 'Amanda Low', areaManager: 'Amanda Low', curriculumSpecialist: 'Shakira Provasoli', installationDate: '2022', systemsInstalled: 3, hasAquaponics: false, archetype: 'thriving' },
    { dbn: 'M111', name: 'PS 111 Adolph S Ochs', borough: 'Manhattan', programYear: 'Op Y2', assignedGst: 'Amanda Low', areaManager: 'Amanda Low', curriculumSpecialist: 'Megan Roberts', installationDate: '2018', systemsInstalled: 3, hasAquaponics: false, archetype: 'watch' },
    { dbn: 'M165', name: 'PS 165 Robert E Simon', borough: 'Manhattan', programYear: 'Op Y3+', assignedGst: 'Amanda Low', areaManager: 'Amanda Low', curriculumSpecialist: 'Shakira Provasoli', installationDate: '2014', systemsInstalled: 4, hasAquaponics: false, archetype: 'healthy' },
    { dbn: 'M171', name: 'PS 171 Patrick Henry', borough: 'Manhattan', programYear: 'Op Y1', assignedGst: 'Jasmin', areaManager: 'Amanda Low', curriculumSpecialist: 'Becky Fox', installationDate: '2021', systemsInstalled: 3, hasAquaponics: false, archetype: 'below_floor_f' },
    { dbn: 'Q019', name: 'PS 019 Marino Jeantet', borough: 'Queens', programYear: 'Op Y2', assignedGst: 'Spencer King', areaManager: 'Spencer King', curriculumSpecialist: 'Megan Roberts', installationDate: '2019', systemsInstalled: 3, hasAquaponics: false, archetype: 'healthy' },
    { dbn: 'Q127', name: 'PS 127 Aerospace Science Magnet', borough: 'Queens', programYear: 'Op Y3+', assignedGst: 'Spencer King', areaManager: 'Spencer King', curriculumSpecialist: 'Megan Roberts', installationDate: '2016', systemsInstalled: 4, hasAquaponics: false, archetype: 'thriving' },
    { dbn: 'Q219', name: 'PS 219 Paul Klapper', borough: 'Queens', programYear: 'Op Y1', assignedGst: 'Spencer King', areaManager: 'Spencer King', curriculumSpecialist: 'Megan Roberts', installationDate: '2020', systemsInstalled: 3, hasAquaponics: false, archetype: 'watch' },
    { dbn: 'Q314', name: 'PS 314 The Fairview School', borough: 'Queens', programYear: 'Implementation', assignedGst: 'Amanda Low', areaManager: 'Amanda Low', curriculumSpecialist: 'Megan Roberts', installationDate: '2023', systemsInstalled: 4, hasAquaponics: true, archetype: 'thriving' },
    { dbn: 'R018', name: 'PS 018 John G Whittier', borough: 'Staten Island', programYear: 'Op Y2', assignedGst: 'Yolanda Giannino', areaManager: 'Spencer King', curriculumSpecialist: 'Becky Fox', installationDate: '2019', systemsInstalled: 3, hasAquaponics: false, archetype: 'healthy' },
    { dbn: 'R045', name: 'PS 045 John Tyler', borough: 'Staten Island', programYear: 'Op Y1', assignedGst: 'Yolanda Giannino', areaManager: 'Spencer King', curriculumSpecialist: 'Heather Holz', installationDate: '2021', systemsInstalled: 3, hasAquaponics: false, archetype: 'intervene' },
    { dbn: 'R061', name: 'PS 061 Francisco Dalmau', borough: 'Staten Island', programYear: 'Op Y3+', assignedGst: 'Yolanda Giannino', areaManager: 'Spencer King', curriculumSpecialist: 'Becky Fox', installationDate: '2015', systemsInstalled: 4, hasAquaponics: false, archetype: 'below_floor_f' },
    { dbn: 'X032', name: 'PS 032 Belmont', borough: 'Bronx', programYear: 'Op Y1', assignedGst: 'Jasmin', areaManager: 'Spencer King', curriculumSpecialist: 'Shakira Provasoli', installationDate: '2021', systemsInstalled: 3, hasAquaponics: false, archetype: 'thriving' },
    { dbn: 'X065', name: 'PS 065 Mother Hale Academy', borough: 'Bronx', programYear: 'Op Y2', assignedGst: 'Jasmin', areaManager: 'Spencer King', curriculumSpecialist: 'Heather Holz', installationDate: '2018', systemsInstalled: 3, hasAquaponics: false, archetype: 'watch' },
    { dbn: 'X100', name: 'PS 100 Isaac Clason', borough: 'Bronx', programYear: 'Op Y3+', assignedGst: 'Jasmin', areaManager: 'Spencer King', curriculumSpecialist: 'Becky Fox', installationDate: '2016', systemsInstalled: 4, hasAquaponics: false, archetype: 'healthy' },
  ];

  const schoolsWithData: SchoolWithData[] = [];
  const flaggedReports: FlaggedSchoolReport[] = [];

  baseSchools.forEach(b => {
    const school: School = {
      dbn: b.dbn,
      name: b.name,
      borough: b.borough,
      programYear: b.programYear,
      assignedGst: b.assignedGst,
      areaManager: b.areaManager,
      curriculumSpecialist: b.curriculumSpecialist,
      installationDate: b.installationDate,
      numLabs: 1,
      systemsInstalled: b.systemsInstalled,
      hasAquaponics: b.hasAquaponics,
      address: `NYC Public School, ${b.borough}, NY`,
    };

    // Construct profile & scoring parameters according to archetype
    let onTimeAssetRate = 0.92;
    let lateRate = 0.85;
    let systemsUptime = 0.95;
    let stickers = true;
    let sign = true;
    let hcUsability = 3.6;
    let amvUsability = 3.6;
    let surveyCompleted = true;
    let gstSupport = 0.82;
    let harvestsMo = 2.5;
    let harvestLbs = 2.3;
    let visitorSuit = 3.5;
    let amvClean = 3.5;
    let seedlings = 0.45;
    let pestFree = 0.92;

    let q14 = 0.78;
    let q15 = 0.75;
    let q18 = 0.72;
    let amvVisits = 2;
    let amvCurriculum = 0.90;
    let rubricLvl = 3.2;
    let rubricGrowth = 0.50;
    let trainingComp = 0.92;
    let attendedPD = true;
    let conversationRate = 0.75;
    let teacherRel = 3.5;

    let daysLateSept30 = 20;
    let custodian = 3.4;
    let fallLetter = true;
    let springLetter = true;
    let principalContact = 0.80;

    let weeklyExpected = 30;
    let weeklyFiled = 28;
    let budgetConcern = false;

    const weeklyLogs: WeeklyLogHistoryItem[] = [];

    if (b.archetype === 'thriving') {
      onTimeAssetRate = 0.95;
      lateRate = 1.0;
      systemsUptime = 0.98;
      stickers = true; sign = true;
      hcUsability = 3.8; amvUsability = 3.9;
      gstSupport = 0.84;
      harvestsMo = 2.8; harvestLbs = 2.7;
      visitorSuit = 3.8; amvClean = 3.8;
      seedlings = 0.48; pestFree = 0.94;
      q14 = 0.82; q15 = 0.80; q18 = 0.78;
      amvCurriculum = 1.0;
      rubricLvl = 3.4; rubricGrowth = 0.60;
      trainingComp = 0.96; attendedPD = true;
      conversationRate = 0.82; teacherRel = 3.8;
      daysLateSept30 = 0; // On time
      custodian = 3.7;
      fallLetter = true; springLetter = true;
      principalContact = 0.88;
      weeklyFiled = 30;

      for (let i = 1; i <= 10; i++) {
        weeklyLogs.push({
          weekEndingDate: `2026-0${Math.floor((i - 1) / 4) + 2}-${((i % 4) * 7 + 1).toString().padStart(2, '0')}`,
          reportStatus: 'Completed',
          systemsDownCount: 0,
          harvestLogged: i % 2 === 0,
          totalHarvestsYtd: Math.floor(i / 2) + 2,
        });
      }
    } else if (b.archetype === 'healthy') {
      onTimeAssetRate = 0.88;
      lateRate = 0.75;
      systemsUptime = 0.91;
      stickers = true; sign = true;
      hcUsability = 3.3; amvUsability = 3.2;
      gstSupport = 0.74;
      harvestsMo = 2.2; harvestLbs = 2.0;
      visitorSuit = 3.2; amvClean = 3.2;
      seedlings = 0.38; pestFree = 0.88;
      q14 = 0.72; q15 = 0.70; q18 = 0.65;
      amvCurriculum = 0.85;
      rubricLvl = 2.9; rubricGrowth = 0.40;
      trainingComp = 0.85; attendedPD = true;
      conversationRate = 0.68; teacherRel = 3.2;
      daysLateSept30 = 35;
      custodian = 3.0;
      fallLetter = true; springLetter = true;
      principalContact = 0.72;
      weeklyFiled = 27;

      for (let i = 1; i <= 10; i++) {
        weeklyLogs.push({
          weekEndingDate: `2026-0${Math.floor((i - 1) / 4) + 2}-${((i % 4) * 7 + 1).toString().padStart(2, '0')}`,
          reportStatus: i === 3 ? 'Late' : 'Completed',
          systemsDownCount: i === 5 ? 1 : 0,
          harvestLogged: i % 3 === 0,
          totalHarvestsYtd: Math.floor(i / 3) + 2,
        });
      }
    } else if (b.archetype === 'watch') {
      onTimeAssetRate = 0.78;
      lateRate = 0.60;
      systemsUptime = 0.82;
      stickers = true; sign = false; // 1/2 branding
      hcUsability = 2.7; amvUsability = 2.8;
      gstSupport = 0.62;
      harvestsMo = 1.6; harvestLbs = 1.4;
      visitorSuit = 2.7; amvClean = 2.8;
      seedlings = 0.28; pestFree = 0.80;
      q14 = 0.60; q15 = 0.58; q18 = 0.52;
      amvCurriculum = 0.75;
      rubricLvl = 2.5; rubricGrowth = 0.25;
      trainingComp = 0.72; attendedPD = false;
      conversationRate = 0.52; teacherRel = 2.6;
      daysLateSept30 = 80;
      custodian = 2.6;
      fallLetter = true; springLetter = false;
      principalContact = 0.58;
      weeklyFiled = 24;

      for (let i = 1; i <= 10; i++) {
        weeklyLogs.push({
          weekEndingDate: `2026-0${Math.floor((i - 1) / 4) + 2}-${((i % 4) * 7 + 1).toString().padStart(2, '0')}`,
          reportStatus: i % 4 === 0 ? 'Late' : 'Completed',
          systemsDownCount: i >= 7 ? 1 : 0,
          harvestLogged: i === 4,
          totalHarvestsYtd: 2, // Harvest deficit flag (<3)
        });
      }
    } else if (b.archetype === 'intervene') {
      onTimeAssetRate = 0.68;
      lateRate = 0.35;
      systemsUptime = 0.72;
      stickers = false; sign = true;
      hcUsability = 2.3; amvUsability = 2.2;
      gstSupport = 0.50;
      harvestsMo = 1.0; harvestLbs = 0.9;
      visitorSuit = 2.2; amvClean = 2.3;
      seedlings = 0.18; pestFree = 0.72;
      q14 = 0.48; q15 = 0.45; q18 = 0.40;
      amvCurriculum = 0.65;
      rubricLvl = 2.1; rubricGrowth = 0.10;
      trainingComp = 0.58; attendedPD = false;
      conversationRate = 0.42; teacherRel = 2.2;
      daysLateSept30 = 140;
      custodian = 2.1;
      fallLetter = false; springLetter = true;
      principalContact = 0.45;
      budgetConcern = true; // Budget flag!
      weeklyFiled = 21;

      for (let i = 1; i <= 10; i++) {
        weeklyLogs.push({
          weekEndingDate: `2026-0${Math.floor((i - 1) / 4) + 2}-${((i % 4) * 7 + 1).toString().padStart(2, '0')}`,
          reportStatus: i % 3 === 0 ? 'Missing' : (i % 2 === 0 ? 'Late' : 'Completed'),
          systemsDownCount: i >= 8 ? 2 : 1,
          harvestLogged: false,
          totalHarvestsYtd: 1,
        });
      }
    } else if (b.archetype === 'below_floor_f') {
      // Intentionally falls below the floor on critical KPIs:
      // C1a < 0.65 (floor), C2 < 0.60 (floor), T7 < 0.40 (floor), A1 > 365 days late
      onTimeAssetRate = 0.40; // BELOW FLOOR (0.65) -> 0 pts
      lateRate = 0.10;
      systemsUptime = 0.52;   // BELOW FLOOR (0.60) -> 0 pts
      stickers = false; sign = false; // 0 branding
      hcUsability = 1.5; amvUsability = 1.4;
      gstSupport = 0.32;
      harvestsMo = 0.3;       // BELOW FLOOR (0.50) -> 0 pts
      harvestLbs = 0.2;       // BELOW FLOOR (0.50) -> 0 pts
      visitorSuit = 1.6; amvClean = 1.5;
      seedlings = 0.05;       // BELOW FLOOR (0.10) -> 0 pts
      pestFree = 0.50;        // BELOW FLOOR (0.60) -> 0 pts
      q14 = 0.28;             // BELOW FLOOR (0.30) -> 0 pts
      q15 = 0.25;             // BELOW FLOOR (0.30) -> 0 pts
      q18 = 0.20;             // BELOW FLOOR (0.25) -> 0 pts
      amvCurriculum = 0.40;   // BELOW FLOOR (0.50) -> 0 pts
      rubricLvl = 1.3;        // BELOW FLOOR (1.50) -> 0 pts
      rubricGrowth = 0.0;
      trainingComp = 0.30;    // BELOW FLOOR (0.40) -> 0 pts
      attendedPD = false;
      conversationRate = 0.25;
      teacherRel = 1.5;
      daysLateSept30 = 380;   // BELOW FLOOR (365 days late) -> 0 pts
      custodian = 1.5;
      fallLetter = false; springLetter = false;
      principalContact = 0.20;// BELOW FLOOR (0.25) -> 0 pts
      budgetConcern = true;
      weeklyFiled = 14;

      for (let i = 1; i <= 10; i++) {
        weeklyLogs.push({
          weekEndingDate: `2026-0${Math.floor((i - 1) / 4) + 2}-${((i % 4) * 7 + 1).toString().padStart(2, '0')}`,
          reportStatus: i >= 8 ? 'Missing' : (i % 2 === 0 ? 'Late' : 'Missing'),
          systemsDownCount: i >= 6 ? 2 : 1, // 3+ consecutive down systems!
          harvestLogged: false,
          totalHarvestsYtd: 0,
        });
      }
    } else if (b.archetype === 'provisional') {
      // 70-84% reporting completeness
      weeklyFiled = 23; // 23 / 30 = 76%
      onTimeAssetRate = 0.85;
      systemsUptime = 0.90;
      for (let i = 1; i <= 10; i++) {
        weeklyLogs.push({
          weekEndingDate: `2026-0${Math.floor((i - 1) / 4) + 2}-${((i % 4) * 7 + 1).toString().padStart(2, '0')}`,
          reportStatus: i <= 7 ? 'Completed' : 'Missing',
          systemsDownCount: 0,
          harvestLogged: i % 3 === 0,
          totalHarvestsYtd: 3,
        });
      }
    } else if (b.archetype === 'incomplete') {
      // <70% reporting completeness
      weeklyFiled = 15; // 15 / 30 = 50%
      surveyCompleted = false;
      for (let i = 1; i <= 10; i++) {
        weeklyLogs.push({
          weekEndingDate: `2026-0${Math.floor((i - 1) / 4) + 2}-${((i % 4) * 7 + 1).toString().padStart(2, '0')}`,
          reportStatus: i <= 5 ? 'Completed' : 'Missing',
          systemsDownCount: 0,
          harvestLogged: false,
          totalHarvestsYtd: 1,
        });
      }
    }

    const score = evaluateSchoolScore({
      schoolDbn: school.dbn,
      schoolName: school.name,
      bucket1Input: {
        onTimeAssetRate,
        lateVsMissingRate: lateRate,
        hasZeroNonOnTimeWeeks: onTimeAssetRate >= 1.0,
        systemsUptimeRate: systemsUptime,
        stickersPresent: stickers,
        partnerSignPresent: sign,
        hcUsabilityRating: hcUsability,
        amvLabImpressionRating: amvUsability,
        surveyCompleted,
        gstSupportSurveyNormalized: gstSupport,
        harvestsPerMonthSinceNov: harvestsMo,
        harvestLbsPerMonthPerSystem: harvestLbs,
        hcVisitorSuitabilityRating: visitorSuit,
        amvCleanlinessRating: amvClean,
        seedlingsPresentRate: seedlings,
        pestFreeVisitRate: pestFree,
      },
      bucket2Input: {
        programYear: school.programYear,
        surveyCompleted,
        q14Q16UsageAndEaseNormalized: q14,
        q15Q26HelpfulnessConfidenceNormalized: q15,
        q18Q19Q22MaterialsUtilizationNormalized: q18,
        amvVisitsHeld: amvVisits,
        amvCurriculumConfirmedRate: amvCurriculum,
        latestRubricLevel: rubricLvl,
        rubricGrowth,
        trainingCompletionRate: trainingComp,
        attendedAtLeastOnePD: attendedPD,
        conversationRate,
        hcTeacherRelationshipRating: teacherRel,
        amvTeacherInvolvementRating: teacherRel,
      },
      bucket3Input: {
        daysLatePastSept30: daysLateSept30,
        hcCustodianInvolvementRating: custodian,
        hasFallThankYouLetter: fallLetter,
        hasSpringLetterOfSupport: springLetter,
        eventsHeld: 1,
        eventsPrincipalSupportRating: 3.2,
        amvVisitsHeld: amvVisits,
        amvPrincipalContactSuccessRate: principalContact,
      },
      weeklyReportsExpected: weeklyExpected,
      weeklyReportsFiled: weeklyFiled,
      hcPerformanceExpected: 2,
      hcPerformanceFiled: surveyCompleted ? 2 : 1,
      trainingExpected: 4,
      trainingFiled: surveyCompleted ? 4 : 2,
      teacherSurveyCompleted: surveyCompleted,
      lettersExpected: 2,
      lettersFiled: (fallLetter ? 1 : 0) + (springLetter ? 1 : 0),
      amvVisitsExpected: 2,
      amvVisitsFiled: amvVisits,
      previousOverallScore: scoreChangeSim(b.archetype),
      previousBucket1Score: undefined,
      previousBucket2Score: undefined,
      previousBucket3Score: undefined,
    });

    const flags = evaluateSchoolFlags({
      school,
      currentDate: '2026-04-17',
      weeklyHistory: weeklyLogs,
      cumulativeAssetCompletionRate: onTimeAssetRate,
      hasFundingOrBudgetCern: budgetConcern,
      score,
      existingFlagWeeksActive: {
        TWO_REPORTS_MISSING: b.archetype === 'below_floor_f' ? 2 : 0,
        SYSTEM_DOWN_3X: b.archetype === 'below_floor_f' ? 3 : 0,
        ASSET_COMPLETION_LOW: b.archetype === 'below_floor_f' ? 5 : 0,
        HARVEST_DEFICIT: b.archetype === 'watch' ? 4 : 0,
        BUDGET_CONCERN: budgetConcern ? 3 : 0,
      },
    });

    const report = buildFlaggedSchoolReport(school, flags);
    if (report) {
      flaggedReports.push(report);
    }

    schoolsWithData.push({
      school,
      score,
      flags,
      weeklyHistory: weeklyLogs,
      snapshot: {
        nextHarvestEstimate: '2026-05-12',
        generalNotes: 'Hydroponic science farm classroom active. Students cultivating basil, kale, mint, and romaine.',
        cropsHarvested: ['Genovese Basil', 'Curly Kale', 'Spearmint', 'Romaine Lettuce', 'Cherry Tomatoes'],
        distributionDestinations: ['School Cafeteria Salad Bar', 'Student Families Take-Home', 'Local Community Fridge'],
        knownIssues: b.archetype === 'below_floor_f' ? 'Tower 2 pump failure, teacher vacancy mid-year' : 'None reported',
        aquaponicsNotes: school.hasAquaponics ? 'Tilapia tank running; pH 7.2, water temp 74F, ammonia 0.1 ppm' : undefined,
        studentExperimentFrequency: '2–3 experiments per month',
        teachersTrainedNames: ['Ms. Elena Rostova', 'Mr. David Morales'],
        labAvailability: 'Open 5 days/week during periods 2–7',
      },
    });
  });

  return { schools: schoolsWithData, flaggedReports };
}

function scoreChangeSim(archetype: string): number {
  if (archetype === 'thriving') return 91.0;
  if (archetype === 'healthy') return 83.5;
  if (archetype === 'watch') return 74.0;
  if (archetype === 'intervene') return 62.0;
  return 52.0;
}
