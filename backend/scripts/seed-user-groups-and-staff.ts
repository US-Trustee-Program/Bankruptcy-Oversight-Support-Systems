#!/usr/bin/env tsx
/**
 * Utility script to seed user groups and office staff records from dev users.
 *
 * This script:
 * 1. Queries all users from the dev-users database using the dev-oauth2 gateway
 * 2. Creates a map of roles to users and locations to users
 * 3. For each role, creates a CAMS user group with the role name
 * 4. For each location, creates a CAMS user group with the location name
 * 5. Persists user groups to MongoDB using the user groups gateway
 * 6. For each location, creates OFFICE_STAFF records in the offices collection
 *
 * Usage:
 *   tsx scripts/seed-user-groups-and-staff.ts
 */

import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { ApplicationConfiguration } from '../lib/configs/application-configuration';
import { LoggerImpl } from '../lib/adapters/services/logger.service';
import { loadDevUsers } from '../lib/adapters/gateways/dev-oauth2/dev-oauth2-gateway';
import { UserGroupsMongoRepository } from '../lib/adapters/gateways/mongo/user-groups.mongo.repository';
import { OfficesMongoRepository } from '../lib/adapters/gateways/mongo/offices.mongo.repository';
import { UserGroup, CamsUserReference, Staff } from '../../common/src/cams/users';
import { MOCKED_USTP_OFFICE_DATA_MAP } from '../../common/src/cams/offices';
import { CamsRole } from '../../common/src/cams/roles';

dotenv.config();

const MODULE_NAME = 'SEED-USER-GROUPS-AND-STAFF';

/**
 * Creates a SHA-256 hash of the group name to use as the group ID
 */
function hashGroupName(groupName: string): string {
  return crypto.createHash('sha256').update(groupName).digest('hex');
}

/**
 * Creates a SHA-256 hash of the username to use as the user ID
 */
function hashUsername(username: string): string {
  return crypto.createHash('sha256').update(username).digest('hex');
}

/**
 * Creates a minimal application context for the script
 */
function createScriptContext(): ApplicationContext {
  const config = new ApplicationConfiguration();
  const logger = new LoggerImpl('seed-script', console.log);

  return {
    config,
    featureFlags: {},
    logger,
    invocationId: 'seed-script',
    request: undefined,
    session: undefined,
    closables: [],
    releasables: [],
    extraOutputs: undefined,
  };
}

async function main() {
  const context = createScriptContext();
  const { logger } = context;

  logger.info(MODULE_NAME, 'Starting user groups and office staff seeding...');

  // Step 1: Query all users using dev-oauth2 gateway
  logger.info(MODULE_NAME, 'Loading dev users...');
  const devUsers = await loadDevUsers(context);
  logger.info(MODULE_NAME, `Loaded ${devUsers.length} dev users`);

  if (devUsers.length === 0) {
    logger.warn(MODULE_NAME, 'No users found. Exiting.');
    return;
  }

  // Step 2: Create maps - one for roles to users, one for locations to users
  logger.info(MODULE_NAME, 'Creating role and location to user mappings...');

  // Map structure: Map<role, users[]>
  const roleUsersMap = new Map<string, CamsUserReference[]>();

  // Map structure: Map<officeCode, { officeCode, officeName, users }>
  const locationUsersMap = new Map<
    string,
    { officeCode: string; officeName: string; users: Map<string, CamsUserReference> }
  >();

  for (const devUser of devUsers) {
    const userId = hashUsername(devUser.username);
    const userRef: CamsUserReference = {
      id: userId,
      name: devUser.name || devUser.username,
    };

    // Map users to roles
    for (const role of devUser.roles) {
      if (!roleUsersMap.has(role)) {
        roleUsersMap.set(role, []);
      }
      const roleUsers = roleUsersMap.get(role)!;
      // Avoid duplicates
      if (!roleUsers.find((u) => u.id === userId)) {
        roleUsers.push(userRef);
      }
    }

    // Map users to locations
    for (const officeCode of devUser.offices) {
      const office = MOCKED_USTP_OFFICE_DATA_MAP.get(officeCode);
      if (!office) {
        logger.warn(
          MODULE_NAME,
          `Office code ${officeCode} not found in MOCKED_USTP_OFFICE_DATA_MAP`,
        );
        continue;
      }

      if (!locationUsersMap.has(officeCode)) {
        locationUsersMap.set(officeCode, {
          officeCode,
          officeName: office.officeName,
          users: new Map(),
        });
      }

      const locationData = locationUsersMap.get(officeCode)!;
      locationData.users.set(userId, userRef);
    }
  }

  logger.info(
    MODULE_NAME,
    `Created ${roleUsersMap.size} role groups and ${locationUsersMap.size} location groups`,
  );

  // Step 3 & 4: Create user groups for each role and each location
  logger.info(MODULE_NAME, 'Creating user groups...');
  const userGroups: UserGroup[] = [];

  // Create user groups for each role
  for (const [role, users] of roleUsersMap.entries()) {
    const groupName = role;
    const userGroup: UserGroup = {
      id: hashGroupName(groupName),
      groupName,
      users,
    };
    userGroups.push(userGroup);
    logger.info(MODULE_NAME, `Created user group: ${groupName} with ${users.length} users`);
  }

  // Create user groups for each location
  for (const [_, locationData] of locationUsersMap.entries()) {
    const groupName = locationData.officeName;
    const users: CamsUserReference[] = Array.from(locationData.users.values());
    const userGroup: UserGroup = {
      id: hashGroupName(groupName),
      groupName,
      users,
    };
    userGroups.push(userGroup);
    logger.info(MODULE_NAME, `Created user group: ${groupName} with ${users.length} users`);
  }

  // Step 5: Persist user groups to MongoDB
  logger.info(MODULE_NAME, `Persisting ${userGroups.length} user groups to MongoDB...`);
  const userGroupsRepo = UserGroupsMongoRepository.getInstance(context);
  context.releasables.push(userGroupsRepo);

  try {
    await userGroupsRepo.upsertUserGroupsBatch(context, userGroups);
    logger.info(MODULE_NAME, 'Successfully persisted user groups');
  } catch (error) {
    logger.error(MODULE_NAME, `Failed to persist user groups: ${error.message}`);
    throw error;
  }

  // Step 6: Create OFFICE_STAFF records for each location
  logger.info(MODULE_NAME, 'Creating OFFICE_STAFF records...');
  const officesRepo = OfficesMongoRepository.getInstance(context);
  context.releasables.push(officesRepo);

  let staffRecordsCreated = 0;

  for (const [officeCode, locationData] of locationUsersMap.entries()) {
    for (const [userId, userRef] of locationData.users.entries()) {
      // Find the user in devUsers to get their roles
      const devUser = devUsers.find((u) => hashUsername(u.username) === userId);
      if (!devUser) continue;

      // Map role strings to CamsRole enum values
      const roles: CamsRole[] = devUser.roles
        .map((roleName) => {
          const roleKey = Object.keys(CamsRole).find(
            (key) => CamsRole[key as keyof typeof CamsRole] === roleName,
          );
          return roleKey ? CamsRole[roleKey as keyof typeof CamsRole] : null;
        })
        .filter((role): role is CamsRole => role !== null);

      const staff: Staff = {
        id: userId,
        name: userRef.name,
        roles,
      };

      try {
        await officesRepo.putOfficeStaff(officeCode, staff);
        staffRecordsCreated++;
        logger.info(
          MODULE_NAME,
          `Created OFFICE_STAFF record for ${staff.name} in ${locationData.officeName}`,
        );
      } catch (error) {
        logger.error(
          MODULE_NAME,
          `Failed to create OFFICE_STAFF record for ${staff.name}: ${error.message}`,
        );
      }
    }
  }

  logger.info(MODULE_NAME, `Created ${staffRecordsCreated} OFFICE_STAFF records`);

  // Cleanup: Release all repository connections
  for (const releasable of context.releasables) {
    releasable.release();
  }

  logger.info(MODULE_NAME, 'Seeding completed successfully!');
}

main().catch((error) => {
  console.error('Error seeding user groups and staff:', error);
  process.exit(1);
});
