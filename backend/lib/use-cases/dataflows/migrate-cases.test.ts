describe('Migate cases use case', () => {
  test('should return case ids for migration', async () => {
    const caseIds = MockData.buildArray(MockData.randomCaseId, 1000);
    jest.spyOn(AcmsGatewayImpl.prototype, 'getCaseIdsToMigrate').mockResolvedValue(caseIds);
    const useCase = new AcmsOrders();

    const actual = await useCase.getCaseIdsToMigrate(context);
    expect(actual).toEqual(caseIds);
  });

  test('should throw error if we cannot get case ids to migrate', async () => {
    jest.spyOn(Factory, 'getAcmsGateway').mockReturnValue(mockAcmsGateway);
    const useCase = new AcmsOrders();
    const expected = new UnknownError('test-module', {
      message: 'Failed to get case IDs to migrate from the ACMS gateway.',
    });

    const actualError = await getExpectedError<UnknownError>(() =>
      useCase.getCaseIdsToMigrate(context),
    );
    expect(actualError).toEqual(
      expect.objectContaining({
        ...expected,
        module: expect.any(String),
        originalError: expect.anything(),
      }),
    );
  });
});
