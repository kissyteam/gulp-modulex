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
        var filePath = mod.getUri();
        if (mod.getPackage().name === 'core' || !fs.existsSync(filePath)) {
            return;
        }
        code = fs.readFileSync(filePath);
    }
    var modRequires = findRequires(code);
    var fileRequires = modRequires.filter(function (m) {
        return m.indexOf('!') === -1;
    });
    // ignore plugin i18n!xx
    var plugins = modRequires.filter(function (m) {
        return m.indexOf('!') !== -1;
    });
    mod.requires = fileRequires;
    // record after normalize
    fileRequires = requires[modName] = mod.getNormalizedRequiredModules().map(function (m) {
        return m.id;
    });
    codes[modName] = 1;
    fileRequires.forEach(function (requireName) {
        compileModule(requireName, null, codes, requires, excludesMap);
    });
    requires[modName] = requires[modName].concat(plugins);
    codes[modName] = wrapCommonjs(code, modName, requires[modName]);
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