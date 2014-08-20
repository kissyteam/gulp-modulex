var mutil = require('modulex-util');
var gutil = require('gulp-util');
var PLUGIN_NAME = require('../package.json').name;

function splitSlash(str) {
    var parts = str.split(/\//);
    if (str.charAt(0) === '/' && parts[0]) {
        parts.unshift('');
    }
    if (str.charAt(str.length - 1) === '/' && str.length > 1 && parts[parts.length - 1]) {
        parts.push('');
    }
    return parts;
}

function normalizePath(parentPath, subPath) {
    var firstChar = subPath.charAt(0);
    if (firstChar !== '.') {
        return subPath;
    }
    var parts = splitSlash(parentPath);
    var subParts = splitSlash(subPath);
    parts.pop();
    for (var i = 0, l = subParts.length; i < l; i++) {
        var subPart = subParts[i];
        if (subPart === '.') {
        } else if (subPart === '..') {
            parts.pop();
        } else {
            parts.push(subPart);
        }
    }
    return parts.join('/').replace(/\/+/, '/');
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
    splitSlash: splitSlash,

    normalizePath: normalizePath,

    findModName: findModName
};