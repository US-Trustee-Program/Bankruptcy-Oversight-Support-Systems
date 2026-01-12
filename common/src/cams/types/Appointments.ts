export type ChapterType = '7' | '11' | '11-subchapter-v' | '12' | '13';

export type AppointmentType =
  | 'panel'
  | 'off-panel'
  | 'case-by-case'
  | 'pool'
  | 'out-of-pool'
  | 'standing'
  | 'elected'
  | 'converted-case';

export type AppointmentStatus =
  | 'active'
  | 'inactive'
  | 'voluntary-suspended'
  | 'involuntary-suspended'
  | 'deceased'
  | 'resigned'
  | 'terminated'
  | 'removed';
