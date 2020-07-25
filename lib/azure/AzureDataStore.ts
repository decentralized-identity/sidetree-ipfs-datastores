import * as storage from 'azure-storage';
import * as path from 'upath';
import IDataStore from './interfaces/IDataStore';
import WritableMemoryStream from './WritableMemoryStream';

const interfaceDatastore = require('interface-datastore');
const Adapter = interfaceDatastore.Adapter;
const Key = interfaceDatastore.Key;
const Errors = interfaceDatastore.Errors;

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
 * Azure data store class that implements interface-datastore's adapter
 */
export default class AzureDataStore extends Adapter implements IDataStore {
  private path: string;
  private blobService: storage.BlobService;
  private container: string;

  /**
   * Constructor to initialize the class
   * @param path path to azure blob storage container
   * @param opts Azure DS input options
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
   * @param key The key to get the full path for
   */
  private getFullKey (key: any): string {
    return path.join('.', this.path, key.toString());
  }

  /**
   * Fetches keys from storage
   * @param prefix The prefix to filter for
   * @param currentToken The current token to know where in the index to start
   * @return an object containing continuation token indicating there are more keys to retrieve, and a list of keys
   */
  private async listKeys (prefix: string, currentToken: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.blobService.listBlobsSegmentedWithPrefix(this.container, prefix, currentToken, async (err, result, response) => {
        if (err) {
          reject(new Error(err.name));
          return;
        }
        if (response.isSuccessful) {
          const keys = [];
          result.entries.forEach((d) => {
            // Key must start with /
            // https://github.com/ipfs/interface-datastore/blob/master/src/key.js
            keys.push(new Key(`/${d.name.slice(this.path.length)}`, false));
          });

          resolve({
            keys: keys,
            continuationToken: result.continuationToken
          });
          return;
        }
      });
    });
  }

  /**
   * Query function using adapter internal implementation
   */
  public query (q: any) {
    return super.query(q);
  }

  /**
   * batch function using the adapter internal implementation
   */
  public batch () {
    return super.batch();
  }

  /**
   * returns an asyncIterator that yields all the keys and values in the store
   */
  //@ts-ignore TS6133: '_all' is declared but its value is never read. 
  private async * _all () {
    // log when this is being called so we know this is not happening too much
    console.warn('_all is being called by ipfs, this is inefficient and should not happen often');
    let continuationToken = null;
    do {
      const listKeysResult = await this.listKeys('', continuationToken);
      const keys = listKeysResult.keys;
      for (const key of keys) {
        const value = await this.get(key);
        yield { key: key, value: value };
      }
      continuationToken = listKeysResult.continuationToken;
    } while (continuationToken);
  }

  /**
   * Store the given value under the key.
   * @param key The key to put
   * @param val The value to put
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
    });

  }

  /**
   * Read content from azure blob storage.
   * @param key The key to get the value for
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
    });
  }

  /**
   * Check for the existence of the given key.
   * @param key the key to check has on
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
    });
  }

  /**
   * Delete the record under the given key.
   * @param key The key to delete
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
    });
  }

  /**
   * This will check the blob storage for container's access and existence
   */
  public async open (): Promise<void> {
    return new Promise((resolve, reject) => {
      // test if root as a key exists
      this.blobService.doesBlobExist(this.container, this.getFullKey('/'), async (err, _result, response) => {
        if (err) {
          reject(Errors.dbOpenFailedError(err));
          return;
        }
        if (response.statusCode === 404) {
          await this.put(new Key('/', false), Buffer.from(''));
        }

        console.log('Azure data store opened.');
        resolve();
      });
    });
  }

  /**
   * Close the store.
   */
  public async close (): Promise<void> {
    console.log('Azure data store closed.');
  }
}
