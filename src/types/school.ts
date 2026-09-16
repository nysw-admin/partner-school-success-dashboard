export type Borough = 'Manhattan' | 'Bronx' | 'Brooklyn' | 'Queens' | 'Staten Island';

export type ProgramYear = 'Implementation' | 'Op Y1' | 'Op Y2' | 'Op Y3+';

export interface School {
  dbn: string;                      // Unique NYC DOE DBN (e.g. "K089", "M199", "X208", "Q620")
  name: string;                     // Full School Name (e.g. "PS 089 Cypress Hills")
  borough: Borough;
  programYear: ProgramYear;
  isNewOpY2Teacher?: boolean;       // If Op Y2 has new teacher, T5-T7 apply
  assignedGst: string;              // Green Scientist Teacher assigned (e.g. "Jasmin", "Yolanda Giannino")
  areaManager: string;              // Area Manager (e.g. "Spencer King", "Amanda Low")
  curriculumSpecialist?: string;    // NYSW Ed Team Specialist
  installationDate: string;         // Year installed (e.g. "2017")
  numLabs: number;                  // Number of hydroponic labs (default 1)
  systemsInstalled: number;         // Count of active hydroponic systems (excluding AQX)
  hasAquaponics: boolean;           // True if school has an AQX setup
  address?: string;
  principalName?: string;
  contactEmail?: string;
}
