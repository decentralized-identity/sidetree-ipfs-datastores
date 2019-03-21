const util = require('util');
const stream = require('stream');
const Writable = stream.Writable;

export default class WMStream extends Writable 
{
  _write: any;
  public memStore: any = {};
  private key: string;
  
  public constructor(key: string, options?: any)
  {
    super();
    if (!(this instanceof WMStream)) {
      return new WMStream(key, options);
    }

    Writable.call(this, options);
    this.key = key;
    this.memStore[key] = new Buffer('');
  }
}

util.inherits(WMStream, Writable);
WMStream.prototype._write = function (chunk, enc, cb) {
  var buffer = (Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk, enc));
  this.memStore[this.key] = Buffer.concat([this.memStore[this.key], buffer]);
  cb();
}