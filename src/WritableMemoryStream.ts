const util = require('util');
const stream = require('stream');
const Writable = stream.Writable;

/**
 * Writable Memory stream class
 */
export default class WritableMemoryStream extends Writable {
  /** variable to store stream data */
  private memStore: Buffer;

  /**
   * Constructor to initialize the memory stream
   * @param key Unique key to identify data.
   * @param options Other options for the writable stream.
   */
  public constructor (options?: any) {
    super();

    Writable.call(this, options);
    this.memStore = Buffer.from('');
  }

  /**
   * Return stored inmem stream data.
   */
  public fetchData (): Buffer {
    return this.memStore;
  }
}

/**
 * Overwrite write method of the parent class to write to inmem store.
 */
WritableMemoryStream.prototype._write = function (chunk: string, enc: string, cb) {
  let buffer = (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
  this.memStore = Buffer.concat([this.memStore, buffer]);
  cb();
};
