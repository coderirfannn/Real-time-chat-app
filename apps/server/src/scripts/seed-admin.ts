/* eslint-disable no-console */
import { connectMongo, disconnectMongo } from '../database/connection.js';
import { bootstrapDefaultAdmin, DEFAULT_ADMIN } from '../database/bootstrap-admin.js';

async function main() {
  console.log('[SeedAdmin] Connecting to MongoDB...');
  await connectMongo();

  try {
    console.log(`[SeedAdmin] Seeding default admin (${DEFAULT_ADMIN.email})...`);
    await bootstrapDefaultAdmin();
    console.log('[SeedAdmin] Default admin successfully verified and seeded!');
    console.log(`[SeedAdmin] Credentials:`);
    console.log(`            Email:    ${DEFAULT_ADMIN.email}`);
    console.log(`            Password: ${DEFAULT_ADMIN.password}`);
    console.log(`            Role:     ADMIN`);
    console.log(`            Status:   ACTIVE`);
  } finally {
    await disconnectMongo();
  }
}

main().catch((err) => {
  console.error('[SeedAdmin] Fatal error:', err);
  process.exit(1);
});
