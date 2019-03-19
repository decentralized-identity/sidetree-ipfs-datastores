const standin = require('stand-in');

class BlobStorageError extends Error {
  private code;
  private statusCode;
  constructor (message, code) {
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
module.exports = (blobService) => {
  const mocks: any = {};
  const storage: any = {};

  mocks.deleteContainerIfExists = standin.replace(blobService, 'deleteContainerIfExists', (stand, key, callback) => {
    if (storage[key]) {
      delete storage[key];
      callback(null, {});
    } else {
      callback(new BlobStorageError('NotFound', 404), null);
    }
  });

  mocks.getBlobToText = standin.replace(blobService, 'getBlobToText', (stand, name, key, options, callback) => {
    if (storage[key]) {
      callback(null, { Body: storage[key] });
    } else {
      callback(new BlobStorageError('NotFound', 404), null);
    }
  });

  mocks.doesBlobExist = standin.replace(blobService, 'doesBlobExist', (standin, name, key, callback) => {
    if (storage[key]) {
      callback(null, {});
    } else {
      callback(new BlobStorageError('NotFound', 404), null);
    }
  });

  mocks.listBlobsSegmentedWithPrefix = standin.replace(blobService, 'listBlobsSegmentedWithPrefix', (standin, name, prefix, token, callback) => {
    const results = {
      Contents: []
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

  mocks.createBlockBlobFromText = standin.replace(blobService, 'createBlockBlobFromText', (stand, name, key, value, callback) => {
    storage[key] = value;
    callback(null);
  });
};
