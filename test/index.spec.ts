if (process.env['NODE_ENV'] !== 'production') {
  require('dotenv').load();
}
const chai = require('chai');
chai.use(require('dirty-chai'));
const Key = require('interface-datastore').Key;
const standin = require('stand-in');
import { AzureDataStore } from '../src/index';
import * as storage from 'azure-storage';
import WritableMemoryStream from '../src/WritableMemoryStream';

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
    it('should include the path in the key', (done) => {
      standin.replace(blobStore.getBlobService(), 'createBlockBlobFromText', (stand, _name, key, _value, callback) => {
        expect(key).toEqual('.ipfs/datastore/z/key');
        stand.restore();
        callback(null);
      });

      blobStore.put(new Key('/z/key'), Buffer.from('test data'), done);
    });

    it('should return a standard error when the put fails', (done) => {
      standin.replace(blobStore.getBlobService(), 'createBlockBlobFromText', (stand, _name, key, _value, callback) => {
        expect(key).toEqual('.ipfs/datastore/z/key');
        stand.restore();
        callback(new Error('bad things happened'));
      });

      blobStore.put(new Key('/z/key'), Buffer.from('test data'), (err) => {
        expect(err.code).toEqual('ERR_DB_WRITE_FAILED');
        done();
      });
    });
  });

  describe('get', () => {
    it('should include the path in the fetch key', (done) => {
      let writeStream = new WritableMemoryStream();

      standin.replace(blobStore.getBlobService(), 'getBlobToStream', (stand, _name, key, writeStream, callback) => {
        expect(key).toEqual('.ipfs/datastore/z/key');
        stand.restore();
        callback(null, Buffer.from('test'), { statusCode: 200 });
        done();
      });

      blobStore.get(new Key('/z/key'), done);
    });

    it('should return a standard not found error code if the key isnt found', (done) => {
      standin.replace(blobStore.getBlobService(), 'getBlobToStream', (stand, _name, key, _writeStream, callback) => {
        expect(key).toEqual('.ipfs/datastore/z/key');
        stand.restore();
        let error = new Error('NotFound');
        callback(error, null, { statusCode: 404 });
      });

      blobStore.get(new Key('/z/key'), (err) => {
        expect(err.code).toEqual('ERR_NOT_FOUND');
        done();
      });
    });
  });

  describe('delete', () => {
    it('should return a standard delete error if deletion fails', (done) => {
      standin.replace(blobStore.getBlobService(), 'deleteBlobIfExists', (stand, _name, key, callback) => {
        expect(key).toEqual('.ipfs/datastore/z/key');
        stand.restore();
        callback(new Error('bad things'));
      });

      blobStore.delete(new Key('/z/key'), (err) => {
        expect(err.code).toEqual('ERR_DB_DELETE_FAILED');
        done();
      });
    });
  });

  describe('open', () => {
    it('should return a standard open error if blob exist check fails', (done) => {
      standin.replace(blobStore.getBlobService(), 'doesBlobExist', (stand, _name, _key, callback) => {
        stand.restore();
        callback(new Error('unknown'));
      });

      blobStore.open((err) => {
        expect(err.code).toEqual('ERR_DB_OPEN_FAILED');
        done();
      });
    });
  });

//   describe('interface-datastore', () => {
//     require('interface-datastore/src/tests')({
//       setup (callback) {
//         blobService.createContainerIfNotExists(containerName, err => {
//           if (err) {
//             console.log('Error creating container');
//           } else {
//             blobServiceMock(blobService);
//             callback(null, new AzureDataStore('.ipfs/datastore', { blob: blobService, containerName: containerName }));
//           }
//         });
//       },
//       teardown (callback) {
//         callback(null);
//       }
//     });
//   });
});
