/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 * @private
 */

var debug = require('debug')('express:view');
var path = require('node:path');
var fs = require('node:fs');

/**
 * Module variables.
 * @private
 */

var dirname = path.dirname;
var basename = path.basename;
var extname = path.extname;
var join = path.join;
var resolve = path.resolve;

/**
 * Module exports.
 * @public
 */

module.exports = View;

/**
 * Initialize a new `View` with the given `name`.
 *
 * Options:
 *
 *   - `defaultEngine` the default template engine name
 *   - `engines` template engine require() cache
 *   - `root` root path for view lookup
 *
 * @param {string} name
 * @param {object} options
 * @public
 */

function View(name, options) {
  var opts = options || {};

  this.defaultEngine = opts.defaultEngine;
  this.name = name;
  this.root = opts.root;

  var fileName = name;
  var ext = extname(name);

  if (!ext) {
    if (!this.defaultEngine) {
      throw new Error('No default engine was specified and no extension was provided.');
    }

    // get extension from default engine name
    ext = View.extension(this.defaultEngine);
    fileName += ext;
  }

  this.ext = ext;

  // resolve the engine (and lazily load it) up front so the cache key can
  // include the exact function used to render
  View.resolveEngine(ext, opts.engines);

  // store loaded engine
  this.engine = opts.engines[ext];

  // lookup path
  this.path = this.lookup(fileName);
}

/**
 * Normalize an engine name to its file extension.
 *
 * @param {string} engine
 * @return {string}
 * @private
 */

View.extension = function extension(engine) {
  if (!engine) {
    return undefined;
  }

  return engine[0] !== '.'
    ? '.' + engine
    : engine;
};

/**
 * Resolve the engine for the given `ext`, lazily requiring and registering
 * it in `engines` when needed. Returns the resolved engine function.
 *
 * @param {string} ext
 * @param {object} engines
 * @return {function}
 * @private
 */

View.resolveEngine = function resolveEngine(ext, engines) {
  var fn = engines[ext];

  if (!fn) {
    // load engine
    var mod = ext.slice(1);
    debug('require "%s"', mod);

    // default engine export
    fn = require(mod).__express;

    if (typeof fn !== 'function') {
      throw new Error('Module "' + mod + '" does not provide a view engine.');
    }

    engines[ext] = fn;
  }

  return fn;
};

/**
 * Lookup view by the given `name`
 *
 * @param {string} name
 * @private
 */

View.prototype.lookup = function lookup(name) {
  var path;
  var roots = [].concat(this.root);

  debug('lookup "%s"', name);

  for (var i = 0; i < roots.length && !path; i++) {
    var root = roots[i];

    // resolve the path
    var loc = resolve(root, name);
    var dir = dirname(loc);
    var file = basename(loc);

    // resolve the file
    path = this.resolve(dir, file);
  }

  return path;
};

/**
 * Render with the given options.
 *
 * @param {object} options
 * @param {function} callback
 * @private
 */

View.prototype.render = function render(options, callback) {
  var sync = true;

  debug('render "%s"', this.path);

  // render, normalizing sync callbacks
  this.engine(this.path, options, function onRender() {
    if (!sync) {
      return callback.apply(this, arguments);
    }

    // copy arguments
    var args = new Array(arguments.length);
    var cntx = this;

    for (var i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }

    // force callback to be async
    return process.nextTick(function renderTick() {
      return callback.apply(cntx, args);
    });
  });

  sync = false;
};

/**
 * Resolve the file within the given directory.
 *
 * @param {string} dir
 * @param {string} file
 * @private
 */

View.prototype.resolve = function resolve(dir, file) {
  var ext = this.ext;

  // <path>.<ext>
  var path = join(dir, file);
  var stat = tryStat(path);

  if (stat && stat.isFile()) {
    return path;
  }

  // <path>/index.<ext>
  path = join(dir, basename(file, ext), 'index' + ext);
  stat = tryStat(path);

  if (stat && stat.isFile()) {
    return path;
  }
};

/**
 * Return a stat, maybe.
 *
 * @param {string} path
 * @return {fs.Stats}
 * @private
 */

function tryStat(path) {
  debug('stat "%s"', path);

  try {
    return fs.statSync(path);
  } catch (e) {
    return undefined;
  }
}
