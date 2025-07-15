# Test Coverage Increase Plan

## Files with Less Than 80% Branch Coverage

- [x] lib/adapters/gateways/mongo/case-assignment.mongo.repository.ts - 60% branch
- [x] lib/adapters/gateways/mongo/case-notes.mongo.repository.ts - 50% branch
- [ ] lib/adapters/gateways/mongo/offices.mongo.repository.ts - 66.66% branch
- [ ] lib/adapters/gateways/mongo/orders.mongo.repository.ts - 66.66% branch
- [ ] lib/adapters/gateways/mongo/runtime-state.mongo.repository.ts - 50% branch
- [ ] lib/adapters/gateways/mongo/user-session-cache.mongo.repository.ts - 62.5% branch
- [ ] lib/adapters/utils/database.ts - 75% branch
- [ ] lib/use-cases/dataflows/migrate-consolidations.ts - 78.57% branch

## Files with 80% or More Branch Coverage

- [ ] lib/adapters/gateways/mongo/user.repository.ts - 82.35% branch (focus on uncovered lines for
      further improvement)
- [ ] lib/adapters/gateways/mongo/consolidations.mongo.repository.ts - 84.61% branch (focus on
      uncovered lines for further improvement)
- [ ] lib/adapters/gateways/gateway-helper.ts - 100% branch (but only 70% statements, so check for
      missed logic)
- [ ] lib/adapters/gateways/dxtr/cases.dxtr.gateway.ts - 84.05% branch (focus on uncovered lines for
      further improvement)
- [ ] lib/adapters/gateways/okta/okta-gateway.ts - 81.25% branch (focus on uncovered lines for
      further improvement)
- [ ] lib/adapters/gateways/storage/local-storage-gateway.ts - 91.66% branch (focus on uncovered
      lines for further improvement)
- [ ] lib/adapters/gateways/abstract-mssql-client.ts - 83.33% branch (focus on uncovered lines for
      further improvement)
- [ ] lib/use-cases/case-assignment/case-assignment.ts - 83.78% branch (focus on uncovered lines for
      further improvement)
- [ ] lib/use-cases/offices/offices.ts - 80% branch (focus on uncovered lines for further
      improvement)
- [ ] lib/use-cases/orders/orders.ts - 86.72% branch (focus on uncovered lines for further
      improvement)
- [ ] lib/adapters/gateways/mongo/utils/mongo-adapter.ts - 96.66% branch (focus on uncovered lines
      for further improvement)
- [ ] lib/adapters/gateways/mongo/utils/mongo-aggregate-renderer.ts - 82.35% branch (focus on
      uncovered lines for further improvement)
- [ ] lib/adapters/gateways/mongo/utils/mongo-query-renderer.ts - 90% branch (focus on uncovered
      lines for further improvement)
- [ ] lib/configs/application-configuration.ts - 89.47% branch (focus on uncovered lines for further
      improvement)
- [ ] lib/use-cases/admin/admin.ts - 93.75% branch (focus on uncovered lines for further
      improvement)

Focus on these files first to maximize the impact on branch coverage and help pass the CI gate.
