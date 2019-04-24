import * as stream from 'stream';
const Writable = stream.Writable;

/**
 * Writable Memory stream class
 */
export default class WritableMemoryStream extends Writable {
  /** variable to store stream data */
  private memStore: Buffer[];

  /**
   * Constructor to initialize the memory stream
   * @param options Other options for the writable stream.
   */
  public constructor (options?: stream.WritableOptions) {
    super();

    Writable.call(this, options);
    this.memStore = [];
  }

  /**
   * Returns stored inmem stream data.
   */
  public fetchData (): Buffer {
    return Buffer.concat(this.memStore);
  }

  /**
   * Overwrite write method of the parent class to write to inmem store.
   * @param chunk Data chunk to store.
   * @param encoding Encoding format.
   * @param cb Function to call after storing data.
   */
  public _write (chunk: string | Buffer, encoding: string, cb: (error?: Error | null) => void): void {
    let buffer: Buffer = (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    this.memStore.push(buffer);
    cb();
  }
}
