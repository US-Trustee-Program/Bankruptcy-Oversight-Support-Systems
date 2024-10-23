import { NotFoundError } from '../../../common-errors/not-found-error';
import { UnknownError } from '../../../common-errors/unknown-error';
import { CollectionHumble } from '../../../humble-objects/mongo-humble';
import { DocumentQuery } from '../document-db.repository';
import { getCamsError } from '../../../common-errors/error-utilities';
import { CamsError } from '../../../common-errors/cams-error';

export class MongoCollectionAdapter<T> {
  private collectionHumble: CollectionHumble<T>;
  private readonly notAcknowledged: UnknownError;
  private readonly moduleName: string;

  private testAcknowledged(result: { acknowledged?: boolean }) {
    if (result.acknowledged === false) {
      throw this.notAcknowledged;
    }
  }

  constructor(moduleName: string, collection: CollectionHumble<T>) {
    this.collectionHumble = collection;
    this.moduleName = moduleName;
    this.notAcknowledged = new UnknownError(this.moduleName, {
      message: 'Operation returned Not Acknowledged.',
    });
  }

  public async find(query: DocumentQuery) {
    try {
      const result = await this.collectionHumble.find(query);
      return result.toArray();
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async findOne(query: DocumentQuery) {
    try {
      return await this.collectionHumble.findOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async replaceOne(query: DocumentQuery, item: unknown) {
    try {
      const result = await this.collectionHumble.replaceOne(query, item);
      this.testAcknowledged(result);

      return result.upsertedId.toString();
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async insertOne(item: unknown) {
    try {
      const result = await this.collectionHumble.insertOne(item);
      this.testAcknowledged(result);

      return result.insertedId.toString();
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async insertMany(items: unknown[]) {
    try {
      const result = await this.collectionHumble.insertMany(items);
      // TODO: Is this mapping correct? Are we returning string representations of inserted object IDs?
      this.testAcknowledged(result);
      const insertedIds = Object.keys(result.insertedIds).map((item) => item.toString());
      if (insertedIds.length !== items.length) {
        throw new CamsError(this.moduleName, {
          message: 'Not all items inserted',
          data: insertedIds,
        });
      }
      return insertedIds;
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async deleteOne(query: DocumentQuery) {
    try {
      const result = await this.collectionHumble.deleteOne(query);
      this.testAcknowledged(result);
      if (result.deletedCount !== 1) {
        throw new NotFoundError(this.moduleName, { message: 'No items deleted' });
      }

      return result.deletedCount;
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async deleteMany(query: DocumentQuery) {
    try {
      const result = await this.collectionHumble.deleteMany(query);
      this.testAcknowledged(result);
      if (result.deletedCount < 1) {
        throw new NotFoundError(this.moduleName, { message: 'No items deleted' });
      }

      return result.deletedCount;
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }

  public async countDocuments(query: DocumentQuery) {
    try {
      return await this.collectionHumble.countDocuments(query);
    } catch (originalError) {
      throw getCamsError(originalError, this.moduleName);
    }
  }
}
