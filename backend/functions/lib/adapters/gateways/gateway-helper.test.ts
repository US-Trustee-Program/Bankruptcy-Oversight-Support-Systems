import { GatewayHelper } from './gateway-helper';
import { getDate } from '../utils/date-helper';

const gatewayHelper = new GatewayHelper();

describe('Gateway helper tests', () => {
  describe('calculateDifferenceInMonths tests', () => {
    test('should return 1 (a)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        getDate(2023, 8, 18),
        getDate(2023, 6, 19),
      );

      expect(monthsDifference).toEqual(1);
    });

    test('should return 1 (b)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        getDate(2023, 6, 19),
        getDate(2023, 8, 18),
      );

      expect(monthsDifference).toEqual(1);
    });

    test('should return 1 (c)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        getDate(2022, 11, 18),
        getDate(2023, 1, 17),
      );

      expect(monthsDifference).toEqual(1);
    });

    test('should return 1 (d)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        getDate(2022, 12, 17),
        getDate(2023, 1, 18),
      );

      expect(monthsDifference).toEqual(1);
    });

    test('should return 2 (a)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        getDate(2023, 8, 19),
        getDate(2023, 6, 18),
      );

      expect(monthsDifference).toEqual(2);
    });

    test('should return 2 (b)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        getDate(2023, 6, 18),
        getDate(2023, 8, 19),
      );

      expect(monthsDifference).toEqual(2);
    });

    test('should return 2 (c)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        getDate(2022, 11, 18),
        getDate(2023, 2, 17),
      );

      expect(monthsDifference).toEqual(2);
    });

    test('should return 2 (d)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        getDate(2022, 12, 17),
        getDate(2023, 2, 18),
      );

      expect(monthsDifference).toEqual(2);
    });

    test('should return 12', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        getDate(2021, 12, 16),
        getDate(2023, 1, 1),
      );

      expect(monthsDifference).toEqual(12);
    });

    test('should return 13', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        getDate(2021, 12, 16),
        getDate(2023, 2, 1),
      );

      expect(monthsDifference).toEqual(13);
    });

    test('should return 24', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        getDate(2020, 1, 1),
        getDate(2022, 1, 1),
      );

      expect(monthsDifference).toEqual(24);
    });

    test('should return 60 (a)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        getDate(2023, 7, 19),
        getDate(2018, 7, 14),
      );

      expect(monthsDifference).toEqual(60);
    });

    test('should return 60 (b)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        getDate(2023, 7, 18),
        getDate(2018, 6, 30),
      );

      expect(monthsDifference).toEqual(60);
    });
  });
});
