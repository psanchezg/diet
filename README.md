diet
====

A minimal plugin based http framework.

Install
---
```
npm install diet
```

Hello World!
---
```js
// SETUP
$ = require('diet');
$.domain = 'localhost';

// ROUTE GET /
$('GET /', function(){
    end('hello world');
});

```
Load MySQL module as a plugin
---
```js

// SETUP
$ = require('diet');
$.domain = 'localhost'; 

// PLUGIN diet-mysql module
var db = $.plugin('diet-mysql')({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'hello'
});

// PLUGIN the ECT template engine module
$.plugin('diet-ect', { open: '{{', close: '}}' }) 

// ROUTE GET /
$('GET /', db, function(){ // <-- no arguments needed!
    // plugins and local functions are being called without
    // having to bother with arguments
    
    // call db() and append results to the data object
    db('SELECT * FROM users', data); 
    
    // the end() function sends back a response
    // the diet-ect plugin allows to send back
    // data-driven dynamic strings
    end('hello world {{-this.data[0].name}}');
});

```

Respond with HTML
---
```js
// SETUP
$ = require('diet');
$.domain = 'localhost'; 
$.plugin('static');
$.plugin('diet-ect', { open: '{{', close: '}}' });

// ROUTE GET /
// by default /static/index.html is used
// so html() is fine too without an argument
$('GET /', function(){
    html('/static/index.html'); 
});

```
Run
---
```
node index.js
```

Create a Plugin
---
