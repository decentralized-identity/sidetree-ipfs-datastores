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
export default class AzureDataStore {
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
  private listKeys (prefix: string, currentToken: any, keys: any, callback: any): void {
    if (typeof callback === 'undefined') {
      callback = keys;
      keys = [];
    }

    this.blobService.listBlobsSegmentedWithPrefix(this.container, prefix, currentToken, (err, result, response) => {
      if (err) {
        return callback(new Error(err.name));
      }
      if (response.isSuccessful) {
        result.entries.forEach((d) => {
          keys.push(new Key(d.name.slice(this.path.length), false));
        });

        if (result.continuationToken) {
          return this.listKeys(prefix, result.continuationToken, keys, callback);
        }
      }

      callback(err, keys);
    });
  }

  /**
   * Returns an iterator for fetching objects from azure by their key
   * @param keys
   * @param keysOnly Whether or not only keys should be returned
   */
  private getBlobIterator (keys: any, keysOnly: boolean): any {
    let count: number = 0;

    return {
      next: (callback: any) => {
        if (count >= keys.length) {
          return callback(null, null, null);
        }
        let currentKey = keys[count++];
        if (keysOnly) {
          return callback(null, currentKey, null);
        }
        this.get(currentKey, (err: any, data: any) => {
          callback(err, currentKey, data);
        });
      }
    };
  }

  /**
   * Store the given value under the key.
   * @param key
   * @param val
   * @param callback
   */
  public put (key: any, val: Buffer, callback: any): void {
    this.blobService.createBlockBlobFromText(this.container, this.getFullKey(key), val, (err, _result, _response) => {
      if (err) {
        return callback(Errors.dbWriteFailedError(err));
      }
      callback();
    });
  }

  /**
   * Read content from azure blob storage.
   * @param key
   * @param callback
   */
  public get (key: any, callback: any): void {
    let writeStream: WritableMemoryStream = new WritableMemoryStream();

    writeStream.on('finish', () => {
      callback(null, writeStream.fetchData());
    });

    this.blobService.getBlobToStream(this.container, this.getFullKey(key), writeStream, (err, _result, _response) => {
      if (err && err.message === 'NotFound') {
        return callback(Errors.notFoundError(err));
      } else if (err) {
        return callback(err);
      }
    });
  }

  /**
   * Check for the existence of the given key.
   * @param key
   * @param callback
   */
  public has (key: any, callback: any): void {
    this.blobService.doesBlobExist(this.container, this.getFullKey(key), (err, result, _response) => {
      if (err) {
        callback(err, false);
      } else if (result && result.exists) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    });
  }

  /**
   * Delete the record under the given key.
   * @param key
   * @param callback
   */
  public delete (key: any, callback: any): void {
    this.blobService.deleteBlobIfExists(this.container, this.getFullKey(key), (err, _result, _response) => {
      if (err) {
        return callback(Errors.dbDeleteFailedError(err));
      }
      callback();
    });
  }

  /**
   * Creates a new batch object
   */
  public batch (): any {
    let puts = [
      {
        key: '',
        value: Buffer.from('')
      }];
    let deletes: any = [];
    return {
      put (key: any, value: any): void {
        puts.push({ key: key, value: value });
      },
      delete (key: any): void {
        deletes.push(key);
      },
      commit: (callback: any) => {
        waterfall([
          (cb: any) => each(puts, (p: any, _cb: any) => {
            this.put(p.key, p.value, _cb);
          }, cb),
          (cb: any) => each(deletes, (key: any, _cb: any) => {
            this.delete(key, _cb);
          }, cb)
        ], (err: any) => callback(err));
      }
    };
  }

  /**
   * Query the azure blob storage
   * @param q
   */
  public query (q: any): any {
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

    this.listKeys(prefix, null, [], (err: any, keys: any) => {
      if (err) {
        return deferred.abort(err);
      }

      iterator = this.getBlobIterator(keys, q.keysOnly || false);
      deferred.resolve(rawStream);
    });

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
  public open (callback: any): void {
    this.blobService.doesBlobExist(this.container, this.path, (err, _result, response) => {
      if (err) {
        return callback(Errors.dbOpenFailedError(err));
      }
      if (response.statusCode === 404) {
        return this.put(new Key('/', false), Buffer.from(''), callback);
      }

      callback();
    });
  }

  /**
   * Close the store.
   * @param callback
   */
  public close (callback: any): void {
    setImmediate(callback);
  }
}
