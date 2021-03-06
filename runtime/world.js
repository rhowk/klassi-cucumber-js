/**
 * KlassiTech Automated Testing Tool
 * Created by Larry Goddard
 */
'use strict';

/** world.js is loaded by the cucumber framework before loading the step definitions and feature files
 * it is responsible for setting up and exposing the driver/browser/expect/assert etc required within each step definition
 */
const fs = require('fs'),
  path = require('path'),
  requireDir = require('require-dir'),
  merge = require('merge'),
  chalk = require('chalk'),
  dir = require('node-dir'),
  chai = require('chai'),
  reporter = require('cucumber-html-reporter'),
  rp = require('request-promise'),
  webdriverio = require('webdriverio'),
  program = require('commander'),
  webdrivercss = require('webdrivercss-custom-v4-compatible');

const assert = chai.assert,
    expect = chai.expect;
const getRemote = require('./getRemote.js');

/**
 * for the Logging feature
 */
global.logger = require('./logger');

/**
 * for the environment variables
 */

global.envConfig = require('./envConfig.json');


/**
 *  for the Download of all file types
 */
global.downloader = require('./downloader.js');

/**
 * for all assertions for variable testing
 */
global.assert = assert;
global.expect = expect;

/**
 * Environment variables
 * @type {*|(function(): driver)}
 */
let ChromeDriver = require('./chromeDriver'),
  FirefoxDriver = require('./firefoxDriver'),
  BrowserStackDriver = require('./browserStackDriver');

let remoteService = getRemote(settings.remoteService);

/**
 * create the web browser based on global let set in index.js
 * @returns {{}}
 */
function getDriverInstance() {

  let driver = {};
  let screenWidth = []; //[752, 1008, 1280];
  let browser = settings.browserName;

  let options = {};

  if (remoteService && remoteService.type === "browserstack") {

    let configType = settings.remoteConfig;
    assert.isString(configType,"BrowserStack requires a config type e.g. win10-chrome");

    driver = new BrowserStackDriver(options, configType);
    return driver;
  }
  assert.isNotEmpty(browser,"Browser must be defined");
  
  switch (browser || '') {

    case 'firefox': {
      driver = FirefoxDriver(options);
    }
      break;

    case 'chrome': {
      driver = new ChromeDriver(options);
    }
      break;

  }

  /**
   *  initialise WebdriverCSS for `driver` instance
   */
  webdrivercss.init(driver, {
    screenshotRoot: './cssImages/baseline/',
    failedComparisonsRoot: './cssImages/imageDiff/',
    misMatchTolerance: 1.15,
    screenWidth: screenWidth,
    updateBaseline: false
  });
  return driver;
}

/**
 * Global timeout
 * @type {number}
 */
global.DELAY_500_MILLISECOND = 1000;     // 1000 millisecond delay
global.SHORT_DELAY_MILLISECOND = 3000;  // 3 second delay in milliseconds
global.MID_DELAY_MILLISECOND = 5000;    // 5 second delay in milliseconds
global.LONG_DELAY_MILLISECOND = 10000;  // 10 second delay in milliseconds
global.EXTRA_LONG_DELAY_MILLISECOND = 20000;  // 20 second delay in milliseconds
global.DELAY_3_SECOND = 3;              // 3 second delay
global.DELAY_10_SECOND = 10;            // 10 second delay
global.DELAY_15_SECOND = 15;            // 15 second delay
global.DELAY_20_SECOND = 20;            // 20 second delay

function consoleInfo() {
  let args = [].slice.call(arguments),
    output = chalk.bgBlue.white('\n>>>>> \n' + args + '\n<<<<<\n');
  console.log(output);
}

/**
 * All Global variables
 * @constructor
 */
function World() {
  /**
   * This is the Global date functionality
   */
  global.date = helpers.currentDate();

  /**
   * Adding logging
   */
  global.log = logger.klassiLog();
  /**
   * create a list of variables to expose globally and therefore accessible within each step definition
   * @type {{driver: null, webdriverio, webdrivercss: *, expect: *, assert: (*), trace: consoleInfo,
   * log: log, page: {}, shared: {}}}
   */
  let runtime = {
    driver: null,                 // the browser object
    webdriverio: webdriverio,     // the raw webdriverio driver module, providing access to static properties/methods
    webdrivercss: webdrivercss,   // the raw webdrivercss driver function
    expect: global.expect,        // expose chai expect to allow variable testing
    assert: global.assert,        // expose chai assert to allow variable testing
    fs: fs,                       // expose fs (file system) for use globally
    dir: dir,                     // expose dir for getting an array of files, subdirectories or both
    trace: consoleInfo,           // expose an info method to log output to the console in a readable/visible format
    page: [],                     // empty page objects placeholder
    shared: {},                   // empty shared objects placeholder
    log: global.log,                     // expose the log method for output to files for emailing
    envConfig: global.envConfig,  // expose the global environment configuration file for use when changing environment types (i.e. dev, test, preprod)
    downloader: global.downloader,// exposes the downloader for global usage
    request: rp,                  // exposes the request-promise for API testing
    date: global.date,                   // expose the date method for logs and reports
  };

  /**
   *  expose properties to step definition methods via global variables
   */
  Object.keys(runtime).forEach(function (key) {
    /** make property/method available as a global (no this. prefix required)
     */
    global[key] = runtime[key];
  });

  /**
   * import page objects (after global lets have been created)
   */
  if (global.paths.pageObjects && fs.existsSync(global.paths.pageObjects)){
    /** require all page objects using camelcase as object names
     */
    runtime.page = requireDir(global.paths.pageObjects, { camelcase: true });

    /**
     * expose globally
     * @type {{}}
     */
    global.page = runtime.page;
  }

  /**
   * import shared objects from multiple paths (after global lets have been created)
   */
  if (global.paths.sharedObjects && Array.isArray(global.paths.sharedObjects) && global.paths.sharedObjects.length > 0) {
    let allDirs = {};

    /**
     * first require directories into objects by directory
     */
    global.paths.sharedObjects.forEach(function (itemPath){
      if (fs.existsSync(itemPath)){
        
        let dir = requireDir(itemPath, { camelcase: true });
        
        merge(allDirs, dir);
      }
    });
    /** if we managed to import some directories, expose them
     */
    if (Object.keys(allDirs).length > 0){
      /** expose globally
       * @type {{}}
       */
      global.shared = allDirs;
    }
  }

}

/**
 * export the "World" required by cucumber to allow it to expose methods within step def's
 */
module.exports = function () {
  this.World = World;

  /** set the default timeout for all tests
   */
  // this.setDefaultTimeout(DEFAULT_TIMEOUT);
  this.setDefaultTimeout(global.settings.defaultTimeout);

  /**
   * ALL CUCUMBER HOOKS
   */

  // start recording of the Test run time
  global.startDateTime = helpers.getStartDateTime();
  
  /**
   * create the driver before scenario if it's not instantiated
   */
  this.registerHandler('BeforeScenario', function () {
    if (!global.driver) {
      global.driver = getDriverInstance();
      global.browser = global.driver; // ensure standard WebDriver global also works
    }
    return driver;
  });

  /**
   * compile and generate a report at the END of the test run and send an Email
   */
  this.registerHandler('AfterFeatures', function (features, done) {

    if (global.paths.reports && fs.existsSync(global.paths.reports)) {
      global.endDateTime = helpers.getEndDateTime();
      let reportOptions = {
        theme: 'bootstrap',
        jsonFile: path.resolve(global.paths.reports, global.settings.reportName+ '-' + date + '.json'),
        output: path.resolve(global.paths.reports, global.settings.reportName+ '-' + date + '.html'),
        reportSuiteAsScenarios: true,
        launchReport: (!global.settings.disableReport),
        ignoreBadJsonFile: true,
        metadata: {
          'Test Started': startDateTime,
          'Test Completion': endDateTime,
          'Test Environment': 'DEVELOPMENT',
          'Platform': 'AWS Debian 9',
          'Executed': 'Remote'
        },
        brandTitle: reportName + '-' + date,
        name: projectName
      };
      reporter.generate(reportOptions);
      /**
       * send email with the report to stakeholders after test run
       */
      if (program.email) {
        return helpers.klassiEmail();
      }
      done();
    }
    
  });
  
  /**
   *  executed after each scenario (always closes the browser to ensure fresh tests)
   */
  this.After(async function (scenario) {
    if (remoteService){
      await remoteService.after(scenario);
    }
    if (scenario.isFailed() && remoteService) {
      /**
       * add a screenshot to the error report
       */
      let screenShot = await driver.saveScreenshot();
      await scenario.attach(new Buffer(screenShot, 'base64'), 'image/png');
      await driver.end();
    }
    await driver.end();
  });
  
};
