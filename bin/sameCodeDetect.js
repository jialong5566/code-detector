#!/usr/bin/env node

const args = process.argv;
require('../dist/cjs/index').sameCodeDetect(args[2]);