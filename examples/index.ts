if (process.env["NODE_ENV"] !== 'production') {
    require('dotenv').load();
}

import * as storage from 'azure-storage';
const IPFS = require('ipfs')
const Repo = require('ipfs-repo')
const datastore = require('datastore-azure');
const AzureDataStore = datastore.AzureDataStore;
const BlobLock = require('./blobLock')

// Create blobService
let blobService = storage.createBlobService();
const containerName = "ipfscontainer";
const path = "/tmp/test/.ipfs";

// Create container
blobService.createContainerIfNotExists(containerName, err => {
    if (err) {
        console.log('Error creating container');
    }
    else 
    {
        let opts = {
            blob: blobService,
            containerName: containerName,
            createIfMissing: true
        };
        const blobStore = new AzureDataStore(path, opts);
        const blobLock = new BlobLock(blobStore);

        // Create the IPFS repo, backed by Azure blob storage
        const repo = new Repo('/tmp/test/.ipfs', {
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
                    return node.files.add({
                        path: 'data.txt',
                        content: Buffer.from(require('crypto').randomBytes(1024 * 25))
                    });
                })
                // Log out the added files metadata and cat the file from IPFS
                .then((filesAdded: any) => {
                    console.log('\nAdded file:', filesAdded[0].path, filesAdded[0].hash);
                    return node.files.cat(filesAdded[0].hash);
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
        })
    }
})