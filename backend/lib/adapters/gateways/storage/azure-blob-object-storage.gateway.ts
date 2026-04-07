import { BlobServiceClient } from '@azure/storage-blob';
import { ObjectStorageGateway } from '../../../use-cases/gateways.types';

let blobServiceClient: BlobServiceClient | undefined;

function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    const connectionString = process.env.AzureWebJobsStorage;
    if (!connectionString) {
      throw new Error('Missing required environment variable: AzureWebJobsStorage');
    }
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }
  return blobServiceClient;
}

export class AzureBlobObjectStorageGateway implements ObjectStorageGateway {
  async writeObject(containerName: string, objectName: string, content: string): Promise<void> {
    const containerClient = getBlobServiceClient().getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(objectName);
    const buffer = Buffer.from(content, 'utf-8');
    await blockBlobClient.upload(buffer, buffer.length);
  }

  async readObject(containerName: string, objectName: string): Promise<string | null> {
    const containerClient = getBlobServiceClient().getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(objectName);

    const exists = await blobClient.exists();
    if (!exists) {
      return null;
    }

    const downloadResponse = await blobClient.download();
    if (!downloadResponse.readableStreamBody) {
      return '';
    }
    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
}
