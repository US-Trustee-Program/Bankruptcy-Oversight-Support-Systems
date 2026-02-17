import { AppointmentType, AppointmentStatus } from '@common/cams/trustees';

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
export const DEFAULT_TRUSTEE_STATUS: AppointmentStatus = 'active';

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

/**
 * Map ATS division codes directly to DXTR courtId values.
 * Derived from DXTR court division reference data. Used as the primary courtId
 * lookup when a division code is available, since it's more precise than
 * district-based resolution (which can be wrong when a trustee's division
 * belongs to a different court than their ATS district suggests).
 */
export const DIVISION_TO_COURT_MAP: Record<string, string> = {
  '001': '0100',
  '002': '0100',
  '011': '0101',
  '014': '0101',
  '021': '0102',
  '031': '0103',
  '042': '0104',
  '043': '0104',
  '052': '0205',
  '053': '0205',
  '055': '0205',
  '061': '0206',
  '065': '0206',
  '066': '0206',
  '071': '0207',
  '078': '0207',
  '081': '0208',
  '084': '0208',
  '087': '0208',
  '091': '0209',
  '096': '0209',
  '105': '0210',
  '111': '0311',
  '121': '0312',
  '122': '0312',
  '123': '0312',
  '131': '0313',
  '132': '0313',
  '133': '0313',
  '134': '0313',
  '141': '0314',
  '144': '0314',
  '145': '0314',
  '151': '0315',
  '152': '0315',
  '153': '0315',
  '154': '0315',
  '157': '0315',
  '160': '0416',
  '161': '0416',
  '203': '0420',
  '221': '0422',
  '222': '0422',
  '223': '0422',
  '224': '0422',
  '235': '0423',
  '236': '0423',
  '237': '0423',
  '241': '0424',
  '242': '0424',
  '243': '0424',
  '245': '0424',
  '250': '0425',
  '251': '0425',
  '252': '0425',
  '253': '0425',
  '255': '0425',
  '291': '1129',
  '293': '1129',
  '294': '1129',
  '295': '1129',
  '302': '053L',
  '303': '113A',
  '306': '113A',
  '308': '113A',
  '309': '113A',
  '310': '113C',
  '311': '113C',
  '313': '053N',
  '319': '113C',
  '321': '113E',
  '322': '113E',
  '323': '113E',
  '324': '113E',
  '331': '113G',
  '333': '113G',
  '334': '113G',
  '335': '113G',
  '336': '113G',
  '337': '113G',
  '341': '113J',
  '342': '113J',
  '343': '113J',
  '344': '113J',
  '345': '113J',
  '346': '113J',
  '361': '0536',
  '362': '0536',
  '363': '0536',
  '364': '0536',
  '365': '0536',
  '371': '0537',
  '381': '0538',
  '383': '0538',
  '391': '0539',
  '392': '0539',
  '393': '0539',
  '394': '0539',
  '395': '0539',
  '396': '0539',
  '397': '0539',
  '401': '0540',
  '402': '0540',
  '403': '0540',
  '404': '0540',
  '405': '0540',
  '406': '0540',
  '409': '0540',
  '411': '0541',
  '412': '0541',
  '413': '0541',
  '414': '0541',
  '415': '0541',
  '416': '0541',
  '417': '0541',
  '421': '0542',
  '423': '0542',
  '425': '0542',
  '426': '0542',
  '427': '0542',
  '431': '0643',
  '432': '0643',
  '433': '0643',
  '435': '0643',
  '436': '0643',
  '437': '0643',
  '439': '0643',
  '441': '0644',
  '443': '0644',
  '444': '0644',
  '445': '0644',
  '451': '0645',
  '452': '0645',
  '454': '0645',
  '461': '0646',
  '462': '0646',
  '471': '0647',
  '473': '0647',
  '474': '0647',
  '475': '0647',
  '476': '0647',
  '481': '0648',
  '482': '0648',
  '483': '0648',
  '491': '0649',
  '492': '0649',
  '493': '0649',
  '501': '0650',
  '502': '0650',
  '503': '0650',
  '511': '0651',
  '512': '0651',
  '521': '0752',
  '523': '0752',
  '531': '0753',
  '532': '0753',
  '533': '0753',
  '543': '0754',
  '544': '0754',
  '545': '0754',
  '546': '0754',
  '551': '0755',
  '553': '0755',
  '554': '0755',
  '556': '0755',
  '561': '0756',
  '562': '0756',
  '563': '0756',
  '564': '0756',
  '572': '0757',
  '581': '0758',
  '582': '0758',
  '583': '0758',
  '585': '0758',
  '586': '0758',
  '601': '0860',
  '602': '0860',
  '603': '0860',
  '604': '0860',
  '605': '0860',
  '611': '0861',
  '612': '0861',
  '613': '0861',
  '614': '0861',
  '615': '0861',
  '616': '0861',
  '621': '0862',
  '622': '0862',
  '623': '0862',
  '624': '0862',
  '625': '0862',
  '626': '0862',
  '631': '0863',
  '633': '0863',
  '634': '0863',
  '643': '0864',
  '644': '0864',
  '645': '0864',
  '646': '0864',
  '651': '0865',
  '652': '0865',
  '654': '0865',
  '662': '0866',
  '663': '0866',
  '664': '0866',
  '665': '0866',
  '666': '0866',
  '674': '0867',
  '678': '0867',
  '683': '0868',
  '691': '0869',
  '693': '0869',
  '694': '0869',
  '695': '0869',
  '700': '0970',
  '702': '0970',
  '703': '0970',
  '704': '0970',
  '710': '097-',
  '711': '0971',
  '713': '0971',
  '714': '0971',
  '715': '0971',
  '720': '097-',
  '721': '0972',
  '722': '0972',
  '729': '0972',
  '730': '097-',
  '731': '0973',
  '732': '0973',
  '736': '0973',
  '738': '0973',
  '739': '0973',
  '740': '097-',
  '743': '0974',
  '750': '097-',
  '751': '0975',
  '761': '0976',
  '762': '0976',
  '763': '0976',
  '764': '0976',
  '768': '0976',
  '771': '0977',
  '772': '0977',
  '774': '0977',
  '779': '0977',
  '782': '0978',
  '783': '0978',
  '793': '0979',
  '796': '0979',
  '801': '0980',
  '802': '0980',
  '812': '0981',
  '813': '0981',
  '821': '1082',
  '832': '1083',
  '835': '1083',
  '836': '1083',
  '841': '1084',
  '854': '1085',
  '867': '1086',
  '875': '1087',
  '882': '1088',
  '891': '1089',
  '892': '1089',
  '900': '0090',
  '911': '0391',
  '913': '0391',
  '931': '0993',
  '941': '0994',
};
