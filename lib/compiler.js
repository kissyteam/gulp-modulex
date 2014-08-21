var mutil = require('modulex-util');
var gutil = require('gulp-util');
var fs = require('fs');
var PLUGIN_NAME = require('../package.json').name;
var modulex = require('modulex');

function wrapCommonjs(code, name, deps) {
    return 'modulex.add("' + name + '", [' + (deps.length ? '"' + deps.join('","') + '"' : '') + '], function(require, exports, module) {' + code + '});';
}

function findRequires(code) {
    return modulex.Loader.Utils.getRequiresFromFn(code);
}

function optimizeRequires(requires) {
    var names = Object.keys(requires);
    var ret = [];
    names.forEach(function (name) {
        var modRequires = requires[name];
        for (var i = 0; i < modRequires.length; i++) {
            var modRequire = modRequires[i];
            if (ret.indexOf(modRequire) === -1 && names.indexOf(modRequire) === -1) {
                ret.push(modRequire);
            }
        }
    });
    return ret;
}

function compileModule(modName, code, codes, requires, excludesMap) {
    if (excludesMap[modName]) {
        return;
    }
    if (codes[modName] !== undefined) {
        return;
    }
    var mod = modulex.getModule(modName);
    if (!code) {
        if (mod.getPackage().name === 'core' || !fs.existsSync(mod.getUrl())) {
            return;
        }
        code = fs.readFileSync(mod.getUrl());
    }
    var modRequires = findRequires(code);
    mod.requires = modRequires;
    // record after normalize
    modRequires = requires[modName] = mod.getNormalizedRequiredModules().map(function (m) {
        return m.name;
    });
    codes[modName] = wrapCommonjs(code, modName, modRequires);
    modRequires.forEach(function (requireName) {
        compileModule(requireName, null, codes, requires, excludesMap);
    });
}

function findModName(packages, filePath) {
    filePath = filePath.replace(/\\/g, '/');
    var pName = '';
    var packagePath, finalPackagePath;
    for (var p in packages) {
        packagePath = packages[p].base.replace(/\\/g, '/');
        if (mutil.endsWith(packagePath, '/')) {
            packagePath = packagePath.slice(0, -1);
        }
        if (filePath === (packagePath + '.js') || mutil.startsWith(filePath, packagePath + '/') && p.length > pName.length) {
            pName = p;
            finalPackagePath = packagePath;
        }
    }
    if (!pName) {
        throw new gutil.PluginError(PLUGIN_NAME, 'packages can not find file: ' + filePath);
    }
    if (filePath === (packagePath + '.js')) {
        return pName;
    } else {
        return pName + filePath.substring(packagePath.length).slice(0, 0 - '.js'.length);
    }
}

module.exports = {
    findModName: findModName,

    compileModule: compileModule,

    optimizeRequires: optimizeRequires
};