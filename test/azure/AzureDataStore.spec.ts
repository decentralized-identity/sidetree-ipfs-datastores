if (process.env['NODE_ENV'] !== 'production') {
  require('dotenv').load();
}
const chai = require('chai');
chai.use(require('dirty-chai'));
const Key = require('interface-datastore').Key;
import * as storage from 'azure-storage';
const blobServiceMock = require('./mocks/MockBlobStorage');
const standin = require('stand-in');
import { AzureDataStore } from '../../lib/index';
import WritableMemoryStream from '../../lib/azure/WritableMemoryStream';

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
      let writeStream = new WritableMemoryStream();

      standin.replace(blobStore.getBlobService(), 'getBlobToStream', (stand, _name, key, writeStream, callback) => {
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

  describe('open', () => {
    it('should return a standard open error if blob exist check fails', async (done) => {
      standin.replace(blobStore.getBlobService(), 'doesBlobExist', (stand, _name, _key, callback) => {
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
