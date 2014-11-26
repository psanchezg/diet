/*jslint node: true, plusplus: true, regexp: true, nomen: true  */
'use strict';

var Decoder = require('../utils').Decoder,
    decodeText = require('../utils').decodeText;

var RE_CHARSET = /^charset$/i;

var parseParams = require('../utils').parseParams,
    decodeText = require('../utils').decodeText,
    basename = require('../utils').basename;

var Csv = function (boy, cfg) {
    if (!(this instanceof Csv)) {
        return new Csv(boy, cfg);
    }
  
    var limits = cfg.limits,
        headers = cfg.headers,
        parsedConType = cfg.parsedConType,
        charset,
        i,
        len;
  
    this.boy = boy;

    for (i = 0, len = parsedConType.length; i < len; ++i) {
        if (Array.isArray(parsedConType[i])
                && RE_CHARSET.test(parsedConType[i][0])) {
            charset = parsedConType[i][1].toLowerCase();
            break;
        }
    }
    if (charset === undefined) {
        charset = cfg.defCharset || 'utf8';
    }
    this.decoder = new Decoder();
    this.charset = charset;
    this._fields = 0;
    this._state = 'record';
    this._checkingBytes = true;
    this._key = '';
    this._val = '';
};

Csv.detect = /^text\/csv/i;

Csv.prototype.write = function (data, cb) {
    var idxeq, idxamp, i, p = 0, len = data.length;
    while (p < len) {
        if (this._state === 'record') {
            idxeq = idxamp = undefined;
            for (i = p; i < len; ++i) {
                if (!this._checkingBytes) {
                    ++p;
                }
                if (data[i] === 0x2C) { /*,*/
                    idxeq = i;
                    break;
                } else if (data[i] === 0x0A) { /*LF*/
                    idxamp = i;
                    break;
                }
            }
            if (idxeq !== undefined) {
                // key with assignment
                if (idxeq > p) {
                    this._key += this.decoder.write(data.toString('binary', p, idxeq));
                }
                this._state = 'val';
                this._checkingBytes = true;
                this._val = '';
                p = idxeq + 1;
            } else if (idxamp !== undefined) {
                ++this._fields;
                p = idxamp + 1;
            } else {
                if (p < len) {
                    this._key += this.decoder.write(data.toString('binary', p));
                }
                p = len;
            }
          
        } else {
            for (i = p; i < len; ++i) {
                if (!this._checkingBytes) {
                    ++p;
                }
                if (data[i] === 0x0A) { /*LF*/
                    idxamp = i;
                    break;
                }
            }
            if (i === len) { /*last value without LF*/
                idxamp = i;
            }
            if (idxamp !== undefined) {
                ++this._fields;
                if (idxamp > p) {
                    this._val += this.decoder.write(data.toString('binary', p, idxamp));
                    this.boy.emit('field',
                            decodeText(this._key, 'binary', this.charset),
                            decodeText(this._val, 'binary', this.charset),
                            this._keyTrunc,
                            this._valTrunc);
                }
            }
            this._state = 'record';
            this._key = '';
            this._checkingBytes = true;
            this.decoder.reset();
            p = idxamp + 1;
        }
    }
    return cb();
};

Csv.prototype.end = function () {
    var data;
    if (this.boy._done) {
        return;
    }
    this.boy._done = true;
    this.boy.emit('finish');
};

module.exports = Csv;