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
require('sugar');
var http = require('./http');
var Next = require('nextjs');
var url = require('url');
var pathToRegexp = require('path-to-regexp');
var colors = require('colors');
var callsite = require('callsite');
var path = require('path');
var fs = require('fs');
/*jslint nomen: true */
var version = JSON.parse(fs.readFileSync(__dirname + '/../package.json').toString()).version;
/*jslint nomen: false */
var util = require('util');
var printStackTrace = require('stacktrace-js');

// Init Log
process.stdout.write('\u001B[2J\u001B[0;0f');
console.log((' Diet v' + version + ' ').inverse + ' ☺'.grey);
console.log(' http://dietjs.com/'.grey);

var getDomain = function (domainName, proxy) {
    if (!isNaN(domainName)) { // if it's a port
        // Domain Name
        domainName = 'http://localhost:' + domainName;
    } else if (typeof domainName === 'object') {
        domainName = url.format(domainName);
    }
    if (proxy) {
        var newLocation = url.parse(domainName);
        delete newLocation.host;
        delete newLocation.path;
        delete newLocation.pathname;
        domainName = url.format(newLocation);
    }
    return domainName;
};

var addPlugin = function (plugins, argument, argumentName) {
    if (typeof argument === 'object') {
        plugins.push(Object.merge(argument, {
            type: 'local',
            argumentName: argumentName,
            module: { local: argument.local }
        }));
    } else if (typeof argument === 'function') {
        plugins.push({
            type: 'local',
            module: { local: argument },
            argumentName: argumentName
        });
    }
};

// App Class
var App = function (options) {
    var app = this,
        gap,
        i,
        platform,
        homeDir = process.env[(platform === 'win32') ? 'USERPROFILE' : 'HOME'],
        displayPath,
        stack = callsite(),
        requester = stack[1].getFileName(),
        isRegularModule,
        trace,
        lineNumber,
        module_path,
        current_dir,
        input_source,
        module_source,
        plugin_name;
    options = options || {};
    this.level = typeof options.level !== 'undefined' ? options.level : 0;
    this.debug = typeof options.debug !== 'undefined' ? options.debug : true;
    this.options = options;
    this.log = function () {
        if (this.debug) {
            var array = Array.apply(null, arguments);
            if (this.level > 0) {
                gap = '';
                for (i = 0; i <= this.level; i++) {
                    gap += '  ';
                }
                array.unshift(gap);
            }
            console.log.apply(this, array);
        }
    };
	
    // Process Path
    app.path = path.dirname(requester);
    app.dirName = app.path.match(/([^\/]*)\/*$/)[1];
	
    platform = options.platform || process.platform;
    displayPath = app.path;
    if (homeDir && app.path.substring(0, homeDir.length) === homeDir) {
        displayPath = '~' + app.path.slice(homeDir.length);
    }
	
    // Diet Router Listeners
    app.routes = { GET: {}, POST: {}, DELETE: {}, OPTIONS: {}, HEAD: {}, PUT: {} };
	
    // Diet Plugins
    app.plugins = { onload: [], loaded: 0, global: [], local: [], all: [] };

    // Use Diet Plugin
    app.plugin = function (name, options) {
        options = options || {};
        options.alias = options.alias || name;
        app.log('   ' + '⚑'.yellow + ' Plugin ' + name.cyan + ' registered'.yellow + ' as ' + options.alias.cyan);

        // plugin type
        isRegularModule = (name.search(/([^a-zA-Z-_1-9]+)+/gi) === -1) ? true : false;
		
        // get a stack trace
        trace = printStackTrace({e: new Error()});
		
        // parse module source
        lineNumber = trace[1].split(':')[1];
        module_path = trace[1].split('@')[1].split(':')[0];
        current_dir = module_path.substr(0, module_path.lastIndexOf('/'));
        input_source = (name.substr(0, 2) !== './') ? name : name.substr(1);
        module_source = current_dir + input_source;
		
        // plugin name
        if (isRegularModule) {
            module_source = current_dir + '/node_modules/' + input_source + '/index.js';
            // plugin name
            plugin_name = name;
        } else {
            // plugin name
            plugin_name = module_source.substr(module_source.lastIndexOf('/') + 1).split('.')[0];
        }
		
        // create plugin
        app.plugin[plugin_name + "||" + options.alias] = {
            name: plugin_name,
            options: options,
            isRegularModule: isRegularModule
        };
        // Allows multiple instances of same plugin with diferent options for instance
        require.cache[module_source] = false;
        module.app = app;
        module.name = name;
        module.options = options;
        module['return'] = function () {
            require.cache[module_source].loaded = true;
            app.plugin[plugin_name + "||" + options.alias].loaded = true;
            app.plugins.loaded++;
            app.loaded();
        };
		
        // load plugin
        var plugin = require(module_source);
        app.plugin[plugin_name + "||" + options.alias].module = plugin;
        app.plugins.onload.push(app.plugin[plugin_name + "||" + options.alias]);
		
        if (plugin.global) {
            app.plugins.global.push(Object.merge(app.plugin[plugin_name + "||" + options.alias], {
                type: 'global',
                argumentName: plugin_name
            }));
        }
		
        return plugin;
    };
	
    app.log('');
    app.log(' app '.yellow.inverse + (' ' + app.dirName + ' ').inverse +
            ' at '.grey + displayPath.grey);
    app.log('-----------------------------------------------------------------'.grey);
	
    return app;
};

App.route = function () {
    // First Argument is the action
    var action,
        i,
        // Create Stack Trace
        trace = printStackTrace({e: new Error()}),
        // Construct Local Plugins
        plugins = [],
        // IF the points is not in REPL
        inREPL = trace[2].indexOf('@repl') !== -1,
        inEVAL = trace[2].indexOf('@[eval]') !== -1,
        file_name,
        file_contents,
        lineNumber,
        index,
        lines,
        args,
        argument,
        argumentName;

    // For lint purposes
    for (i = 0; i < 1; i++) {
        action = arguments[i];
    }
        
    /*jslint nomen: true */
    if ((!inREPL && !inEVAL) && !this.options._repl) {
        /*jslint nomen: false */
        
        // Parse out the Line Number from the Second Trace Line
        lineNumber = trace[2].split(':')[1];
		
        // Parse out the File Name from the Second Trace Line
        file_name = trace[2].split('@')[1].split(':')[0];
		
        // Read the File from the file_name
        file_contents = fs.readFileSync(file_name).toString('utf8');
		
        // Split file_contents into an Array of it's lines
        lines = file_contents.split('\n');
		
        // Parse out the arguments at the lineNumber from the lines
        args = lines[lineNumber - 1].split(',');

        for (index in arguments) {
            if (arguments.hasOwnProperty(index)) {
                argument = arguments[index];

                // object.hello.world -> world
                argumentName = args[index].trim();
                if (argumentName.indexOf('.') !== -1) {
                    argumentName = argumentName.substr(argumentName.lastIndexOf('.')).split('.')[1];
                }

                // object['hello']['yolo'] -> yolo
                if (argumentName.indexOf('[\'') !== -1) {
                    argumentName = argumentName.substr(argumentName.lastIndexOf('[\''));
                    argumentName = argumentName.split('[\'')[1].split('\']')[0];
                }

                // object["hello"]["you"] -> you
                if (argumentName.indexOf('[\"') !== -1) {
                    argumentName = argumentName.substr(argumentName.lastIndexOf('[\"'));
                    argumentName = argumentName.split('[\"')[1].split('\"]')[0];
                }

                addPlugin(plugins, argument, argumentName);
            }
        }
    } else {
        for (index in arguments) {
            if (arguments.hasOwnProperty(index)) {
                addPlugin(plugins, arguments[index], undefined);
            }
        }
    }
    return {
        action      : action,
        plugins     : plugins,
        'arguments' : arguments,
        fileContents: file_contents,
        lineNumber	: lineNumber,
        fileName	: file_name
    };
};

App.prototype.router = function (method) {
    return function () {
        var app = this,
            route = App.route.apply(app, arguments),
            keys = [],
            regex = pathToRegexp(route.action, keys);
		
        if (!app.routes[method][route.action]) {
            app.routes[method][route.action] = {
                'function': arguments[arguments.length - 1],
                plugins: route.plugins,
                regex: regex,
                keys: keys,
                path: route.action
            };
        } else {
            app.routes[method][route.action].plugins = app.routes[method][route.action].plugins.concat(route.plugins);
            app.routes[method][route.action]['function'] = arguments[arguments.length - 1];
        }
        return app;
    };
};

App.prototype.get = App.prototype.router('GET');
App.prototype.post = App.prototype.router('POST');
App.prototype['delete'] = App.prototype.router('DELETE');
App.prototype.opts = App.prototype.router('OPTIONS');
App.prototype.head = App.prototype.router('HEAD');
App.prototype.put = App.prototype.router('PUT');


// Diet Options
App.prototype.debug = false;

// The server from App.prototype.http or App.prototype.https
App.prototype.server = false;

App.prototype.alias = [];
App.prototype.addAlias = function (aliasName) {
    // Add an alias domain
    var app = this,
        location;
    if (aliasName === '*') {
        return app.alias.push(aliasName);
    }
    location = url.parse(getDomain(aliasName, app.proxy));
    app.alias.push(location.hostname + (app.proxy ? '' : ':' + app.location.port));
};

App.prototype.domains = {};
App.prototype.domain = function (domainName, secure, proxy) {
    var app = this;
    app.secure = secure || app.secure;
    app.proxy = proxy || app.proxy;
    if (isset(domainName)) {
        // Location
        app.domain = getDomain(domainName, app.proxy);
        app.location = url.parse(app.domain);
        app.protocol = app.location.protocol.split(':')[0];
        app.port = app.location.port || 80;
    } else {
        app.log('   [x] Error Domain was not specified.'.red);
        return 'Error Domain was not specified.';
    }
    return app;
};

// Plugin Loaded
App.prototype.loaded = function (callback) {
    if (this.started && this.plugins.loaded === this.plugins.onload.length) {
        this.log('   ' + '✓'.yellow + ' All plugins are ' + 'ready'.yellow);
        this.finished();
    }
    return this;
};

App.prototype.start = function (callback) {
    var app = this;
    app.started = true;
    app.onFinished = callback;
    app.loaded();
    return app;
};

App.prototype.finished = function () {
    var app = this,
        index,
        d,
        idx,
        aliasl,
        port_used = false;

    if (!isset(app.location)) { app.domain('http://localhost/'); }
    for (index in app.domains) {
        if (app.domains.hasOwnProperty(index)) {
            d = app.domains[index];
            if (d.port === app.port) {
                port_used = true;
                app.server = d.server;
            }
        }
    }
    if (!port_used) {
        if (app.protocol === 'https') {
            app.server = http.secure(app);
        } else {
            app.server = http['default'](app);
        }
		
    } else {
        app.log('   -> HTTP Server is ' + 'listening'.yellow + ' on ' + (app.domain).underline);
    }
	
    // Reference All Domains in app.domains
    app.domains[app.location.hostname + (app.proxy ? '' : ':' + app.location.port)] = app;
    for (idx = 0, aliasl = app.alias.length; idx < aliasl; idx++) {
        app.domains[app.alias[idx]] = app;
    }

    app.log('-----------------------------------------------------------------\n'.grey);
    if (app.onFinished) { app.onFinished(); }
};

module.exports = App;