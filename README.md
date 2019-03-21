# sidetree-ipfs-datastores
Implementations of IPFS datastore used by sidetree-ipfs microservice.

Running an example IPFS node that uses a datastore implementation:
1. Build the IPFS datastore implementations:
   1. `npm i`
   1. `npm run build`
1. Build the example:
   1. `cd ./examples`
   1. `npm i`
   1. `npm run build`
1. Run the example:
   1. Replace the storage connection string in the .env file located in the root folder.
   1. `node dist/index.js` from the `examples` folder.
