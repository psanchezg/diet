diet
====

A minimal plugin based http framework.

Install
===
```
npm install diet
```

Hello World!
===
```js
// require diet
$ = require('diet');
$.domain = 'localhost';

// router
$('GET /', function(){
    this.end('hello world');
});

```

Load MySQL module as a plugin
===
```js
// require diet-mysql
var db = require('diet-mysql')({
    host: 'localhost',
    user: 'root',
    password: '',
    database; 'hello'
});

// require diet
$ = require('diet');
$.domain = 'localhost';

// router
$('GET /', db, function(){
    this.db('SELECT * FROM users', this.data); // call db and append results to the data object
    this.end('hello world {{this.data[0].name}}');
});

```
Run
===
```
node index.js
```
