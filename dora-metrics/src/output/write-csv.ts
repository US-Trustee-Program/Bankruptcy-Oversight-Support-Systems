import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PeriodBucket } from '../metrics/deployment-frequency.js';

const CSV_HEADER = 'periodStart,periodEnd,deploymentCount,deploymentsPerDay';

export async function writeCsv(buckets: PeriodBucket[], filePath: string): Promise<void> {
  const rows = buckets.map(
    (bucket) =>
      `${bucket.periodStart},${bucket.periodEnd},${bucket.deploymentCount},${bucket.deploymentsPerDay}`,
  );
  const csv = [CSV_HEADER, ...rows].join('\n') + '\n';

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, csv, 'utf8');
}
