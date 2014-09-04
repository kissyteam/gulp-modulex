/*
combined modules:
lib/a
lib/b
*/
modulex.add("lib/a", ["lib/b","c"], function(require, exports, module) {var b = require('./b');
var c = require('c');
module.exports = b + 1 + c;});
modulex.add("lib/b", [], function(require, exports, module) {module.exports = 1;});