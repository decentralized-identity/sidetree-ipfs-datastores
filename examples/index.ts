if (process.env['NODE_ENV'] !== 'production') {
  require('dotenv').load();
}

import * as storage from 'azure-storage';
import { MockLock, AzureDataStore, AzureDSInputOptions } from '@decentralized-identity/sidetree-ipfs-datastores';
const ipfsRepo = require('ipfs-repo');
const IPFS = require('ipfs');

const containerName = 'ipfscontainer';
const path = '/tmp/test/.ipfs';
let blobService: storage.BlobService = storage.createBlobService();

let opts: AzureDSInputOptions = {
  containerName: containerName,
  blobService: blobService
};
// const blobStore = new AzureDataStore(path, opts);
const blobLock = new MockLock();

// Create the IPFS repo, backed by Azure blob storage
const repo = new ipfsRepo(path, {
  storageBackends: {
    root: AzureDataStore,
    blocks: AzureDataStore,
    keys: AzureDataStore,
    datastore: AzureDataStore
  },
  storageBackendOptions: {
    root: opts,
    blocks: opts,
    keys: opts,
    datastore: opts
  },
  lock: blobLock
});

// Create a new IPFS node with Azure blob storage backed Repo
let node = new IPFS({
  repo,
  config: {
    Discovery: { MDNS: { Enabled: false }, webRTCStar: { Enabled: false } },
    Bootstrap: []
  }
});

console.log('Start the node');

// Test out the repo by sending and fetching some data
node.on('ready', () => {
  console.log('Ready');
  node.version()
    .then((version: any) => {
      console.log('Version:', version.version);
    })
    // Once we have the version, let's add a file to IPFS
    .then(() => {
      return node.add({
        path: 'data.txt',
        content: Buffer.from(require('crypto').randomBytes(1024 * 25))
      });
    })
    // Log out the added files metadata and cat the file from IPFS
    .then((filesAdded: any) => {
      console.log('\nAdded file:', filesAdded[0].path, filesAdded[0].hash);
      return node.cat(filesAdded[0].hash);
    })
    // Print out the files contents to console
    .then((data: any) => {
      console.log(`\nFetched file content containing ${data.byteLength} bytes`);
    })
    // Log out the error, if there is one
    .catch((err: any) => {
      console.log('File Processing Error:', err);
    })
    // After everything is done, shut the node down
    // We don't need to worry about catching errors here
    .then(() => {
      console.log('\n\nStopping the node');
      return node.stop();
    });
});
