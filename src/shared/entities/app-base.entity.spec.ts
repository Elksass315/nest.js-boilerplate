import { getMetadataArgsStorage } from 'typeorm';

import { AppBaseEntity, SoftDeleteEntity } from './app-base.entity';

describe('base entity metadata', () => {
  it('defines UUID identity and timestamptz audit columns', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      ({ target }) => target === AppBaseEntity || target === SoftDeleteEntity,
    );

    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ propertyName: 'id', mode: 'regular' }),
        expect.objectContaining({ propertyName: 'createdAt', mode: 'createDate' }),
        expect.objectContaining({ propertyName: 'updatedAt', mode: 'updateDate' }),
        expect.objectContaining({ propertyName: 'deletedAt', mode: 'deleteDate' }),
      ]),
    );
    expect(columns.find(({ propertyName }) => propertyName === 'id')?.options).toEqual(
      expect.objectContaining({ type: 'uuid', primary: true }),
    );
    expect(columns.find(({ propertyName }) => propertyName === 'createdAt')?.options).toEqual(
      expect.objectContaining({ name: 'created_at', type: 'timestamptz' }),
    );
    expect(columns.find(({ propertyName }) => propertyName === 'updatedAt')?.options).toEqual(
      expect.objectContaining({ name: 'updated_at', type: 'timestamptz' }),
    );
    expect(columns.find(({ propertyName }) => propertyName === 'deletedAt')?.options).toEqual(
      expect.objectContaining({ name: 'deleted_at', type: 'timestamptz' }),
    );
  });
});
