'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build, OUT } = require('../../engine/build');

test('extension/shared/rgaa-rules.js correspond à engine/src (npm run build:engine)', () => {
  assert.equal(fs.readFileSync(OUT, 'utf8'), build());
});
