// Karma configuration
// Generated on Wed Jan 31 2018 19:55:08 GMT-0500 (Eastern Standard Time)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'sinon-chai'],


    // list of files / patterns to load in the browser
    files: [
      //{ pattern: 'test/support/**/*', watched: true, included: true },
      { pattern: 'test/fixtures/**/*', watched: false, included: false, served: true },
      { pattern: 'test/**/*.spec.js', watched: false }
    ],


    // list of files / patterns to exclude
    exclude: [
    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'test/**/*.js': ['rollup']
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['coverage', 'mocha'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['ChromeHeadless', 'FirefoxHeadless'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity,

    rollupPreprocessor: {
      plugins: [
        require('rollup-plugin-node-resolve')(),
        require('rollup-plugin-istanbul')({
          include: ['lib/**/*.js']
        })
      ],
      output: {
        format: 'iife',
        sourcemap: 'inline'
      },
      // objectRestSpread plugin can be removed once a new version of acorn/rollup is released
      // https://github.com/acornjs/acorn/commit/5aa2e7388fd7c6d03bd5149ffd57c841b1c02599
      acorn: {
        plugins: { objectRestSpread: true }
      },
      acornInjectPlugins: [
        require('acorn-object-rest-spread/inject')
      ]
    },
  })
}
