// TODO:
//  * support 1 nested Json level
//    (see second Json example here:
//     http://www.w3.org/TR/html401/interact/forms.html#didx-Jsonform-data)
//  * support limits.fieldNameSize
//     -- this will require modifications to utils.parseParams

var RE_CHARSET = /^charset$/i;

var parseParams = require('../utils').parseParams,
    decodeText = require('../utils').decodeText,
    basename = require('../utils').basename;

Json.detect = /^application\/json/i;
function Json(boy, cfg) {
  if (!(this instanceof Json)) {
    return new Json(boy, cfg);
  }
  
  var limits = cfg.limits,
      headers = cfg.headers,
      parsedConType = cfg.parsedConType;
  
  this.boy = boy;
  
  var charset;
  for (var i = 0, len = parsedConType.length; i < len; ++i) {
    if (Array.isArray(parsedConType[i])
        && RE_CHARSET.test(parsedConType[i][0])) {
      charset = parsedConType[i][1].toLowerCase();
      break;
    }
  }

  if (charset === undefined) {
    charset = cfg.defCharset || 'utf8';
  }
  this._data = '';
};

Json.prototype.write = function(data, cb) {
  this._data += data;
  return cb();
};

Json.prototype.end = function() {
  var data;
  if (this.boy._done) {
    return;
  }
  if (this._data) {
    try {
      data = JSON.parse(this._data);
    } catch (err) {
      data = this._data;
    }
    this.boy.emit('json', data);
  }
  this.boy._done = true;
  this.boy.emit('finish');
};

module.exports = Json;