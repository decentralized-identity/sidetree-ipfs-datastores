/**
 * Data store lock interface
 */
export interface ILock {

  /**
   * lock the lock
   * @param dir the directory to lock
   */
  lock (dir: string): Promise<any>;

  /**
   * check if a directory is locked
   * @param dir the directory to check
   */
  locked (dir: string): Promise<boolean>;
}
