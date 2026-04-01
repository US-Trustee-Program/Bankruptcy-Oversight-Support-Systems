'use strict';

/**
 * Alias for merge — the customizer is passed as 3rd argument in both cases.
 * Provided as a separate module so require('lodash/mergeWith') works.
 */
const merge = require('./merge');

module.exports = merge;
