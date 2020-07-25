if (process.env['NODE_ENV'] !== 'production') {
  require('dotenv').load();
}
const chai = require('chai');
chai.use(require('dirty-chai'));
const Key = require('interface-datastore').Key;
import * as storage from 'azure-storage';
const standin = require('stand-in');
import { AzureDataStore } from '../../lib/index';

describe('AzureDataStore', () => {
  const containerName = 'ipfscontainer';
  let blobStore: AzureDataStore;
  let blobService: storage.BlobService;
  beforeAll(() => {
    blobService = storage.createBlobService();
    blobStore = new AzureDataStore('.ipfs/datastore', { containerName: containerName, blobService: blobService });
  });

  describe('construction', () => {
    it('blob Service is created', () => {
      blobStore.getBlobService().doesContainerExist(containerName, (err, result) => {
        expect(err).toBeNull();
        expect(result.exists).toEqual(true);
      });
    });
  });

  describe('put', () => {
    it('should include the path in the key', async (done) => {
      standin.replace(blobStore.getBlobService(), 'createBlockBlobFromText', (stand, _name, key, _value, callback) => {
        expect(key).toEqual('.ipfs/datastore/z/key');
        stand.restore();
        callback(null);
        done();
      });

      await blobStore.put(new Key('/z/key'), Buffer.from('test data'));
    });

    it('should return a standard error when the put fails', async (done) => {
      standin.replace(blobStore.getBlobService(), 'createBlockBlobFromText', (stand, _name, key, _value, callback) => {
        expect(key).toEqual('.ipfs/datastore/z/key');
        stand.restore();
        callback(new Error('bad things happened'));
      });

      try {
        await blobStore.put(new Key('/z/key'), Buffer.from('test data'));
        fail('expected to throw but did not');
      } catch (err) {
        expect(err.code).toEqual('ERR_DB_WRITE_FAILED');
        done();
      }
    });
  });

  describe('get', () => {
    it('should include the path in the fetch key', async (done) => {

      standin.replace(blobStore.getBlobService(), 'getBlobToStream', (stand, _name, key, _writeStream, callback) => {
        expect(key).toEqual('.ipfs/datastore/z/key');
        stand.restore();
        callback(null, Buffer.from('test'), { statusCode: 200 });
        done();
      });

      await blobStore.get(new Key('/z/key'));
    });

    it('should return a standard not found error code if the key is not found', async (done) => {
      standin.replace(blobStore.getBlobService(), 'getBlobToStream', (stand, _name, key, _writeStream, callback) => {
        expect(key).toEqual('.ipfs/datastore/z/key');
        stand.restore();
        let error = new Error('NotFound');
        callback(error, null, { statusCode: 404 });
      });

      try {
        await blobStore.get(new Key('/z/key'));
        fail('expected to throw but did not');
      } catch (err) {
        expect(err.code).toEqual('ERR_NOT_FOUND');
        done();
      }
    });
  });

  describe('delete', () => {
    it('should return a standard delete error if deletion fails', async (done) => {
      standin.replace(blobStore.getBlobService(), 'deleteBlobIfExists', (stand, _name, key, callback) => {
        expect(key).toEqual('.ipfs/datastore/z/key');
        stand.restore();
        callback(new Error('bad things'));
      });

      try {
        await blobStore.delete(new Key('/z/key'));
        fail('expected to throw but did not');
      } catch (err) {
        expect(err.code).toEqual('ERR_DB_DELETE_FAILED');
        done();
      }
    });
  });

  describe('has', () => {
    it('should return true if found', async () => {
      standin.replace(blobStore.getBlobService(), 'doesBlobExist', (stand, _name, _key, callback) => {
        stand.restore();
        callback(undefined, { exists: true });
      });

      const result = await blobStore.has('something');
      expect(result).toBeTruthy();
    });

    it('should return false if not found', async () => {
      standin.replace(blobStore.getBlobService(), 'doesBlobExist', (stand, _name, _key, callback) => {
        stand.restore();
        callback(undefined, { exists: false });
      });

      const result = await blobStore.has('something');
      expect(result).toBeFalsy();
    });

    it('should return false if not result', async () => {
      standin.replace(blobStore.getBlobService(), 'doesBlobExist', (stand, _name, _key, callback) => {
        stand.restore();
        callback(undefined, undefined);
      });

      const result = await blobStore.has('something');
      expect(result).toBeFalsy();
    });

    it('should throw error on error', async () => {
      standin.replace(blobStore.getBlobService(), 'doesBlobExist', (stand, _name, _key, callback) => {
        stand.restore();
        callback(new Error('error for testing'));
      });

      try {
        await blobStore.has('something');
        fail('expect to throw but did not');
      } catch (e) {
        expect(e.message).toEqual('error for testing');
      }
    });
  });

  describe('_all', () => {
    it('should return an async iterator over all keys and values', async () => {
      standin.replace(blobStore.getBlobService(), 'listBlobsSegmentedWithPrefix', (stand, _container, _prefix, currentToken, callback) => {
        if (currentToken === 'end') {
          stand.restore();
          callback(undefined, { entries: [{ name: 'ipfs/datastore/key2' }] }, { isSuccessful: true });
        } else {
          callback(undefined, { entries: [{ name: 'ipfs/datastore/key1' }], continuationToken: 'end' }, { isSuccessful: true });
        }
      });
      spyOn(blobStore, 'get').and.callFake(() => {
        return Buffer.from('value');
      });

      const results = blobStore['_all'](); // this is an iterator
      const expected = [{ key: new Key('/key1'), value: Buffer.from('value') }, { key: new Key('/key2'), value: Buffer.from('value') }];
      let indexCounter = 0;
      // tslint:disable-next-line: await-promise
      for await (const result of results) {
        expect(result).toEqual(expected[indexCounter]);
        indexCounter++;
      }
    });
  });

  describe('open', () => {
    it('should put root if 404', async (done) => {
      standin.replace(blobStore.getBlobService(), 'doesBlobExist', (stand, _name, key, callback) => {
        expect(key).toEqual('.ipfs/datastore/');
        stand.restore();
        callback(undefined, undefined, { statusCode: 404 });
      });
      const putSpy = spyOn(blobStore, 'put');

      await blobStore.open();
      expect(putSpy).toHaveBeenCalled();
      done();
    });

    it('should return a standard open error if blob exist check fails', async (done) => {
      standin.replace(blobStore.getBlobService(), 'doesBlobExist', (stand, _name, key, callback) => {
        expect(key).toEqual('.ipfs/datastore/');
        stand.restore();
        callback(new Error('unknown'));
      });

      try {
        await blobStore.open();
        fail('expected to throw but did not');
      } catch (err) {
        expect(err.code).toEqual('ERR_DB_OPEN_FAILED');
        done();
      }
    });
  });
});
