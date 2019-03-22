/**
 * Uses an blob object in Azure blob container as a lock to signal that an IPFS repo is in use.
 * This ensures multiple IPFS nodes doesnt use the same Azure container as a datastore at the same time.
 */
export default class BlobLock {
  private blob: any;

  constructor (blobDataStore: any) {
    this.blob = blobDataStore;
  }

  /**
   * Returns the lock file path name
   */
  private getLockFilePath (): string {
    return 'repo.lock';
  }

  /**
   * Creates the lock.
   * @param dir {string} Path to the folder where to create lock.
   * @param callback {Function(Error, LockCloser)}
   */
  public lock (dir: any, callback: any): void {
    const lockPath = this.getLockFilePath();

    this.locked(dir, (err, alreadyLocked) => {
      if (err || alreadyLocked) {
        return callback(new Error('The repo is already locked'));
      }

      this.blob.put(lockPath, Buffer.from(''), (err: any, _data: any) => {
        if (err) {
          return callback(err, null);
        }
        callback(null, this.getCloser(lockPath));
      });
    });
  }

  /**
   * Returns a LockCloser, which has a `close` method for rmeoving the lock located at `lockPath`
   * @param lockPath {string} Path to repo lock.
   */
  public getCloser (lockPath: string) {
    const closer = {
      /**
       * Removes the lock. This can be overridden to customize how the lock is removed.
       * @param callback Function(error)
       */
      close: (callback: any) => {
        this.blob.delete(lockPath, (err: any) => {
          if (err && err.statusCode !== 404) {
            return callback(err);
          }
          callback(null);
        });
      }
    };

    const cleanup = () => {
      console.log('\nAttempting to cleanup gracefully...');

      closer.close(() => {
        console.log('Cleanup complete, exiting.');
        process.exit();
      });
    };

    // Listen for graceful termination
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGHUP', cleanup);
    process.on('uncaughtException', cleanup);

    return closer;
  }

  /**
   * Checks whether or not a lock exists.
   * @param dir {string} LockFile path
   * @param callback {Function(Error, boolean)}
   */
  public locked (_dir: string, callback: (err: any, locked: boolean) => void): void {
    this.blob.get(this.getLockFilePath(), (err: any, _data: any) => {
      if (err && err.code === 'ERR_NOT_FOUND') {
        return callback(null, false);
      } else if (err) {
        return callback(err, false);
      }
      callback(null, true);
    });
  }
}
