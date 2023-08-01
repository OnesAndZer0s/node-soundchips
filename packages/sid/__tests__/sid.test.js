'use strict';

const sid = require('..');
const assert = require('assert').strict;

assert.strictEqual(sid(), 'Hello from sid');
console.info('sid tests passed');
