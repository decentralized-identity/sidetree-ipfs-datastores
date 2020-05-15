import { ILock } from './interfaces/ILock';

/**
 * Mock Lock class to be used for creating IPFS repo.
 */
export default class MockLock implements ILock {

  /**
   * Creates the lock.
   * @param dir {string} Path to the folder where to create lock.
   */
  public lock (dir: string): any {
    console.log(`lock was called on ${dir}`);
    return this.getCloser();
  }

  /**
   * Returns a LockCloser, which has a `close` method for rmeoving the lock located at `lockPath`
   */
  public getCloser () {
    return {
      close: () => { console.log('lock closed'); }
    };
  }

  /**
   * Checks whether or not a lock exists.
   * @param dir {string} LockFile path
   */
  public locked (dir: string): Promise<boolean> {
    console.log(` ${dir} is not locked`);
    return new Promise((resolve) => {
      resolve(false);
    });
  }
}
