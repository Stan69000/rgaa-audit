// src/logger.js
'use strict';

const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const log     = (...a) => console.log(c.dim + a.join(' ') + c.reset);
const success = (...a) => console.log(c.green + a.join(' ') + c.reset);
const warn    = (...a) => console.log(c.yellow + a.join(' ') + c.reset);
const error   = (...a) => console.error(c.red + a.join(' ') + c.reset);

module.exports = { log, success, warn, error };
