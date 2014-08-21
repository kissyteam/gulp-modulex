# gulp-modulex

compile, concat and generate dependencies of modulex modules

## example

```javascript
gulp.task('default', function () {
    gulp.src('./lib/a.js')
        .pipe(gulpModulex({
            modulex:{
                packages: {
                    lib: {
                        base: path.resolve(process.cwd(), './lib')
                    }
                }
            },
            excludeModules:[]
        }))
        .pipe(gulp.dest('./build'));
});
```