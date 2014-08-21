var mutil = require('modulex-util');
var estraverse = require('estraverse');
var escodegen = require('escodegen');
var esprima = require('esprima');
var gutil = require('gulp-util');
var fs = require('fs');
var PLUGIN_NAME = require('../package.json').name;
var modulex = require('modulex');

/*jshint quotmark:false */
function clearRange(ast) {
    if (!ast) {
        return {};
    }
    for (var i in ast) {
        // can not delete computed
        if (i === 'range') {
            delete ast[i];
        } else if (typeof ast[i] === 'object') {
            clearRange(ast[i]);
        }
    }
    return ast;
}


// add name
// add deps array
function completeFullModuleFormat(ast, name, requires) {
    var addArguments = ast.body[0].expression['arguments'];
    var elements = [];
    for (var i = 0; i < requires.length; i++) {
        elements.push({
            type: 'Literal',
            value: requires[i]
        });
    }
    addArguments.unshift({
        type: 'ArrayExpression',
        elements: elements
    });
    addArguments.unshift({
        type: 'Literal',
        value: name
    });
}

function clearRangeAndComputed(ast) {
    if (!ast) {
        return {};
    }
    ast = mutil.clone(ast);
    for (var i in ast) {
        // can not delete computed
        if (i === 'range' || i === 'computed') {
            delete ast[i];
        } else if (typeof ast[i] === 'object') {
            clearRange(ast[i]);
        }
    }
    return ast;
}

var calleeExpression = {
    "type": "MemberExpression",
    "object": {
        "type": "Identifier",
        "name": "KISSY"
    },
    "property": {
        "type": "Identifier",
        "name": "add"
    }
};

function needModuleWrapAst(ast) {
    if (!ast) {
        return false;
    }
    if (ast.body.length !== 1) {
        return true;
    }
    ast = ast.body[0];
    if (!ast.expression) {
        return true;
    }
    return !mutil.equals(clearRangeAndComputed(ast.expression.callee), calleeExpression);
}

function wrapModuleAst(ast) {
    if (needModuleWrapAst(ast)) {
        var wrapBody = {
            "type": "BlockStatement",
            "body": []
        };
        var wrapAst = {
            "type": "Program",
            "body": [
                {
                    "type": "ExpressionStatement",
                    "expression": {
                        "type": "CallExpression",
                        "callee": {
                            "type": "MemberExpression",
                            "computed": false,
                            "object": {
                                "type": "Identifier",
                                "name": "modulex"
                            },
                            "property": {
                                "type": "Identifier",
                                "name": "add"
                            }
                        },
                        "arguments": [
                            {
                                "type": "FunctionExpression",
                                "id": null,
                                "params": [
                                    {
                                        "type": "Identifier",
                                        "name": "require"
                                    },
                                    {
                                        "type": "Identifier",
                                        "name": "exports"
                                    },
                                    {
                                        "type": "Identifier",
                                        "name": "module"
                                    }
                                ],
                                "defaults": [],
                                "body": wrapBody,
                                "rest": null,
                                "generator": false,
                                "expression": false
                            }
                        ]
                    }
                }
            ]
        };

        wrapBody.body = ast.body;
        return wrapAst;
    }
    return ast;
}

function findRequires(ast) {
    var requires = [];
    estraverse.traverse(ast, {
        'enter': function (node) {
            if (node.type === 'CallExpression') {
                var callee = node.callee;
                if (callee.type === 'Identifier' && callee.name === 'require') {
                    var args = node['arguments'];
                    if (args.length === 1 && args[0].type === 'Literal') {
                        requires.push(args[0].value);
                    }
                }
            }
        }
    });
    return requires;
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
    var ast = esprima.parse(code, {
        attachComment: true
    });
    ast = wrapModuleAst(ast);
    var modRequires = findRequires(ast);
    completeFullModuleFormat(ast, modName, modRequires);
    try {
        codes[modName] = escodegen.generate(ast, {
            comment: true
        });
    } catch (e) {
        throw new gutil.PluginError(PLUGIN_NAME, 'escodegen error: ' + modName);
    }
    mod.requires = modRequires;
    // record after normalize
    modRequires = requires[modName] = mod.getNormalizedRequiredModules().map(function (m) {
        return m.name;
    });
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