import { CamsError } from '../../common-errors/cams-error';
import { getPetitionLabel } from './petition-gateway';

describe('Petition Type Label gateway', () => {
  test('should return the name of a known petition type by ID', () => {
    const debtorTypeName = getPetitionLabel('VP');
    expect(debtorTypeName).toEqual('Voluntary Petition');
  });

  test('should throw an error for an invalid ID', () => {
    const expectedException = new CamsError('PETITION-GATEWAY', {
      message: 'Cannot find petition label by ID',
      data: { id: 'ZZ' },
    });
    expect(() => {
      getPetitionLabel('ZZ');
    }).toThrow(expectedException);
  });
});
