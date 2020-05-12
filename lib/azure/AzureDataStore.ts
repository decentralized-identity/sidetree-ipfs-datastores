import * as storage from 'azure-storage';
import WritableMemoryStream from './WritableMemoryStream';
const setImmediate = require('async/setImmediate');
const each = require('async/each');
const waterfall = require('async/series');
const path = require('upath');
const asyncFilter = require('interface-datastore').utils.asyncFilter;
const asyncSort = require('interface-datastore').utils.asyncSort;

const iDatastore = require('interface-datastore');
const Key = iDatastore.Key;
const Errors = iDatastore.Errors;

const DEFERRED = require('pull-defer');
const pull = require('pull-stream');

/**
 * Structure for input params for Azure Data store
 */
export type AzureDSInputOptions = {
  /** Name of blob container. */
  containerName: string,
  /** azure storage blob Service instance */
  blobService: storage.BlobService
};

/**
 * Azure data store class that implements IDataStore
 */
export default class AzureDataStore extends iDatastore.Adapter {
  private path: string;
  private blobService: storage.BlobService;
  private container: string;

  /**
   * Constructor to initialize the class
   * @param path path to azure blob storage container
   * @param opts Azure DS input options
   * @param containerName Azure blob storage container name
   */
  public constructor (path: string, opts: AzureDSInputOptions) {
    super();
    this.path = path;
    this.container = opts.containerName;
    this.blobService = opts.blobService;

    this.blobService.createContainerIfNotExists(this.container, err => {
      if (err) {
        throw new Error('Could not create container');
      }
    });
  }

  /**
   * Returns the blob service instance
   */
  public getBlobService (): storage.BlobService {
    return this.blobService;
  }
  /**
   * Returns the full key which includes the path to the ipfs store
   * @param key
   */
  private getFullKey (key: any): string {
    return path.join('.', this.path, key.toString());
  }

  /**
   * Recursively fetches all keys from azure blob storage
   * @param params
   * @param keys
   * @param callback
   */
  private async listKeys (prefix: string, currentToken: any, keys: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.blobService.listBlobsSegmentedWithPrefix(this.container, prefix, currentToken, (err, result, response) => {
        if (err) {
          reject(new Error(err.name));
          return;
        }
        if (response.isSuccessful) {
          result.entries.forEach((d) => {
            keys.push(new Key(d.name.slice(this.path.length), false));
          });
  
          if (result.continuationToken) {
            resolve(this.listKeys(prefix, result.continuationToken, keys));
            return;
          }
        }
  
        resolve(keys)
      });
    })
  }

  /**
   * Returns an iterator for fetching objects from azure by their key
   * @param keys
   * @param keysOnly Whether or not only keys should be returned
   */
  private getBlobIterator (keys: any, keysOnly: boolean): any {
    let count: number = 0;

    return {
      next: async () => {
        if (count >= keys.length) {
          return null
        }
        let currentKey = keys[count++];
        if (keysOnly) {
          return null
        }
        return await this.get(currentKey);
      }
    };
  }

  /**
   * Store the given value under the key.
   * @param key
   * @param val
   * @param callback
   */
  public async put (key: any, val: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this.blobService.createBlockBlobFromText(this.container, this.getFullKey(key), val, (err, _result, _response) => {
        if (err) {
          reject(Errors.dbWriteFailedError(err));
          return;
        }
        resolve();
        return;
      });
    })

  }

  /**
   * Read content from azure blob storage.
   * @param key
   * @param callback
   */
  public async get (key: any): Promise<any> {
    let writeStream: WritableMemoryStream = new WritableMemoryStream();
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        resolve(writeStream.fetchData());
        return;
      });

      this.blobService.getBlobToStream(this.container, this.getFullKey(key), writeStream, (err, _result, _response) => {
        if (err && err.message === 'NotFound') {
          reject(Errors.notFoundError(err));
          return;
        } else if (err) {
          reject(err);
          return;
        }
      });
    })
  }

  /**
   * Check for the existence of the given key.
   * @param key
   * @param callback
   */
  public async has (key: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.blobService.doesBlobExist(this.container, this.getFullKey(key), (err, result, _response) => {
        if (err) {
          reject(err);
          return;
        } else if (result && result.exists) {
          resolve(true);
          return;
        } else {
          resolve(false);
          return;
        }
      });
    })
  }

  /**
   * Delete the record under the given key.
   * @param key
   * @param callback
   */
  public delete (key: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.blobService.deleteBlobIfExists(this.container, this.getFullKey(key), (err, _result, _response) => {
        if (err) {
          reject(Errors.dbDeleteFailedError(err));
          return;
        }
        resolve();
        return;
      });
    })
  }

  /**
   * Query the azure blob storage
   * @param q
   */
  public async  query (q: any): Promise<any> {
    const prefix = path.join(this.path, q.prefix || '');

    let deferred = DEFERRED.source();
    let iterator: any;

    const rawStream = (end: any, callback: any) => {
      if (end) {
        return callback(end);
      }
      iterator.next((err: any, key: any, value: any) => {
        if (err) {
          return callback(err);
        }
        if (err === null && key === null && value === null) {
          return callback(true);
        }

        const res = {
          key: key,
          value: Buffer.from('')
        };

        if (value) {
          res.value = value;
        }
        callback(null, res);
      });
    };

    try {
      const keys = await this.listKeys(prefix, null, []);
      iterator = this.getBlobIterator(keys, q.keysOnly || false);
      deferred.resolve(rawStream);
    } catch (err) {
      deferred.abort(err);
    }

    // Use a deferred pull stream source, as async operations need to occur before the
    // pull stream begins
    let tasks = [deferred];

    if (q.filters != null) {
      tasks = tasks.concat(q.filters.map((f: any) => asyncFilter(f)));
    }

    if (q.orders != null) {
      tasks = tasks.concat(q.orders.map((o: any) => asyncSort(o)));
    }

    if (q.offset != null) {
      let i = 0;
      tasks.push(pull.filter(() => i++ >= q.offset));
    }

    if (q.limit != null) {
      tasks.push(pull.take(q.limit));
    }

    return pull.apply(null, tasks);
  }

  /**
   * This will check the blob storage for container's access and existence
   * @param callback
   */
  public async open (): Promise<void> {
    return new Promise((resolve, reject) => {
      this.blobService.doesBlobExist(this.container, this.path, async (err, _result, response) => {
        if (err) {
         reject(Errors.dbOpenFailedError(err));
         return;
        }
        if (response.statusCode === 404) {
          await this.put(new Key('/', false), Buffer.from(''));
        }

        console.log('Azure data store opened.')
        resolve();
      });
    })

  }

  /**
   * Close the store.
   */
  public async close (): Promise<void> {
    console.log('Azure data store closed.');
  }
}
