diet
====

A minimal plugin based http framework.

Install
===
`npm install diet`

Hello World!
===
```
// index.js
var $ = require('diet');
$.domain = 'localhost';

$('GET /', function(){
  end('hello world');
});

```

Run
===
node index.js
