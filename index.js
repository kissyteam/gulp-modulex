/**
 * compile, concat and extra dependencies of modulex modules
 * @author yiminghe@gmail.com
 */
var through = require('through2');
var modulex = require('modulex');
var compiler = require('./lib/compiler');
var gutil = require('gulp-util');
var PLUGIN_NAME = require('./package.json').name;

module.exports = function (config) {
    var packages = config.packages;
    modulex.config('packages', packages);

    return through.obj(function (file, encoding, callback) {
        var code = file.contents.toString(encoding);
        if (!file.isBuffer()) {
            throw new gutil.PluginError(PLUGIN_NAME, 'only support buffer');
        }
        var codes = {};
        var requires = {};
        var main = compiler.findModName(packages, file.path);
        compiler.compileModule(main, code, codes, requires);
        var mods = [];
        var header = ['/*', 'combined modules:'];
        var codeContent = [];
        for (var c in codes) {
            if (codes[c]) {
                mods.push(c);
            }
            codeContent.push(codes[c]);
        }
        header = header.concat(mods);
        header = header.concat(['*/']);
        codeContent = header.concat(codeContent);
        var concatFile = file.clone();
        concatFile.contents = new Buffer(codeContent.join('\n'), encoding);
        concatFile.path = file.path.slice(0, -3) + '-debug.js';
        this.push(concatFile);
        var optimizedRequires = compiler.optimizeRequires(requires);
        if (optimizedRequires.length) {
            requires = {};
            requires[main] = optimizedRequires;
            var depsJsonFile = file.clone();
            depsJsonFile.contents = new Buffer(JSON.stringify(requires), encoding);
            depsJsonFile.path = file.path.slice(0, -3) + '-deps.json';
            this.push(depsJsonFile);
            var depsFile = file.clone();
            depsFile.contents = new Buffer('modulex.config("requires",' + JSON.stringify(requires) + ');', encoding);
            depsFile.path = file.path.slice(0, -3) + '-deps.js';
            this.push(depsFile);
        }
        callback();
    });
};