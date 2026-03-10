/**
 * ATS Cleansing Mapping Constants
 *
 * District and state mappings for the ATS appointment cleansing pipeline.
 * Ported from the v4 prototype for production use.
 *
 * @see .ustp-cams-fdp/ai/specs/CAMS-596-migrate-trustee-appointments/brainstorming/classify-appointments-v4.ts
 */

/**
 * City names that appear in STATE column that should be mapped to states
 */
export const CITY_TO_STATE: Record<string, string> = {
  INDIANAPOLIS: 'INDIANA',
  HOUSTON: 'TEXAS',
  ALBUQUERQUE: 'NEW MEXICO',
  'SAN JUAN': 'PUERTO RICO',
  COLUMBIA: 'DISTRICT OF COLUMBIA',
};

/**
 * City names that appear in DISTRICT column with their expected [district, state, courtId]
 */
export const CITY_IN_DISTRICT_TO_MAPPING: Record<string, [string, string, string]> = {
  ALBANY: ['Northern', 'New York', '0206'],
  ATLANTA: ['Northern', 'Georgia', '113E'],
  LEXINGTON: ['Eastern', 'Kentucky', '0643'],
  HOUSTON: ['Southern', 'Texas', '0541'],
};

/**
 * Single-district states (state name → court ID)
 */
export const STATE_TO_SINGLE_COURT_ID: Record<string, string> = {
  ALASKA: '097-',
  ARIZONA: '0970',
  COLORADO: '1082',
  CONNECTICUT: '0205',
  DELAWARE: '0311',
  'DISTRICT OF COLUMBIA': '0090',
  GUAM: '0993',
  HAWAII: '0975',
  IDAHO: '0976',
  KANSAS: '1083',
  MAINE: '0100',
  MARYLAND: '0416',
  MASSACHUSETTS: '0101',
  MINNESOTA: '0864',
  MONTANA: '0977',
  NEBRASKA: '0867',
  NEVADA: '0978',
  'NEW HAMPSHIRE': '0102',
  'NEW JERSEY': '0312',
  'NEW MEXICO': '1084',
  'NORTH DAKOTA': '0868',
  'NORTHERN MARIANA ISLANDS': '0994',
  OREGON: '0979',
  'PUERTO RICO': '0104',
  'RHODE ISLAND': '0103',
  'SOUTH CAROLINA': '0420',
  'SOUTH DAKOTA': '0869',
  UTAH: '1088',
  VERMONT: '0210',
  'VIRGIN ISLANDS': '0391',
  WYOMING: '1089',
};

/**
 * Multi-district states (state name → district name → court ID)
 */
export const STATE_DISTRICT_TO_COURT_ID: Record<string, Record<string, string>> = {
  ARKANSAS: { EASTERN: '0860', WESTERN: '0861' },
  CALIFORNIA: { CENTRAL: '0973', EASTERN: '0972', NORTHERN: '0971', SOUTHERN: '0974' },
  FLORIDA: { MIDDLE: '113A', NORTHERN: '1129', SOUTHERN: '113C' },
  GEORGIA: { MIDDLE: '113G', NORTHERN: '113E', SOUTHERN: '113J' },
  ILLINOIS: { CENTRAL: '0753', NORTHERN: '0752', SOUTHERN: '0754' },
  INDIANA: { NORTHERN: '0755', SOUTHERN: '0756' },
  IOWA: { NORTHERN: '0862', SOUTHERN: '0863' },
  KENTUCKY: { EASTERN: '0643', WESTERN: '0644' },
  LOUISIANA: { EASTERN: '053L', MIDDLE: '053N', WESTERN: '0536' },
  MICHIGAN: { EASTERN: '0645', WESTERN: '0646' },
  MISSISSIPPI: { NORTHERN: '0537', SOUTHERN: '0538' },
  MISSOURI: { EASTERN: '0865', WESTERN: '0866' },
  'NEW YORK': { EASTERN: '0207', NORTHERN: '0206', SOUTHERN: '0208', WESTERN: '0209' },
  OHIO: { NORTHERN: '0647', SOUTHERN: '0648' },
  OKLAHOMA: { EASTERN: '1086', NORTHERN: '1085', WESTERN: '1087' },
  PENNSYLVANIA: { EASTERN: '0313', MIDDLE: '0314', WESTERN: '0315' },
  TENNESSEE: { EASTERN: '0649', MIDDLE: '0650', WESTERN: '0651' },
  TEXAS: { EASTERN: '0540', NORTHERN: '0539', SOUTHERN: '0541', WESTERN: '0542' },
  VIRGINIA: { EASTERN: '0422', WESTERN: '0423' },
  WASHINGTON: { EASTERN: '0980', WESTERN: '0981' },
  'WEST VIRGINIA': { NORTHERN: '0424', SOUTHERN: '0425' },
  WISCONSIN: { EASTERN: '0757', WESTERN: '0758' },
};

/**
 * State name normalization (typos and abbreviations)
 */
export const STATE_NAME_NORMALIZATION: Record<string, string> = {
  CALIFONIA: 'CALIFORNIA',
  ILINOIS: 'ILLINOIS',
  ILLOINIS: 'ILLINOIS',
  'NEW YROK': 'NEW YORK',
  DC: 'DISTRICT OF COLUMBIA',
  IA: 'IOWA',
  'DISTRICT COLUMBIA': 'DISTRICT OF COLUMBIA',
  'VIRGINIA AND DC': 'VIRGINIA, DISTRICT OF COLUMBIA',
};

/**
 * District name corrections (typos)
 */
export const DISTRICT_NAME_CORRECTIONS: Record<string, string> = {
  EASTER: 'EASTERN',
  NORHERN: 'NORTHERN',
  NOTHERN: 'NORTHERN',
};
