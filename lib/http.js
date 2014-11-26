/*
Copyright (c) 2014 Halász Ádám

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/*jslint node: true, plusplus: true, regexp: true  */
'use strict';

// Isset
var isset = function (object) {
    return (object !== "undefined" && object !== undefined && object !== null && object !== "" && typeof object !== 'undefined') ? true : false;
};

// Dependencies
var http = require('http');
var https = require('https');
var url = require('url');
var pathjs = require('path');
var Next = require('nextjs');
var fs = require('fs');
var colors = require('colors');
var os = require('os');
var Domain = require('domain');

var proxy; // Global var
var options; // Global var
    
// Busboy form parser
var Busboy = require('../vendor/busboy/lib/main');
var mkdirp = require('mkdirp');
var crypto = require('crypto');
var path = require('path');
var qs = require('../vendor/qs');

var rename = function (fieldname, filename) {
    var random_string = fieldname + filename + Date.now() + Math.random();
    return crypto.createHash('md5').update(random_string).digest('hex');
};

var setParams = function (route, signal, match_found) {
    var i, param, route_keys_length = route.keys.length;
    for (i = 0; i < route_keys_length; i++) {
        param = route.keys[i];
        signal.params[param.name] = (match_found[i + 1] ? decodeURIComponent(match_found[i + 1]) : undefined);
    }
};

var getRoute = function (route, signal) {
    var match_found = route.regex.exec(signal.url.pathname);
    if (match_found) {
        setParams(route, signal, match_found);
        return route;
    }
    return false;
};

var displayError = function (signal, error, plugin, route) {
    signal.status(500, 'Internal Server Error');
	
    var stack = error.stack.split('\n').splice(1).join('\n'),
        routeMessage = '',
        errorMessage = '<h2 style="font-weight:normal;margin: 15px 0 13px 0;line-height: 14px;font-size: 14px;color: #E42616;"><span style="color: #FFFFFF;background: #EC5C50;padding: 2px 8px;border-radius: 3px;font-size: 12px;font-weight: bold;font-family: sans-serif;float: left;margin-top: -2px;margin-right: 9px;box-shadow: inset 0 1px 1px rgba(0,0,0,.25);">' + error.name + '</span> ' + error.message + '</h2>';
    if (route && route.path) {
        routeMessage = 'at Route (' + signal.method + ' ' +  route.path + ') \n';
    }
	
    if (signal.header('x-requested-with') !== 'XMLHttpRequest') {
        signal.header('content-type', 'text/html');
        signal.end('<!doctype html/><html><head><title>500 Internal Server Error</title><style>body{font-family: monaco, monospace, "Lucida Console"; }</style></head><body><h1 style="font-weight:lighter;font-size: 18px;margin: 25px 25px 10px 25px;color: #BDBDBD;">500 Internal Server Error</h1><div style="font-size:13px; line-height:18px; padding: 0 25px;">' +
            '<div style="clear:both;">' +
            errorMessage +
            (routeMessage + stack)
            .replace(/</gi, '&lt;')
            .replace(/\>/gi, '&gt;')
            .replace(/at\s([^\(\)]+)((:[0-9]+))/gi, '<span style="color:#B6B6B6; font-size:12px;">at</span> <span style="color:#575FB6;">$1$2</span>')
            .replace(/at\s([^\(\)]+)\s/gi, '<span style="color:#B6B6B6; font-size:12px;">at</span> <span style="color:#575FB6;">$1</span> ')
            .replace(/\n/gi, '<div class="newLine" style="margin:1px 0;"> </div>')
            .replace(/\s\s\s\s/gi, '<div style="margin-left:30px; float:left; height:18px; clear:both;"> </div>').replace(/\(([^\)]+)\)/gi, '<span style="color:#E2E2E2;">(</span><span style="color:#007F1F;">"$1"</span><span style="color:#E2E2E2;">)</span>') +
                    '</div></div></body></html>');
    } else {
        signal.header('content-type', 'text/plain');
        signal.end(error.stack);
    }
};

var Context = function (plugin, signal, callback) {
    var setJsonData,
        context,
        envelopeCallback;

    envelopeCallback = function (cb) {
        cb = cb || signal.query.callback;
        if (cb) {
            cb = "/**/ typeof " + cb + " === 'function' && " + cb + '(%s)';
            signal.header('content-type', 'application/javascript; charset=utf-8');
        } else {
            signal.header('content-type', 'application/json; charset=utf-8');
        }
        return cb || '%s';
    };

    setJsonData = function (data, input) {
        input = (isset(input) ? input : {});
        if (Object.isArray(input)) {
            data.mergeAsResult = input;
            input = {};
        }
        data = Object.merge(data, input);
        var keys = Object.keys(data);
        if (keys.length === 1 && keys[0] === 'mergeAsResult') {
            data = data.mergeAsResult;
        }
        return data;
    };

    context = Object.merge(signal, {
        // return
        'return' : function (plugin_return) {
            var plugin_name = plugin.options && plugin.options.alias ?
				    plugin.options.alias
                : plugin.argumentName;
            if (plugin_return) {
                signal[plugin_name] = plugin_return;
            }
            signal.progress(callback);
        },

        // redirect
        redirect : function () {
            signal.redirectResponse.apply(this, arguments);
            signal.progress(callback);
        },

        // ending message
        end : function (message, statusCode) {
            if (statusCode) {
                signal.status(statusCode);
            }
            if (message) {
                signal.message += message;
            }
            if (!signal.message) {
                signal.message = '';
            }
            // TODO (psanchezg@gmail.com): comprobar
            if (signal.passed === false || signal.data.passed === false) {
                signal.respond();
            } else {
                signal.progress(callback);
            }
        },

        // append to message
        send : function (message) {
            signal.message += message;
        },

        // respond with json success
        success : function (input, status, cb) {
            // REST:
            // POST ok: 201 (Created)
            // PUT ok: 200 (Updated) or 201 (Created) Manual set
            // GET/DELETE ok: 200 (OK)
            signal.status(status || 200 + (signal.method === 'POST' ? 1 : 0));
            var data = signal.data;
            data.passed = true;
            context.end(envelopeCallback(cb).replace('%s', JSON.stringify(setJsonData(data, input))));
            signal.progress(callback);
        },

        // respond with json error
        error : function (status, errors, cb) {
            signal.status(status || 500);
            signal.data.passed = false;
            signal.errors = Object.merge(signal.errors, errors);
            context.end(envelopeCallback(cb).replace('%s', JSON.stringify({passed: false, errors: signal.errors})));
            signal.progress(callback);
        },

        // respond with json signal data
        json : function (input, status, cb) {
            if (!signal.passed) {
                signal.status(401);
                context.end(envelopeCallback(cb).replace('%s', JSON.stringify({passed: false, errors: setJsonData(signal.errors, input)})));
            } else {
                signal.status(status || 200 + (signal.method === 'POST' ? 1 : 0));
                context.end(envelopeCallback(cb).replace('%s', JSON.stringify(setJsonData(signal.data, input))));
            }
            signal.progress(callback);
        }

    });
    return context;
};

var httpHandler = function (request, response, $, http_type) {
    // Create Signal Method
    var signal = {},
        domain,
        methodRoutes,
        route,
        index,
        patch_plugin,
        all_plugins = [],
        content_type,
        multipart,
        notFound,
        afterBody,
        readFinished,
        fileCount,
        busboy,
        file,
        ws,
        onFinish;

    onFinish = function () {
        var field;
        if (!readFinished || fileCount > 0) { return; }

        for (field in signal.files) {
            if (signal.files.hasOwnProperty(field)) {
                if (signal.files[field].length === 1) {
                    signal.files[field] = signal.files[field][0];
                }
            }
        }
        // Parse the body and create a best structure
        if (signal.body) {
            signal.body = signal.qs.parse(signal.body);
        }

        // when done parsing the form, pass the control to the next middleware in stack
        afterBody();
    };
    
    patch_plugin = function (ID, callback) {
        var context,
            pluginDomain,
            plugin = all_plugins[ID];

        if (signal.current_plugin <= signal.total_plugins) {
            context = new Context(plugin, signal, callback);
            signal.currentContext = context;
            pluginDomain = Domain.create();
            pluginDomain.on('error', function (error) {
                displayError(signal, error, plugin, route);
            });
            pluginDomain.run(function () {
                plugin.module[plugin.type].apply({}, [context, plugin.options]);
            });
        }
    };

    notFound = function (next, signal) {
        var route = domain.routes.GET['404'];
        if (signal && !signal.statusCode) {
            signal.status(404, 'Page not found.');
        }
        if (route) {
            if (next) { next(); }
        } else {
            response.end(signal.statusCode + ' ' + signal.statusMessage);
        }
    };

    afterBody = function () {
        if (route) {
            if (signal.total_plugins > 0) {
                patch_plugin(0);
            } else {
                signal.status(500, 'Route not configured.');
                notFound(false, signal);
            }
        } else {
            signal.noRoute = true;
            if (signal.total_plugins > 0) {
                patch_plugin(0, notFound);
            } else {
                notFound(false, signal);
            }
        }
    };

    signal.request = request;
    signal.response = response;

    // Headers
    signal.headers = request.headers;
    signal.status = function (code, message) {
        signal.statusMessage = message || 'Something went wrong.';
        signal.statusCode = code;
        response.statusCode = code;
    };

    signal.header = function (where, newValue) {
        if (newValue === undefined) {
            return response.getHeader(where) || request.headers[where];
        }
        if (!response.headersSent) {
            if (newValue === null) {
                return response.removeHeader(where);
            }
            return response.setHeader(where, newValue);
        }
    };

    signal.header('content-type', 'text/plain');
    signal.header('X-Powered-By', 'Diet.js');
    // ENV
    signal.env = process.env.NODE_ENV;
	
    // Method
    signal.method = request.method;
	
    // URL
    signal.url = url.parse(http_type + '://' + request.headers.host + request.url);

    // IP
    signal.ip = request.headers['x-forwarded-for'] || request.connection.remoteAddress || false;
	
    // Better Query String Parser
    signal.qs = {
        stringify : qs.stringify,
        parse : qs.parse
    };
	
    signal.query = isset(signal.url.query) ? signal.qs.parse(signal.url.query) : {};
	
    // GET mime type from url IF it's a file request not a page request
    signal.mime_type = pathjs.extname(request.url.pathname).substr(1).toLowerCase();
	
    // Create Redirection Method
    signal.redirectResponse = function (input, statusCode) {
        var path = input,
            URI,
            QUERY;

        if (input.substring(0, 4) === 'back') {
            path = request.headers.referer || '/';
        } else if (input.substring(0, 4) === 'home') {
            path = '/';
        }

        // Append Addtional Routes
        if (input.split('back')[1]) {
            path += input.split('back')[1];
        }

        if (input.split('home')[1]) {
            path += input.split('home')[1];
        }
        URI = url.parse(path);
        if (URI.query) {
            QUERY = '?' + signal.qs.stringify(signal.qs.parse(URI.query));
            // Reconstruct the Path
            path = '';
            path += (URI.protocol ? URI.protocol + '//' : '');
            path += URI.hostname || '';
            path += (URI.port ? ':' + URI.port : '');
            path += URI.pathname || '';
            path += QUERY || '';
        }
        signal.status((!statusCode) ? 302 : statusCode);
        signal.header('Location', path);
    };
	
    // Data Holder
    signal.data = {};
	
    // Form holder
    signal.body = {};
    
    // Files holder
    signal.files = {};

    // URL Params /foo/:bar
    signal.params = {};
	
    // passed holder
    signal.passed = true;
	
    // errors holder
    signal.errors = {};
	
    signal.enders = [];
    signal.onEnd = function (callback) {
        if (isset(callback)) {
            signal.enders.push(callback);
        }
    };
	
    // Signal Parent Domain
    domain = $.domains[signal.url.hostname + (proxy ? '' : ':' + signal.url.port)] || $.domains['*'] || false;
    signal.domain = domain;
    signal.message = '';
	
    // Final Function that runs at the end of every request
    signal.responded = false;
    signal.respond = function () {
        if (!signal.responded) {
            var next = new Next(signal.enders.length, function () {
                response.end(signal.message);
            });
            signal.enders.forEach(function (ender) {
                ender(next, signal);
            });
        } else {
            response.end(signal.message);
        }
        signal.responded = true;
    };
	
    // POST Body
    if (domain) {
        methodRoutes = domain.routes[signal.method.toUpperCase()];
        for (index in methodRoutes) {
            if (methodRoutes.hasOwnProperty(index)) {
                route = getRoute(methodRoutes[index], signal);
                if (route) { break; }
            }
        }

        if (route) {
            all_plugins = route.plugins;
        } else if (domain.routes.GET['404']) {
            all_plugins = domain.routes.GET['404'].plugins;
            signal.status(404, 'Page not found.');
        }
        signal.current_plugin = 0;

        // total local plugins
        signal.total_plugins = all_plugins.length;

        signal.progress = function (callback) {
            signal.current_plugin++;
            if (signal.current_plugin < signal.total_plugins) {
                patch_plugin(signal.current_plugin, callback);
            } else if (signal.current_plugin === signal.total_plugins) {
                signal.onEnd(callback);
                signal.respond();
            }
        };

        // total global plugins
        if (domain.plugins.global.length) {
            signal.total_plugins += domain.plugins.global.length;
            all_plugins = domain.plugins.global.concat(all_plugins);
        }

        // insert plugins in runtime
        signal.chain = function () {
            //console.log('\n#CHAIN'.yellow +' init'.white)
            var object = {},
                plugin,
                pluginDomain;
            
            object.count = 0;
            object.progress = function (ID) {
                //console.log('\n#CHAIN'.yellow +' --> ready:',ID, 'VS total:', object.total-1, ' = ', ID < object.total-1);
                if (ID <= object.total) {
                    if (ID === object.total) {
                        //console.log('CALLLLLBACK'.red);
                        signal['return'] = object.context.originalReturn;
                        object.callback();
                    } else {
                        plugin = object.plugins[ID];
                        //console.log('#CHAIN'.yellow + ' --> add runtime plugin '+plugin.name.blue)
                        object.context = new Context(plugin, signal);
                        object.context.originalReturn = object.context['return'];
                        object.context['return'] = function (plugin_return) {
                            //console.log('#CHAIN'.yellow +' --> return plugin ' + plugin.name.red);
                            signal[plugin.name] = plugin_return;

                            //console.log('signal['+plugin.name+']', signal[plugin.name])
                            object.progress(ID + 1);
                        };

                        pluginDomain = Domain.create();
                        
                        pluginDomain.on('error', function (error) {
                            displayError(signal, error, plugin, route);
                        });
                        
                        pluginDomain.run(function () {
                            plugin.module[plugin.type].apply({}, [object.context, plugin.options]);
                        });
                    }
                }
            };
            
            object.plugins = [];
            object.load = function (callback) {
                //var next = new Next(count);
                object.total = object.count;
                object.callback = callback;

                //console.log('#CHAIN'.yellow + ' -> '+'load called'.red)
                object.progress(0);
            };
            
            object.plugin = function (Name, Function) {
                object.count++;
                var plugin = {
                    module: { local: Function },
                    type: 'local',
                    name: Name,
                    argumentName: Name
                };
                object.plugins.push(plugin);
                return object;
            };

            return object;
        };

        content_type = request.headers['content-type'];
        if (signal.method === 'PUT' || signal.method === 'POST') {
            signal.body = null;
            readFinished = false;
            fileCount = 0;
            signal.multipart = (content_type && content_type.toString().indexOf('multipart/form-data') > -1);
            try {
                busboy = new Busboy({
                    headers: signal.headers,
                    limits: options.limits
                });

                busboy.on('file', function (fieldname, fileStream, filename, encoding, mimetype) {
                    var ext, newFilename, newFilePath;

                    // don't attach to the files object, if there is no file
                    if (!filename) { return fileStream.resume(); }

                    // defines is processing a new file
                    fileCount++;
                    if (filename.indexOf('.') > 0) {
                        ext = '.' + filename.split('.').slice(-1)[0];
                    } else {
                        ext = '';
                    }
                
                    newFilename = rename(fieldname, filename.replace(ext, '')) + ext;
                    newFilePath = path.join(options.uploads.path, newFilename);

                    file = {
                        fieldname: fieldname,
                        originalname: filename,
                        name: newFilename,
                        encoding: encoding,
                        mimetype: mimetype,
                        path: newFilePath,
                        extension: (ext === null) ? null : ext.replace('.', ''),
                        size: 0,
                        truncated: null,
                        buffer: null
                    };

                    ws = fs.createWriteStream(newFilePath);
                    fileStream.pipe(ws);

                    fileStream.on('data', function (data) {
                        if (data) {
                            file.size += data.length;
                        }
                    });
                
                    fileStream.on('end', function () {
                        file.truncated = fileStream.truncated;
                        if (!signal.files[fieldname]) {
                            signal.files[fieldname] = [];
                        }
                        signal.files[fieldname].push(file);

                        // defines has completed processing one more file
                        fileCount--;
                        onFinish();
                    });
                });
            
                busboy.on('field', function (fieldname, val, fieldnameTruncated, valTruncated) {
                    signal.body = signal.body || {};
                    if (signal.body.hasOwnProperty(fieldname)) {
                        if (Object.isArray(signal.body[fieldname])) {
                            signal.body[fieldname].push(val);
                        } else {
                            signal.body[fieldname] = [signal.body[fieldname], val];
                        }
                    } else {
                        signal.body[fieldname] = val;
                    }
                });
            
                busboy.on('json', function (val) {
                    signal.body = val;
                });

                busboy.on('finish', function () {
                    readFinished = true;
                    onFinish();
                });

                signal.request.pipe(busboy);
            } catch (err) {
                afterBody();
            }
        } else {
            afterBody();
        }
    } else {
        signal.status(404, 'Domain not found.');
        response.end(signal.statusCode + ' ' + signal.statusMessage);
    }
};

var setupServer = function (app) {
    proxy = app.proxy;
    options = app.options || {};
    options.uploads = options.uploads || {};
    options.uploads.path = options.uploads.path || os.tmpdir();
    mkdirp(options.uploads.path, function (err) {
        if (err) { throw err; }
    });
};

var server = module.exports = {
    'default' : function (app) {
        // Create Non-secure Server
        server = http.createServer(function (request, response) {
            httpHandler(request, response, app, 'http');
        }).listen(app.port);
        setupServer(app);
        app.log('   ' + '✓'.yellow + ' HTTP Server is ' + 'listening'.yellow + ' on ' + (app.domain).underline);
        return server;
    },
    secure : function (app) {
        setupServer(app);
        if (app.secure && app.secure.key && app.secure.cert) {
            // Define default HTTPS port
            if (!app.port || app.port === 80) {
                app.port = 443;
            }

            // Get Keys from Certificate Files
            var keys = {};

            // Required app.secure options
            keys.key  = fs.readFileSync(app.secure.key);
            keys.cert = fs.readFileSync(app.secure.cert);

            // Optional Ca (Intermediate Certificate)
            if (isset(app.secure.ca)) {
                keys.ca = fs.readFileSync(app.secure.ca);
            }

            // Create Secure Server
            server = https.createServer(keys, function (request, response) {
                httpHandler(request, response, app, 'https');
            }).listen(app.port);

            app.log('   ' + '✓'.yellow + ' HTTPS Server is ' + 'listening'.yellow + ' on ' + (app.domain).underline);
            return server;
        } else {
            throw new Error('HTTPS: Certificates are missing. \n app.secure.key and app.secure.cert must be set.');
        }
    }
};