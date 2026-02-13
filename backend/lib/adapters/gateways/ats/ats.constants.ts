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
 * Map district codes to court IDs
 * Based on ATS district numbering scheme
 */
export const DISTRICT_TO_COURT_MAP: Record<string, string> = {
  '01': 'usbc-ma',
  '02': 'usbc-sdny',
  '03': 'usbc-edny',
  '04': 'usbc-ct',
  '05': 'usbc-vt',
  '06': 'usbc-ndny',
  '07': 'usbc-wdny',
  '08': 'usbc-nj',
  '09': 'usbc-edpa',
  '10': 'usbc-mdpa',
  '11': 'usbc-wdpa',
  '12': 'usbc-de',
  '13': 'usbc-md',
  '14': 'usbc-edva',
  '15': 'usbc-wdva',
  '16': 'usbc-sc',
  '17': 'usbc-wv',
  '18': 'usbc-nc',
  '19': 'usbc-ga',
  '20': 'usbc-sdfl',
  '21': 'usbc-mdfl',
  '22': 'usbc-ndfl',
  '23': 'usbc-pr',
  '24': 'usbc-la',
  '25': 'usbc-ms',
  '26': 'usbc-edtx',
  '27': 'usbc-wdtx',
  '28': 'usbc-ndtx',
  '29': 'usbc-sdtx',
  '30': 'usbc-edky',
  '31': 'usbc-wdky',
  '32': 'usbc-edmi',
  '33': 'usbc-wdmi',
  '34': 'usbc-ndoh',
  '35': 'usbc-sdoh',
  '36': 'usbc-edtn',
  '37': 'usbc-mdtn',
  '38': 'usbc-wdtn',
  '39': 'usbc-ndil',
  '40': 'usbc-cdil',
  '41': 'usbc-sdil',
  '42': 'usbc-ndin',
  '43': 'usbc-sdin',
  '44': 'usbc-edwi',
  '45': 'usbc-wdwi',
  '46': 'usbc-edar',
  '47': 'usbc-wdar',
  '48': 'usbc-ndia',
  '49': 'usbc-sdia',
  '50': 'usbc-mn',
  '51': 'usbc-edmo',
  '52': 'usbc-wdmo',
  '53': 'usbc-ne',
  '54': 'usbc-nd',
  '55': 'usbc-sd',
  '56': 'usbc-az',
  '57': 'usbc-ndca',
  '58': 'usbc-edca',
  '59': 'usbc-cdca',
  '60': 'usbc-sdca',
  '61': 'usbc-hi',
  '62': 'usbc-id',
  '63': 'usbc-mt',
  '64': 'usbc-nv',
  '65': 'usbc-or',
  '66': 'usbc-edwa',
  '67': 'usbc-wdwa',
  '68': 'usbc-co',
  '69': 'usbc-ks',
  '70': 'usbc-nm',
  '71': 'usbc-edok',
  '72': 'usbc-ndok',
  '73': 'usbc-wdok',
  '74': 'usbc-ut',
  '75': 'usbc-wy',
  '76': 'usbc-dc',
  '77': 'usbc-vi',
};
