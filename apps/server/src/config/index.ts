import path from 'node:path';
import dotenv from 'dotenv';
import { loadServerConfig } from '@chatlock/config';

// Load from local app directory first, then fallback to monorepo root
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = loadServerConfig();

export default config;
