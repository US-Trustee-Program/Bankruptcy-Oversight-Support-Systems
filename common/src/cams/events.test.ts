import {
  Consolidation,
  isJointAdministrationChildCase,
  isJointAdministrationLeadCase,
} from './events';
import { MockData } from './test-utilities/mock-data';

const jointAdministrationLeadCase: Consolidation[] = [
  MockData.getConsolidationReference({
    override: { consolidationType: 'administrative', documentType: 'CONSOLIDATION_FROM' },
  }),
];
const jointAdministrationChildCase: Consolidation[] = [
  MockData.getConsolidationReference({
    override: { consolidationType: 'administrative', documentType: 'CONSOLIDATION_TO' },
  }),
];
const substantiveConsolidationLeadCase: Consolidation[] = [
  MockData.getConsolidationReference({
    override: { consolidationType: 'substantive', documentType: 'CONSOLIDATION_FROM' },
  }),
];
const substantiveConsolidationChildCase: Consolidation[] = [
  MockData.getConsolidationReference({
    override: { consolidationType: 'substantive', documentType: 'CONSOLIDATION_TO' },
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
      expect(isJointAdministrationLeadCase(jointAdministrationChildCase)).toBeFalsy();
      expect(isJointAdministrationLeadCase(substantiveConsolidationLeadCase)).toBeFalsy();
      expect(isJointAdministrationLeadCase(substantiveConsolidationChildCase)).toBeFalsy();
    });
  });
  describe('isJointAdministrationChildCase', () => {
    test('should return true', () => {
      expect(isJointAdministrationChildCase(jointAdministrationChildCase)).toBeTruthy();
    });
    test('should return false for all other cases', () => {
      expect(isJointAdministrationChildCase([])).toBeFalsy();
      expect(isJointAdministrationChildCase(undefined)).toBeFalsy();
      expect(isJointAdministrationChildCase(jointAdministrationLeadCase)).toBeFalsy();
      expect(isJointAdministrationChildCase(substantiveConsolidationLeadCase)).toBeFalsy();
      expect(isJointAdministrationChildCase(substantiveConsolidationChildCase)).toBeFalsy();
    });
  });
});
