import 'dotenv/config';
import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { loadDatabaseConfiguration } from '../config/environment';
import { createDatabaseOptions } from './database-options';

export default new DataSource(createDatabaseOptions(loadDatabaseConfiguration()));
