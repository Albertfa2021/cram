'use strict';

const defaultResolver = require('jest-resolve/build/default_resolver').default;

module.exports = function resolver(request, options) {
  return defaultResolver(request, options);
};
