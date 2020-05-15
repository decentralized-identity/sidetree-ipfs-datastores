/**
 * an interface for data store to implement. This is the same interface as interface-datastore, 
 * we have this because at the moment on this implementation, the type definition in the library is no working
 */
export default interface IDataStore {
  /**
   * Query function to query values in the data store
   */
  query (q: any): any;

  /**
   * Batch function to perform multiple get and put
   */
  batch (): any;

  /**
   * Puts a new key value pair into the data store
   * @param key the key to put in
   * @param val the value to put in
   */
  put (key: any, val: Buffer): Promise<void>;

  /**
   * Gets a value from the data store
   * @param key the key to get and the return the value of
   */
  get (key: any): Promise<any>;

  /**
   * Check if the data store has a given key
   * @param key the key to search for
   */
  has (key: any): Promise<boolean>;

  /**
   * Delete the given key
   * @param key the key to delete
   */
  delete (key: any): Promise<void>;

  /**
   * open connection to a data store
   */
  open (): Promise<void>;

  /**
   * close connection to a datastore
   */
  close (): Promise<void>;
}