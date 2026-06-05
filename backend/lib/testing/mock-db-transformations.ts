/**
 * Test utilities for simulating MongoDB document transformations.
 *
 * These functions mirror the production fromDb/toDb mappers used in repositories
 * to translate between domain model field names and MongoDB field names.
 */

/**
 * Simulates MongoDB document shape by converting domain model to database format.
 *
 * Transformation: taskType (domain) → orderType (MongoDB)
 *
 * This is used in tests to mock what MongoDB would return, ensuring tests
 * exercise the repository's fromDb() mapper correctly.
 *
 * @param item - Domain model object with taskType field
 * @returns MongoDB document shape with orderType field
 *
 * @example
 * ```typescript
 * const order = MockData.getTransferOrder(); // Has taskType: 'transfer'
 * const dbDoc = asDbDoc(order);              // Has orderType: 'transfer'
 *
 * vi.spyOn(MongoCollectionAdapter.prototype, 'findOne')
 *   .mockResolvedValue(dbDoc);
 *
 * const result = await repo.read(order.id);  // fromDb() converts back to taskType
 * expect(result).toHaveProperty('taskType', 'transfer');
 * ```
 */
export const asDbDoc = (item: Record<string, unknown>): Record<string, unknown> => {
  const { taskType, ...rest } = item;
  return { ...rest, orderType: taskType };
};

/**
 * Converts MongoDB document to domain model shape.
 *
 * Transformation: orderType (MongoDB) → taskType (domain)
 *
 * This is the inverse of asDbDoc and mirrors the repository's fromDb() method.
 * Useful for test assertions that need to verify the transformation works correctly.
 *
 * @param doc - MongoDB document with orderType field
 * @returns Domain model object with taskType field
 *
 * @example
 * ```typescript
 * const dbDoc = { id: '123', orderType: 'transfer', caseId: '456' };
 * const domainObject = fromDbDoc(dbDoc);
 *
 * expect(domainObject).toHaveProperty('taskType', 'transfer');
 * expect(domainObject).not.toHaveProperty('orderType');
 * ```
 */
export const fromDbDoc = (doc: Record<string, unknown>): Record<string, unknown> => {
  const { orderType, ...rest } = doc;
  return { ...rest, taskType: orderType };
};
