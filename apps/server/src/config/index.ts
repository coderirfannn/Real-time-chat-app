import 'dotenv/config';
import { loadServerConfig } from '@chatlock/config';

export const config = loadServerConfig();

export default config;
