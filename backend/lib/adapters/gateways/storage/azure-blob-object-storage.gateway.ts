import { BlobServiceClient } from '@azure/storage-blob';
import { ObjectStorageGateway } from '../../../use-cases/gateways.types';

export class AzureBlobObjectStorageGateway implements ObjectStorageGateway {
  async readObject(containerName: string, objectName: string): Promise<string | null> {
    const connectionString = process.env.AzureWebJobsStorage;
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(objectName);

    const exists = await blobClient.exists();
    if (!exists) {
      return null;
    }

    const downloadResponse = await blobClient.download();
    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
}
