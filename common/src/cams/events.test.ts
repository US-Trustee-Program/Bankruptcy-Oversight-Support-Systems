import {
  Consolidation,
  isJointAdministrationMemberCase,
  isJointAdministrationLeadCase,
} from './events';
import MockData from './test-utilities/mock-data';

const jointAdministrationLeadCase: Consolidation[] = [
  MockData.getConsolidationReference({
    override: { documentType: 'CONSOLIDATION_FROM', consolidationType: 'administrative' },
  }),
];
const jointAdministrationMemberCase: Consolidation[] = [
  MockData.getConsolidationReference({
    override: { documentType: 'CONSOLIDATION_TO', consolidationType: 'administrative' },
  }),
];
const substantiveConsolidationLeadCase: Consolidation[] = [
  MockData.getConsolidationReference({
    override: { documentType: 'CONSOLIDATION_FROM', consolidationType: 'substantive' },
  }),
];
const substantiveConsolidationMemberCase: Consolidation[] = [
  MockData.getConsolidationReference({
    override: { documentType: 'CONSOLIDATION_TO', consolidationType: 'substantive' },
  }),
];

describe('Event domain helper function-apps', () => {
  describe('isJointAdministrationLeadCase', () => {
    test('should return true', () => {
      expect(isJointAdministrationLeadCase(jointAdministrationLeadCase)).toBeTruthy();
    });
    test('should return false for all other cases', () => {
      expect(isJointAdministrationLeadCase([])).toBeFalsy();
      expect(isJointAdministrationLeadCase(undefined)).toBeFalsy();
      expect(isJointAdministrationLeadCase(jointAdministrationMemberCase)).toBeFalsy();
      expect(isJointAdministrationLeadCase(substantiveConsolidationLeadCase)).toBeFalsy();
      expect(isJointAdministrationLeadCase(substantiveConsolidationMemberCase)).toBeFalsy();
    });
  });
  describe('isJointAdministrationMemberCase', () => {
    test('should return true', () => {
      expect(isJointAdministrationMemberCase(jointAdministrationMemberCase)).toBeTruthy();
    });
    test('should return false for all other cases', () => {
      expect(isJointAdministrationMemberCase([])).toBeFalsy();
      expect(isJointAdministrationMemberCase(undefined)).toBeFalsy();
      expect(isJointAdministrationMemberCase(jointAdministrationLeadCase)).toBeFalsy();
      expect(isJointAdministrationMemberCase(substantiveConsolidationLeadCase)).toBeFalsy();
      expect(isJointAdministrationMemberCase(substantiveConsolidationMemberCase)).toBeFalsy();
    });
  });
});
