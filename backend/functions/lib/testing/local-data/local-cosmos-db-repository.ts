import * as crypto from 'crypto';
import { ApplicationContext } from '../../adapters/types/basic';
import { DocumentRepository } from '../../use-cases/gateways.types';

type Item = {
  id?: string;
};

export class LocalCosmosDbRepository<T extends Item> implements DocumentRepository<T> {
  container: T[] = [];

  async get(_context: ApplicationContext, _id: string, _partitionKey: string): Promise<T> {
    throw new Error('Method not implemented.');
  }

  async update(_context: ApplicationContext, _id: string, _partitionKey: string, _data: T) {
    throw new Error('Method not implemented.');
  }

  async put(_context: ApplicationContext, data: T): Promise<T> {
    const doc: T = { ...data, id: crypto.randomUUID() };
    this.container.push(doc);
    return doc;
  }

  async putAll(_context: ApplicationContext, _list: T[]): Promise<T[]> {
    throw new Error('Method not implemented.');
  }

  async delete(_context: ApplicationContext, id: string, _partitionKey: string) {
    this.container = this.container.filter((doc) => doc.id !== id);
  }
}
