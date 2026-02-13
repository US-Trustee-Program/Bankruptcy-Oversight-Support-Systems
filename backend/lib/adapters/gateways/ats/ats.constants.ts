import { AppointmentType, AppointmentStatus, TrusteeStatuses } from '@common/cams/trustees';

/**
 * ATS-specific constants for trustee migration
 */

/**
 * TOD STATUS mapping to appointment type and status.
 * Based on the mapping matrix from the ATS system documentation.
 */
export const TOD_STATUS_MAP: Record<
  string,
  { appointmentType: AppointmentType; status: AppointmentStatus }
> = {
  // Single letter codes - default to 'active' status
  P: { appointmentType: 'panel', status: 'active' },
  PA: { appointmentType: 'panel', status: 'active' },
  O: { appointmentType: 'converted-case', status: 'active' },
  C: { appointmentType: 'case-by-case', status: 'active' },
  S: { appointmentType: 'standing', status: 'active' },
  E: { appointmentType: 'elected', status: 'active' },
  V: { appointmentType: 'pool', status: 'active' },
  NP: { appointmentType: 'off-panel', status: 'resigned' },
  VR: { appointmentType: 'out-of-pool', status: 'resigned' },

  // Panel variations
  PI: { appointmentType: 'panel', status: 'voluntarily-suspended' },
  PS: { appointmentType: 'panel', status: 'voluntarily-suspended' },
  PV: { appointmentType: 'panel', status: 'voluntarily-suspended' },
  PR: { appointmentType: 'panel', status: 'resigned' },
  PT: { appointmentType: 'panel', status: 'terminated' },
  PD: { appointmentType: 'panel', status: 'deceased' },

  // Off-panel variations
  OI: { appointmentType: 'off-panel', status: 'inactive' },
  OR: { appointmentType: 'off-panel', status: 'resigned' },
  OT: { appointmentType: 'off-panel', status: 'terminated' },
  OD: { appointmentType: 'off-panel', status: 'deceased' },

  // Case-by-case variations
  CI: { appointmentType: 'case-by-case', status: 'inactive' },
  CR: { appointmentType: 'case-by-case', status: 'resigned' },

  // Standing variations
  SI: { appointmentType: 'standing', status: 'inactive' },
  SR: { appointmentType: 'standing', status: 'resigned' },
  ST: { appointmentType: 'standing', status: 'terminated' },
  SD: { appointmentType: 'standing', status: 'deceased' },

  // Numeric codes
  '1': { appointmentType: 'case-by-case', status: 'active' },
  '3': { appointmentType: 'standing', status: 'resigned' },
  '5': { appointmentType: 'standing', status: 'terminated' },
  '6': { appointmentType: 'standing', status: 'terminated' },
  '7': { appointmentType: 'standing', status: 'deceased' },
  '8': { appointmentType: 'case-by-case', status: 'active' },
  '9': { appointmentType: 'case-by-case', status: 'inactive' },
  '10': { appointmentType: 'case-by-case', status: 'inactive' },
  '12': { appointmentType: 'case-by-case', status: 'active' },
};

/**
 * Default mapping when TOD STATUS is not recognized
 */
export const DEFAULT_STATUS_MAPPING = {
  appointmentType: 'panel' as AppointmentType,
  status: 'active' as AppointmentStatus,
};

/**
 * Default trustee status for migrated trustees.
 * Can be updated later based on appointment statuses.
 */
export const DEFAULT_TRUSTEE_STATUS = TrusteeStatuses.ACTIVE;

/**
 * CBC chapter status overrides.
 * When TOD Chapter includes 'CBC', this map overrides BOTH appointmentType and status.
 */
export const CBC_STATUS_MAP: Record<
  string,
  Record<string, { appointmentType: AppointmentType; status: AppointmentStatus }>
> = {
  '12CBC': {
    '1': { appointmentType: 'case-by-case', status: 'active' },
    '2': { appointmentType: 'case-by-case', status: 'active' },
    '3': { appointmentType: 'case-by-case', status: 'inactive' },
    '5': { appointmentType: 'case-by-case', status: 'inactive' },
    '7': { appointmentType: 'case-by-case', status: 'inactive' },
  },
  '13CBC': {
    '1': { appointmentType: 'case-by-case', status: 'active' },
    '3': { appointmentType: 'case-by-case', status: 'inactive' },
  },
};

/**
 * Status codes that indicate Subchapter V appointments (Chapter 11).
 * When combined with Chapter 11, these resolve to '11-subchapter-v'.
 */
export const SUBCHAPTER_V_STATUS_CODES = new Set(['V', 'VR']);

/**
 * Chapters where status code '1' maps to Standing/Active instead of Case-by-Case/Active.
 * This is a chapter-dependent override applied after the flat map lookup.
 */
export const CODE_1_STANDING_CHAPTERS = new Set(['12', '13']);

/**
 * Special chapter codes that include appointment type
 */
export const SPECIAL_CHAPTER_CODES = {
  '12CBC': { chapter: '12', appointmentType: 'case-by-case' as AppointmentType },
  '13CBC': { chapter: '13', appointmentType: 'case-by-case' as AppointmentType },
};

/**
 * Valid chapter codes that map directly to CAMS chapters
 */
export const STANDARD_CHAPTERS = ['7', '11', '12', '13'];

/**
 * Map ATS district codes to DXTR courtId values.
 * Uses DXTR 4-character court identifiers that match CourtDivisionDetails.courtId.
 *
 * For multi-district states where ATS uses a single district code (17, 19, 24, 25),
 * the default courtId listed here is the primary district. Use MULTI_DISTRICT_COURT_MAP
 * with the division code for accurate resolution.
 */
export const DISTRICT_TO_COURT_MAP: Record<string, string> = {
  '01': '0101', // District of Massachusetts
  '02': '0208', // Southern District of New York
  '03': '0207', // Eastern District of New York
  '04': '0205', // District of Connecticut
  '05': '0210', // District of Vermont
  '06': '0206', // Northern District of New York
  '07': '0209', // Western District of New York
  '08': '0312', // District of New Jersey
  '09': '0313', // Eastern District of Pennsylvania
  '10': '0314', // Middle District of Pennsylvania
  '11': '0315', // Western District of Pennsylvania
  '12': '0311', // District of Delaware
  '13': '0416', // District of Maryland
  '14': '0422', // Eastern District of Virginia
  '15': '0423', // Western District of Virginia
  '16': '0420', // District of South Carolina
  '17': '0424', // West Virginia (default: Northern — see MULTI_DISTRICT_COURT_MAP)
  '19': '113E', // Georgia (default: Northern — see MULTI_DISTRICT_COURT_MAP)
  '20': '113C', // Southern District of Florida
  '21': '113A', // Middle District of Florida
  '22': '1129', // Northern District of Florida
  '23': '0104', // District of Puerto Rico
  '24': '053L', // Louisiana (default: Eastern — see MULTI_DISTRICT_COURT_MAP)
  '25': '0538', // Mississippi (default: Southern — see MULTI_DISTRICT_COURT_MAP)
  '26': '0540', // Eastern District of Texas
  '27': '0542', // Western District of Texas
  '28': '0539', // Northern District of Texas
  '29': '0541', // Southern District of Texas
  '30': '0643', // Eastern District of Kentucky
  '31': '0644', // Western District of Kentucky
  '32': '0645', // Eastern District of Michigan
  '33': '0646', // Western District of Michigan
  '34': '0647', // Northern District of Ohio
  '35': '0648', // Southern District of Ohio
  '36': '0649', // Eastern District of Tennessee
  '37': '0650', // Middle District of Tennessee
  '38': '0651', // Western District of Tennessee
  '39': '0752', // Northern District of Illinois
  '40': '0753', // Central District of Illinois
  '41': '0754', // Southern District of Illinois
  '42': '0755', // Northern District of Indiana
  '43': '0756', // Southern District of Indiana
  '44': '0757', // Eastern District of Wisconsin
  '45': '0758', // Western District of Wisconsin
  '46': '0860', // Eastern District of Arkansas
  '47': '0861', // Western District of Arkansas
  '48': '0862', // Northern District of Iowa
  '49': '0863', // Southern District of Iowa
  '50': '0864', // District of Minnesota
  '51': '0865', // Eastern District of Missouri
  '52': '0866', // Western District of Missouri
  '53': '0867', // District of Nebraska
  '54': '0868', // District of North Dakota
  '55': '0869', // District of South Dakota
  '56': '0970', // District of Arizona
  '57': '0971', // Northern District of California
  '58': '0972', // Eastern District of California
  '59': '0973', // Central District of California
  '60': '0974', // Southern District of California
  '61': '0975', // District of Hawaii
  '62': '0976', // District of Idaho
  '63': '0977', // District of Montana
  '64': '0978', // District of Nevada
  '65': '0979', // District of Oregon
  '66': '0980', // Eastern District of Washington
  '67': '0981', // Western District of Washington
  '68': '1082', // District of Colorado
  '69': '1083', // District of Kansas
  '70': '1084', // District of New Mexico
  '71': '1086', // Eastern District of Oklahoma
  '72': '1085', // Northern District of Oklahoma
  '73': '1087', // Western District of Oklahoma
  '74': '1088', // District of Utah
  '75': '1089', // District of Wyoming
  '76': '0090', // District of Columbia
  '77': '0391', // United States Virgin Islands
};

/**
 * For multi-district states where ATS uses a single district code, this map
 * disambiguates using the first 2 digits of the ATS DIVISION code to determine
 * the correct DXTR courtId.
 *
 * District 18 (North Carolina) is omitted — NC courtIds are not yet available
 * in the DXTR reference data.
 */
export const MULTI_DISTRICT_COURT_MAP: Record<string, Record<string, string>> = {
  '17': {
    // West Virginia
    '24': '0424', // Northern District
    '25': '0425', // Southern District
  },
  '19': {
    // Georgia
    '32': '113E', // Northern District
    '33': '113G', // Middle District
    '34': '113J', // Southern District
  },
  '24': {
    // Louisiana
    '30': '053L', // Eastern District
    '31': '053N', // Middle District
    '36': '0536', // Western District
  },
  '25': {
    // Mississippi
    '37': '0537', // Northern District
    '38': '0538', // Southern District
  },
};
