#!/usr/bin/env node
import dotenv from 'dotenv';
import { rawServerEnvSchema, rawMobileEnvSchema } from '../packages/config/dist/index.js';

dotenv.config();

// eslint-disable-next-line no-console
console.log('Validating Server Environment Configuration...');
const serverResult = rawServerEnvSchema.safeParse(process.env);
if (!serverResult.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Server environment validation failed:');
  for (const err of serverResult.error.errors) {
    // eslint-disable-next-line no-console
    console.error(`  - ${err.path.join('.')}: ${err.message}`);
  }
  process.exit(1);
}
// eslint-disable-next-line no-console
console.log('✅ Server environment is valid.');

// eslint-disable-next-line no-console
console.log('Validating Mobile Environment Configuration...');
const mobileResult = rawMobileEnvSchema.safeParse(process.env);
if (!mobileResult.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Mobile environment validation failed:');
  for (const err of mobileResult.error.errors) {
    // eslint-disable-next-line no-console
    console.error(`  - ${err.path.join('.')}: ${err.message}`);
  }
  process.exit(1);
}
// eslint-disable-next-line no-console
console.log('✅ Mobile environment is valid.');
