import 'dotenv/config';

import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';

import argon2 from 'argon2';
import { DataSource } from 'typeorm';

import { loadDatabaseConfiguration } from '@/config/environment';

import { createDatabaseOptions } from './database-options';

const MIN_PASSWORD_LENGTH = 12;

async function ask(question: string): Promise<string> {
  const readline = createInterface({ input, output });
  try {
    return (
      await new Promise<string>((resolve) => {
        readline.question(question, (answer) => {
          resolve(answer);
        });
      })
    ).trim();
  } finally {
    readline.close();
  }
}

async function askPassword(): Promise<string> {
  if (!input.isTTY || !output.isTTY) {
    throw new Error('Interactive terminal required; password input must not be piped');
  }

  output.write('Password: ');
  input.setRawMode(true);
  input.resume();
  return new Promise<string>((resolve, reject) => {
    let password = '';
    const onData = (chunk: Buffer): void => {
      const value = chunk.toString('utf8');
      if (value === '\r' || value === '\n') {
        input.setRawMode(false);
        input.pause();
        input.off('data', onData);
        output.write('\n');
        resolve(password);
        return;
      }
      if (value === '\u0003') {
        input.setRawMode(false);
        input.pause();
        input.off('data', onData);
        reject(new Error('Cancelled'));
        return;
      }
      if (value === '\u007f') {
        password = password.slice(0, -1);
        return;
      }
      password += value;
    };
    input.on('data', onData);
  });
}

async function main(): Promise<void> {
  const fullName = await ask('Full name: ');
  const email = (await ask('Email: ')).toLowerCase();
  const password = await askPassword();
  const passwordConfirmation = await askPasswordConfirmation();

  if (fullName.length < 2 || fullName.length > 160) {
    throw new Error('Full name must be between 2 and 160 characters');
  }
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) {
    throw new Error('Email address is invalid');
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
    throw new Error(`Password must be between ${String(MIN_PASSWORD_LENGTH)} and 128 characters`);
  }
  if (password !== passwordConfirmation) {
    throw new Error('Passwords do not match');
  }

  const dataSource = new DataSource(createDatabaseOptions(loadDatabaseConfiguration()));
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      const existingSuperAdmin = await manager.query<{ id: string }[]>(
        `SELECT u.id
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN authorization_roles r ON r.id = ur.role_id
         WHERE r.key = 'super_admin' AND u.status = 'active'
         LIMIT 1`,
      );
      if (existingSuperAdmin.length > 0) {
        throw new Error('An active super-admin already exists; bootstrap is disabled');
      }

      const existingUser = await manager.query<{ id: string }[]>(
        'SELECT id FROM users WHERE normalized_email = $1 LIMIT 1',
        [email],
      );
      if (existingUser.length > 0) {
        throw new Error('A user with this email already exists; bootstrap will not modify it');
      }

      const roleRows = await manager.query<{ id: string }[]>(
        "SELECT id FROM authorization_roles WHERE key = 'super_admin' LIMIT 1",
      );
      const superAdminRole = roleRows[0];
      if (!superAdminRole) {
        throw new Error('The super_admin role is missing; run pnpm seed:run first');
      }

      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      });
      const userRows = await manager.query<{ id: string }[]>(
        `INSERT INTO users
          (full_name, email, normalized_email, password_hash, status, email_verified_at,
           email_two_step_enabled, auth_version, failed_login_count)
         VALUES ($1, $2, $2, $3, 'active', CURRENT_TIMESTAMP, true, 1, 0)
         RETURNING id`,
        [fullName, email, passwordHash],
      );
      const userId = userRows[0]?.id;
      if (!userId) throw new Error('Failed to create the bootstrap user');

      await manager.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
        userId,
        superAdminRole.id,
      ]);
      await manager.query(
        `INSERT INTO user_security_audits
          (user_id, actor_user_id, event_type, request_id, correlation_id, metadata)
         VALUES ($1, NULL, 'user.created', NULL, NULL, $2::jsonb)`,
        [userId, JSON.stringify({ source: 'auth:bootstrap-admin' })],
      );
      output.write(`Created super-admin ${email} (${userId})\n`);
    });
  } finally {
    await dataSource.destroy();
  }
}

async function askPasswordConfirmation(): Promise<string> {
  if (!input.isTTY || !output.isTTY) {
    throw new Error('Interactive terminal required; password input must not be piped');
  }
  output.write('Confirm password: ');
  input.setRawMode(true);
  input.resume();
  return new Promise<string>((resolve, reject) => {
    let password = '';
    const onData = (chunk: Buffer): void => {
      const value = chunk.toString('utf8');
      if (value === '\r' || value === '\n') {
        input.setRawMode(false);
        input.pause();
        input.off('data', onData);
        output.write('\n');
        resolve(password);
        return;
      }
      if (value === '\u0003') {
        input.setRawMode(false);
        input.pause();
        input.off('data', onData);
        reject(new Error('Cancelled'));
        return;
      }
      if (value === '\u007f') {
        password = password.slice(0, -1);
        return;
      }
      password += value;
    };
    input.on('data', onData);
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Bootstrap failed';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
