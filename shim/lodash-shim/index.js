'use strict';

/**
 * Aggregate export — supports require('lodash') style used by @okta/okta-sdk-nodejs.
 * Individual files support require('lodash/fn') style used by node-jose.
 */
const clone = require('./clone');
const uniq = require('./uniq');
const partialRight = require('./partialRight');
const merge = require('./merge');
const mergeWith = require('./mergeWith');
const omit = require('./omit');
const pick = require('./pick');
const assign = require('./assign');
const flatten = require('./flatten');
const intersection = require('./intersection');
const fill = require('./fill');
const get = require('./get');

module.exports = {
  clone,
  uniq,
  partialRight,
  merge,
  mergeWith,
  omit,
  pick,
  assign,
  flatten,
  intersection,
  fill,
  get,
};
