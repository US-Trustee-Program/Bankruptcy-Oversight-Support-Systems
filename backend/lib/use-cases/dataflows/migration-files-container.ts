/**
 * The object storage container that dataflow migrations read their input files from and write
 * their reports to.
 */
export function getMigrationFilesContainerName(): string {
  return process.env.CAMS_OBJECT_CONTAINER ?? 'migration-files';
}
