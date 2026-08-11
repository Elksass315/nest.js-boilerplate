import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseArguments(argv) {
  const options = {
    dryRun: argv.includes('--dry-run'),
    http: argv.includes('--http'),
    persistence: argv.includes('--persistence'),
    root: process.cwd(),
  };
  const rootIndex = argv.indexOf('--root');
  if (rootIndex >= 0) {
    const root = argv[rootIndex + 1];
    if (!root) {
      throw new Error('--root requires a directory');
    }
    options.root = path.resolve(root);
  }

  const name = argv.find(
    (argument, index) => !argument.startsWith('--') && index !== rootIndex + 1,
  );
  if (!name || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error('Feature name must be lower-case kebab-case, for example "billing-plans"');
  }

  return { name, ...options };
}

function pascalCase(value) {
  return value
    .split('-')
    .map((segment) => `${segment[0].toUpperCase()}${segment.slice(1)}`)
    .join('');
}

function createFiles({ name, http, persistence }) {
  const className = pascalCase(name);
  const imports = [];
  const moduleImports = [];
  const providers = [`${className}Service`];
  const controllers = [];

  if (http) {
    imports.push(`import { ${className}Controller } from './${name}.controller';`);
    controllers.push(`${className}Controller`);
  }
  if (persistence) {
    imports.push("import { TypeOrmModule } from '@nestjs/typeorm';");
    imports.push(`import { ${className}Entity } from './entities/${name}.entity';`);
    imports.push(`import { ${className}Repository } from './${name}.repository';`);
    moduleImports.push(`TypeOrmModule.forFeature([${className}Entity])`);
    providers.push(`${className}Repository`);
  }

  const files = new Map();
  files.set(
    `${name}.module.ts`,
    `import { Module } from '@nestjs/common';\n${imports.join('\n')}\nimport { ${className}Service } from './${name}.service';\n\n@Module({\n  imports: [${moduleImports.join(', ')}],\n  controllers: [${controllers.join(', ')}],\n  providers: [${providers.join(', ')}],\n  exports: [${className}Service],\n})\nexport class ${className}Module {}\n`,
  );
  files.set(
    `${name}.service.ts`,
    `import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class ${className}Service {}\n`,
  );
  files.set(
    `${name}.service.spec.ts`,
    `import { ${className}Service } from './${name}.service';\n\ndescribe(${className}Service.name, () => {\n  it('is defined', () => {\n    expect(new ${className}Service()).toBeDefined();\n  });\n});\n`,
  );
  files.set(
    'index.ts',
    `export { ${className}Module } from './${name}.module';\nexport { ${className}Service } from './${name}.service';\n`,
  );

  if (http) {
    files.set(
      `${name}.controller.ts`,
      `import { Controller } from '@nestjs/common';\nimport { ApiTags } from '@nestjs/swagger';\n\nimport { ${className}Service } from './${name}.service';\n\n@ApiTags('${name}')\n@Controller('${name}')\nexport class ${className}Controller {\n  public constructor(_service: ${className}Service) {}\n}\n`,
    );
  }

  if (persistence) {
    files.set(
      `entities/${name}.entity.ts`,
      `import { CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';\n\n@Entity({ name: '${name.replaceAll('-', '_')}' })\nexport class ${className}Entity {\n  @PrimaryGeneratedColumn('uuid')\n  public id!: string;\n\n  @CreateDateColumn({ type: 'timestamptz' })\n  public createdAt!: Date;\n\n  @UpdateDateColumn({ type: 'timestamptz' })\n  public updatedAt!: Date;\n}\n`,
    );
    files.set(
      `${name}.repository.ts`,
      `import { Injectable } from '@nestjs/common';\nimport { InjectRepository } from '@nestjs/typeorm';\nimport type { Repository } from 'typeorm';\n\nimport { ${className}Entity } from './entities/${name}.entity';\n\n@Injectable()\nexport class ${className}Repository {\n  public constructor(\n    @InjectRepository(${className}Entity)\n    private readonly repository: Repository<${className}Entity>,\n  ) {}\n\n  public findById(id: string): Promise<${className}Entity | null> {\n    return this.repository.findOneBy({ id });\n  }\n}\n`,
    );
  }

  return files;
}

function run() {
  const options = parseArguments(process.argv.slice(2));
  const target = path.join(options.root, 'src', 'modules', options.name);
  if (existsSync(target)) {
    throw new Error(`Feature already exists: ${target}`);
  }

  const files = createFiles(options);
  if (options.dryRun) {
    process.stdout.write(`${[...files.keys()].join('\n')}\n`);
    return;
  }

  for (const [relativePath, contents] of files) {
    const destination = path.join(target, relativePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, contents, { encoding: 'utf8', flag: 'wx' });
  }

  process.stdout.write(`Created ${files.size} files in ${target}\n`);
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown scaffolding error';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
