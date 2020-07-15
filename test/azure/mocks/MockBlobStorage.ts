const standin = require('stand-in');

class BlobStorageError extends Error {
  /** Error code. */
  public code:any;
  /** Error status code. */
  public statusCode:any;
  constructor (message:any, code:any) {
    super(message);
    this.code = message;
    this.statusCode = code;
  }
}

/**
 * Mocks out the azure blob storage calls made by datastore-azure
 * @param {blobService} blobService
 * @returns {void}
 */
module.exports = (blobService:any) => {
  const mocks: any = {};
  const storage: any = {};

  mocks.deleteContainerIfExists = standin.replace(blobService, 'deleteContainerIfExists', (_stand:any, key:any, callback:any) => {
    if (storage[key]) {
      delete storage[key];
      callback(null, {});
    } else {
      callback(new BlobStorageError('NotFound', 404), null);
    }
  });

  mocks.getBlobToText = standin.replace(blobService, 'getBlobToText', (_stand:any, _name:any, key:any, _options:any, callback:any) => {
    if (storage[key]) {
      callback(null, { Body: storage[key] });
    } else {
      callback(new BlobStorageError('NotFound', 404), null);
    }
  });

  mocks.doesBlobExist = standin.replace(blobService, 'doesBlobExist', (_standin:any, _name:any, key:any, callback:any) => {
    if (storage[key]) {
      callback(null, {});
    } else {
      callback(new BlobStorageError('NotFound', 404), null);
    }
  });

  mocks.listBlobsSegmentedWithPrefix = standin.replace(blobService, 'listBlobsSegmentedWithPrefix', (_standin:any, _name:any, prefix:any, _token:any, callback:any) => {
    const content: any[] = []
    const results = {
      Contents: content 
    };

    for (let k in storage) {
      if (k.startsWith(prefix)) {
        results.Contents.push({
          Key: k
        });
      }
    }

    callback(null, results);
  });

  mocks.createBlockBlobFromText = standin.replace(blobService, 'createBlockBlobFromText', (_stand:any, _name:any, key:any, value:any, callback:any) => {
    storage[key] = value;
    callback(null);
  });
};
