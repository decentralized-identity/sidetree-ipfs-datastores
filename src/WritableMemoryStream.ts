const util = require('util');
const stream = require('stream');
const Writable = stream.Writable;

/**
 * Writable Memory stream class
 */
export default class WritableMemoryStream extends Writable {
  /** InMem map to store stream data */
  public memStore: {[key: string]: Buffer} = {};

  private key: string;

  /**
   * Constructor to initialize the memory stream
   * @param key Unique key to identify data.
   * @param options Other options for the writable stream.
   */
  public constructor (key: string, options?: any) {
    super();

    Writable.call(this, options);
    this.key = key;
    this.memStore[key] = Buffer.from('');
  }
}

/**
 * Overwrite write method of the parent class to write to inmem store.
 */
WritableMemoryStream.prototype._write = function (chunk: string, enc: string, cb) {
  let buffer = (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
  this.memStore[this.key] = Buffer.concat([this.memStore[this.key], buffer]);
  cb();
};
