import { CamsError } from '../../common-errors/cams-error';

const MODULE_NAME = 'PETITION-GATEWAY';

const petitionLabelMap = new Map<string, string>([
  ['IP', 'Involuntary Petition'],
  ['TI', 'Transferred Involuntary Petition'],
  ['TV', 'Transferred Voluntary Petition'],
  ['VP', 'Voluntary Petition'],
]);

export function getPetitionLabel(id: string | undefined): string {
  if (petitionLabelMap.has(id)) return petitionLabelMap.get(id);
  throw new CamsError(MODULE_NAME, {
    message: 'Cannot find petition label by ID',
    data: { id },
  });
}
