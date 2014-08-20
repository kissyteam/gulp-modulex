var gulp = require('gulp');
var gulpModulex = require('../../');
var path = require('path');

gulp.task('default', function () {
    gulp.src('./lib/a.js')
        .pipe(gulpModulex({
            packages: {
                lib: {base: path.resolve(process.cwd(), './lib')}
            }
        }))
        .pipe(gulp.dest('./build'));
});