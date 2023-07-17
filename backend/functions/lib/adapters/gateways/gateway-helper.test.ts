import { GatewayHelper } from './gateway-helper';

const gatewayHelper = new GatewayHelper();

describe('Gateway helper tests', () => {
  describe('calculateDifferenceInMonths tests', () => {
    test('should return 1 (a)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        new Date(2023, 7, 17),
        new Date(2023, 5, 18),
      );

      expect(monthsDifference).toEqual(1);
    });

    test('should return 1 (b)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        new Date(2023, 5, 18),
        new Date(2023, 7, 17),
      );

      expect(monthsDifference).toEqual(1);
    });

    test('should return 1 (c)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        new Date(2022, 10, 17),
        new Date(2023, 0, 16),
      );

      expect(monthsDifference).toEqual(1);
    });

    test('should return 1 (d)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        new Date(2022, 11, 16),
        new Date(2023, 0, 17),
      );

      expect(monthsDifference).toEqual(1);
    });

    test('should return 2 (a)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        new Date(2023, 7, 18),
        new Date(2023, 5, 17),
      );

      expect(monthsDifference).toEqual(2);
    });

    test('should return 2 (b)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        new Date(2023, 5, 17),
        new Date(2023, 7, 18),
      );

      expect(monthsDifference).toEqual(2);
    });

    test('should return 2 (c)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        new Date(2022, 10, 17),
        new Date(2023, 1, 16),
      );

      expect(monthsDifference).toEqual(2);
    });

    test('should return 2 (d)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        new Date(2022, 11, 16),
        new Date(2023, 1, 17),
      );

      expect(monthsDifference).toEqual(2);
    });

    test('should return 12', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        new Date(2021, 11, 15),
        new Date(2023, 0, 0),
      );

      expect(monthsDifference).toEqual(12);
    });

    test('should return 13', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        new Date(2021, 11, 15),
        new Date(2023, 1, 0),
      );

      expect(monthsDifference).toEqual(13);
    });

    test('should return 24', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        new Date(2020, 0, 0),
        new Date(2022, 0, 0),
      );

      expect(monthsDifference).toEqual(24);
    });

    test('should return 60 (a)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        new Date(2023, 6, 18),
        new Date(2018, 6, 13),
      );

      expect(monthsDifference).toEqual(60);
    });

    test('should return 60 (b)', async () => {
      const monthsDifference = gatewayHelper.calculateDifferenceInMonths(
        new Date(2023, 6, 17),
        new Date(2018, 5, 30),
      );

      expect(monthsDifference).toEqual(60);
    });
  });
});
