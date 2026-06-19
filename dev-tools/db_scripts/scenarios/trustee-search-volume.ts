/**
 * Scenario: trustee-search-volume
 * Database: cams only
 *
 * Seeds 50 trustees to exercise trustee name search without a result cap:
 *
 *   - 30 trustees whose last name starts with "Bo" (index 001–030)
 *   - 20 trustees with varied last names (index 031–050)
 *
 * Use this scenario to verify that the trustee name search returns all
 * matching results when there are more than 25 hits.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { createTrusteeBase } from '../lib/test-data-utils.js';

const SEEDER_PREFIX = 'seed-trustee-search-vol';

// 30 trustees whose last name starts with "Bo"
const BO_TRUSTEES: { firstName: string; lastName: string; state: string; city: string }[] = [
  { firstName: 'Alice', lastName: 'Bowen', state: 'NY', city: 'New York' },
  { firstName: 'Brian', lastName: 'Booth', state: 'CA', city: 'Los Angeles' },
  { firstName: 'Carol', lastName: 'Bolton', state: 'TX', city: 'Houston' },
  { firstName: 'David', lastName: 'Bowers', state: 'FL', city: 'Miami' },
  { firstName: 'Elena', lastName: 'Bowman', state: 'IL', city: 'Chicago' },
  { firstName: 'Frank', lastName: 'Boles', state: 'PA', city: 'Philadelphia' },
  { firstName: 'Grace', lastName: 'Boone', state: 'OH', city: 'Columbus' },
  { firstName: 'Henry', lastName: 'Boyle', state: 'GA', city: 'Atlanta' },
  { firstName: 'Iris', lastName: 'Bogard', state: 'NC', city: 'Charlotte' },
  { firstName: 'James', lastName: 'Boswell', state: 'MI', city: 'Detroit' },
  { firstName: 'Karen', lastName: 'Bouchard', state: 'WA', city: 'Seattle' },
  { firstName: 'Leon', lastName: 'Bock', state: 'AZ', city: 'Phoenix' },
  { firstName: 'Maria', lastName: 'Bogan', state: 'CO', city: 'Denver' },
  { firstName: 'Nathan', lastName: 'Bolduc', state: 'MN', city: 'Minneapolis' },
  { firstName: 'Olivia', lastName: 'Boles', state: 'OR', city: 'Portland' },
  { firstName: 'Paul', lastName: 'Bowden', state: 'CT', city: 'Hartford' },
  { firstName: 'Quinn', lastName: 'Bodine', state: 'NV', city: 'Las Vegas' },
  { firstName: 'Rachel', lastName: 'Bova', state: 'WI', city: 'Milwaukee' },
  { firstName: 'Steven', lastName: 'Borger', state: 'MO', city: 'Kansas City' },
  { firstName: 'Teresa', lastName: 'Bott', state: 'TN', city: 'Nashville' },
  { firstName: 'Ulric', lastName: 'Bock', state: 'KY', city: 'Louisville' },
  { firstName: 'Vera', lastName: 'Bova', state: 'IN', city: 'Indianapolis' },
  { firstName: 'Walter', lastName: 'Boser', state: 'AL', city: 'Birmingham' },
  { firstName: 'Xena', lastName: 'Bolden', state: 'SC', city: 'Columbia' },
  { firstName: 'Yvonne', lastName: 'Borton', state: 'OK', city: 'Oklahoma City' },
  { firstName: 'Zachary', lastName: 'Bosley', state: 'UT', city: 'Salt Lake City' },
  { firstName: 'Amy', lastName: 'Boutin', state: 'IA', city: 'Des Moines' },
  { firstName: 'Bruce', lastName: 'Boman', state: 'KS', city: 'Wichita' },
  { firstName: 'Clara', lastName: 'Bortner', state: 'NM', city: 'Albuquerque' },
  { firstName: 'Derek', lastName: 'Bowie', state: 'NE', city: 'Omaha' },
];

// 20 trustees with varied last names
const OTHER_TRUSTEES: { firstName: string; lastName: string; state: string; city: string }[] = [
  { firstName: 'Eva', lastName: 'Carlson', state: 'NY', city: 'Buffalo' },
  { firstName: 'Felix', lastName: 'Dawson', state: 'CA', city: 'San Diego' },
  { firstName: 'Gina', lastName: 'Elliott', state: 'TX', city: 'Dallas' },
  { firstName: 'Hugo', lastName: 'Foster', state: 'FL', city: 'Tampa' },
  { firstName: 'Ines', lastName: 'Gomez', state: 'IL', city: 'Springfield' },
  { firstName: 'Jake', lastName: 'Hartley', state: 'PA', city: 'Pittsburgh' },
  { firstName: 'Kim', lastName: 'Ingram', state: 'OH', city: 'Cleveland' },
  { firstName: 'Luis', lastName: 'Jensen', state: 'GA', city: 'Savannah' },
  { firstName: 'Mia', lastName: 'Knowles', state: 'NC', city: 'Raleigh' },
  { firstName: 'Neil', lastName: 'Larsen', state: 'MI', city: 'Grand Rapids' },
  { firstName: 'Opal', lastName: 'Mercer', state: 'WA', city: 'Spokane' },
  { firstName: 'Pete', lastName: 'Norton', state: 'AZ', city: 'Tucson' },
  { firstName: 'Rosa', lastName: 'Owens', state: 'CO', city: 'Aurora' },
  { firstName: 'Sam', lastName: 'Pearce', state: 'MN', city: 'Saint Paul' },
  { firstName: 'Tara', lastName: 'Quinn', state: 'OR', city: 'Eugene' },
  { firstName: 'Uma', lastName: 'Rivera', state: 'CT', city: 'New Haven' },
  { firstName: 'Vince', lastName: 'Sutton', state: 'NV', city: 'Reno' },
  { firstName: 'Wren', lastName: 'Tanner', state: 'WI', city: 'Madison' },
  { firstName: 'Xyla', lastName: 'Underwood', state: 'MO', city: 'St. Louis' },
  { firstName: 'Yuri', lastName: 'Valdez', state: 'TN', city: 'Memphis' },
];

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  const boTrustees = BO_TRUSTEES.map((t, i) =>
    createTrusteeBase({
      id: `${SEEDER_PREFIX}-bo-${String(i + 1).padStart(3, '0')}`,
      firstName: t.firstName,
      lastName: t.lastName,
      status: 'active',
      city: t.city,
      state: t.state,
    }),
  );

  const otherTrustees = OTHER_TRUSTEES.map((t, i) =>
    createTrusteeBase({
      id: `${SEEDER_PREFIX}-other-${String(i + 1).padStart(3, '0')}`,
      firstName: t.firstName,
      lastName: t.lastName,
      status: 'active',
      city: t.city,
      state: t.state,
    }),
  );

  return [
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [...boTrustees, ...otherTrustees],
    },
  ];
}
