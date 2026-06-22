#!/usr/bin/env node
/**
 * Lint script to prevent re-introduction of handler decomposition anti-patterns.
 * Run: node scripts/lint-handler-patterns.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const handlersDir = path.join(__dirname, '../src/handlers');
const handlerFiles = fs.readdirSync(handlersDir)
  .filter(f => f.endsWith('-message-handler.js'))
  .map(f => path.join(handlersDir, f));

let errorCount = 0;

// Rule 1: Handlers should not re-implement session guard
console.log('🔍 Checking for per-handler session guards...');
handlerFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('hasValidSessionAsync') && content.includes('INVALID_SESSION')) {
    console.error(`❌ ${path.basename(file)}: Found per-handler session guard (should use registry)`);
    errorCount++;
  }
});

// Rule 2: Handlers should not directly import/use spatial math utils (should use handler-utils)
console.log('🔍 Checking for inlined spatial utilities...');
handlerFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Check if file does own finite/triple checks without using handler-utils
  if (!content.includes('handler-utils') && 
      (content.match(/Number\.isFinite/g) || content.match(/\.length === 3/g))) {
    console.warn(`⚠️  ${path.basename(file)}: Uses spatial checks; consider using handler-utils`);
  }
});

// Rule 3: Correlation metadata should be handled consistently
console.log('🔍 Checking for correlation metadata patterns...');
const bustHandlers = handlerFiles.filter(f => f.includes('-bust-'));
bustHandlers.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Should use bust-lifecycle for correlation
  if (!content.includes('bust-lifecycle')) {
    console.warn(`⚠️  ${path.basename(file)}: Bust handler should use bust-lifecycle utility`);
  }
});

// Rule 4: Market handlers should consolidate transaction logic
console.log('🔍 Checking market handlers for duplicated transaction logic...');
const marketHandlers = handlerFiles.filter(f => f.includes('market-'));
const marketBuySell = marketHandlers.filter(f => f.includes('buy') || f.includes('sell'));
if (marketBuySell.length > 1) {
  // Just a warning—consolidation is already done via buildMarketTransactionResponse
  console.log(`ℹ️  ${marketBuySell.length} market buy/sell handlers (should use market-transaction-utils)`);
}

// Rule 5: Handler scope check—no db access, just context delegation
console.log('🔍 Checking handler scope...');
handlerFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('require(\'../db/') && !content.includes('context')) {
    console.warn(`⚠️  ${path.basename(file)}: Direct db require (should use context delegation)`);
  }
});

console.log('');
if (errorCount > 0) {
  console.error(`\n❌ Found ${errorCount} critical lint issue(s)`);
  process.exit(1);
} else {
  console.log('✅ No critical handler pattern violations detected');
  process.exit(0);
}
