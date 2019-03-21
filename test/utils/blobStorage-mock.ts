const standin = require('stand-in');

class BlobStorageError extends Error {
  /** Error code. */
  public code;
  /** Error status code. */
  public statusCode;
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

  mocks.deleteContainerIfExists = standin.replace(blobService, 'deleteContainerIfExists', (_stand, key, callback) => {
    if (storage[key]) {
      delete storage[key];
      callback(null, {});
    } else {
      callback(new BlobStorageError('NotFound', 404), null);
    }
  });

  mocks.getBlobToText = standin.replace(blobService, 'getBlobToText', (_stand, _name, key, _options, callback) => {
    if (storage[key]) {
      callback(null, { Body: storage[key] });
    } else {
      callback(new BlobStorageError('NotFound', 404), null);
    }
  });

  mocks.doesBlobExist = standin.replace(blobService, 'doesBlobExist', (_standin, _name, key, callback) => {
    if (storage[key]) {
      callback(null, {});
    } else {
      callback(new BlobStorageError('NotFound', 404), null);
    }
  });

  mocks.listBlobsSegmentedWithPrefix = standin.replace(blobService, 'listBlobsSegmentedWithPrefix', (_standin, _name, prefix, _token, callback) => {
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

  mocks.createBlockBlobFromText = standin.replace(blobService, 'createBlockBlobFromText', (_stand, _name, key, value, callback) => {
    storage[key] = value;
    callback(null);
  });
};
