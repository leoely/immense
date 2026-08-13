import { series, src, dest, } from 'gulp';
import babel from 'gulp-babel';

function build() {
  return src('src/**/*.js')
    .pipe(babel({
      "presets": [
        [
          "@babel/preset-env",
          {
            "targets": {
              "node": "current"
            }
          },
        ],
        [
          "minify",
          {
            "keepClassName": true,
            "keepFnName": true,
            "builtIns": false
          },
        ],
      ],
      "plugins": [
        [
          "babel-plugin-root-import",
          {
            "paths": [
              {
                "rootPathSuffix": "./src",
                "rootPathPrefix": "~/"
              },
            ]
          }
        ]
      ],
    }))
    .pipe(dest('dist'));
}

exports.build = build;
