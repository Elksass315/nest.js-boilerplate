import 'dotenv/config';
import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { validateEnvironment } from '../config/environment';
import { createDatabaseOptions } from './database-options';

const environment = validateEnvironment(process.env);

export default new DataSource(createDatabaseOptions(environment));
