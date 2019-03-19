if (process.env["NODE_ENV"] !== 'production') {
    require('dotenv').load();
}
const chai = require('chai');
chai.use(require('dirty-chai'));
const Key = require('interface-datastore').Key;
import * as storage from 'azure-storage';
const blobServiceMock = require('./utils/blobStorage-mock');
var fs = require('fs');
const standin = require('stand-in');
import { AzureDataStore } from '../src/index';
import { write } from 'fs';

describe('AzureDataStore', () => {
  const blobService = storage.createBlobService();
  const containerName = 'ipfscontainer';
  blobService.createContainerIfNotExists(containerName, err => {
    if (err) {
      console.log('Error creating container');
    }
  });
  describe('construction', () => {
    it('createIfMissing defaults to false', () => {
      blobService.createContainerIfNotExists(containerName, err => {
        if (err) {
          console.log('Error creating container');
        } else {
          const blobStore = new AzureDataStore('.ipfs/datastore', { blob: blobService, containerName: containerName });
          expect(blobStore.createIfMissing).toBe(false);
        }
      });
    });
    it('createIfMissing can be set to true', () => {
      blobService.createContainerIfNotExists(containerName, err => {
        if (err) {
          console.log('Error creating container');
        } else {
          const blobStore = new AzureDataStore('.ipfs/datastore', { blob: blobService, containerName: containerName, createIfMissing: true });
          expect(blobStore.createIfMissing).toBe(true);
        }
      });
    });
  });

  describe('put', () => {
    it('should include the path in the key', (done) => {
      blobService.createContainerIfNotExists(containerName, err => {
        if (err) {
          console.log('Error creating container');
        } else {
          const blobStore = new AzureDataStore('.ipfs/datastore', { blob: blobService, containerName: containerName });

          standin.replace(blobService, 'createBlockBlobFromText', (stand, name, key, value, callback) => {
            expect(key).toEqual('.ipfs/datastore/z/key');
            stand.restore();
            callback(null);
          });

          blobStore.put(new Key('/z/key'), Buffer.from('test data'), done);
        }
      });
    });
    it('should return a standard error when the put fails', (done) => {
      blobService.createContainerIfNotExists(containerName, err => {
        if (err) {
          console.log('Error creating container');
        } else {
          const blobStore = new AzureDataStore('.ipfs/datastore', { blob: blobService, containerName: containerName });

          standin.replace(blobService, 'createBlockBlobFromText', (stand, name, key, value, callback) => {
            expect(key).toEqual('.ipfs/datastore/z/key');
            stand.restore();
            callback(new Error('bad things happened'));
          });

          blobStore.put(new Key('/z/key'), Buffer.from('test data'), (err) => {
            expect(err.code).toEqual('ERR_DB_WRITE_FAILED');
            done();
          });
        }
      });
    });
  });

  describe('get', () => {
    it('should include the path in the fetch key', (done) => {
      blobService.createContainerIfNotExists(containerName, err => {
        if (err) {
          console.log('Error creating container');
        } else {
          var writeStream = fs.createWriteStream('azureBlob.txt');
          const blobStore = new AzureDataStore('.ipfs/datastore', { blob: blobService, containerName: containerName });

          standin.replace(blobService, 'getBlobToStream', (stand, name, key, writeStream, callback) => {
            expect(key).toEqual('.ipfs/datastore/z/key');
            stand.restore();
            callback(null, Buffer.from('test'), { statusCode: 200 });
            writeStream.close();
          });

          blobStore.get(new Key('/z/key'), done);
        }
      });
    });
    it('should return a standard not found error code if the key isnt found', (done) => {
      blobService.createContainerIfNotExists(containerName, err => {
        if (err) {
          console.log('Error creating container');
        } else {
          const blobStore = new AzureDataStore('.ipfs/datastore', { blob: blobService, containerName: containerName });

          standin.replace(blobService, 'getBlobToStream', (stand, name, key, writeStream, callback) => {
            expect(key).toEqual('.ipfs/datastore/z/key');
            stand.restore();
            let error = new Error('NotFound');
            callback(error, null, { statusCode: 404 });
          });

          blobStore.get(new Key('/z/key'), (err) => {
            expect(err.code).toEqual('ERR_NOT_FOUND');
            done();
          });
        }
      });
    });
  });

  describe('delete', () => {
    it('should return a standard delete error if deletion fails', (done) => {
      blobService.createContainerIfNotExists(containerName, err => {
        if (err) {
          console.log('Error creating container');
        } else {
          const blobStore = new AzureDataStore('.ipfs/datastore', { blob: blobService, containerName: containerName });

          standin.replace(blobService, 'deleteBlobIfExists', (stand, name, key, callback) => {
            expect(key).toEqual('.ipfs/datastore/z/key');
            stand.restore();
            callback(new Error('bad things'));
          });

          blobStore.delete(new Key('/z/key'), (err) => {
            expect(err.code).toEqual('ERR_DB_DELETE_FAILED');
            done();
          });
        }
      });
    });
  });

  describe('open', () => {
    it('should return a standard open error if blob exist check fails', (done) => {
      blobService.createContainerIfNotExists(containerName, err => {
        if (err) {
          console.log('Error creating container');
        } else {
          const blobStore = new AzureDataStore('.ipfs/datastore', { blob: blobService, containerName: containerName });

          standin.replace(blobService, 'doesBlobExist', (stand, name, key, callback) => {
            stand.restore();
            callback(new Error('unknown'));
          });

          blobStore.open((err) => {
            expect(err.code).toEqual('ERR_DB_OPEN_FAILED');
            done();
          });
        }
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
