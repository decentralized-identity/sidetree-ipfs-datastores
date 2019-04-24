/**
 * Mock Lock class to be used for creating IPFS repo.
 */
export default class MockLock {

  /**
   * Returns the lock file path name
   */
  private getLockFilePath (): void {
    return;
  }

  /**
   * Creates the lock.
   * @param dir {string} Path to the folder where to create lock.
   * @param callback {Function(Error, LockCloser)}
   */
  public lock (_, callback: any): void {
    callback(null, this.getCloser(_));
  }

  /**
   * Returns a LockCloser, which has a `close` method for rmeoving the lock located at `lockPath`
   * @param lockPath {string} Path to repo lock.
   */
  public getCloser (_) {
    return {
      close: (cb) => {
        cb();
      }
    };
  }

  /**
   * Checks whether or not a lock exists.
   * @param dir {string} LockFile path
   * @param callback {Function(Error, boolean)}
   */
  public locked (_, callback: any): void {
    callback(null, false);
  }
}
