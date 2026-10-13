import { describe, it, expect } from 'vitest';
import {
  connectionSummary,
  connectionsUri,
  parseResourceUri,
  schemasUri,
  tableSchemaUri,
  tablesUri,
} from '../src/resources.js';
import { DatabaseConnection } from '../src/types.js';

describe('resource URIs', () => {
  it('builds every level of the tree', () => {
    expect(connectionsUri()).toBe('omnisql://connections');
    expect(schemasUri('dev-01')).toBe('omnisql://dev-01/schemas');
    expect(tablesUri('dev-01', 'shop')).toBe('omnisql://dev-01/schemas/shop/tables');
    expect(tableSchemaUri('dev-01', 'shop', 'orders')).toBe(
      'omnisql://dev-01/schemas/shop/tables/orders/schema'
    );
  });

  it('parses a built URI back into the target it names', () => {
    expect(parseResourceUri(connectionsUri())).toEqual({ kind: 'connections' });
    expect(parseResourceUri(schemasUri('dev-01'))).toEqual({
      kind: 'schemas',
      connection: 'dev-01',
    });
    expect(parseResourceUri(tablesUri('dev-01', 'shop'))).toEqual({
      kind: 'tables',
      connection: 'dev-01',
      schema: 'shop',
    });
    expect(parseResourceUri(tableSchemaUri('dev-01', 'shop', 'orders'))).toEqual({
      kind: 'tableSchema',
      connection: 'dev-01',
      schema: 'shop',
      table: 'orders',
    });
  });

  it('survives segment names that would otherwise reshape the path', () => {
    const connection = 'Dev Box/eu-west';
    const schema = 'my db';
    const table = '订单/明细 100%';

    const uri = tableSchemaUri(connection, schema, table);

    expect(uri).toBe(
      'omnisql://Dev%20Box%2Feu-west/schemas/my%20db/tables/%E8%AE%A2%E5%8D%95%2F%E6%98%8E%E7%BB%86%20100%25/schema'
    );
    expect(parseResourceUri(uri)).toEqual({
      kind: 'tableSchema',
      connection,
      schema,
      table,
    });
  });

  it('keeps connection ids case-sensitive, which a URL would not', () => {
    expect(parseResourceUri(schemasUri('MSSQL_Prod'))).toEqual({
      kind: 'schemas',
      connection: 'MSSQL_Prod',
    });
  });

  it('rejects URIs that name nothing it serves', () => {
    for (const uri of [
      '',
      'https://example.com/connections',
      'omnisql://connections/extra',
      'omnisql://dev-01',
      // The flat table listing this server used to expose.
      'omnisql://dev-01/orders/schema',
      'omnisql://dev-01/schemas/shop',
      'omnisql://dev-01/schemas/shop/tables/orders',
      'omnisql://dev-01/schemas/shop/tables/orders/columns',
      'omnisql://dev-01/schemas//tables',
      'omnisql://dev-01/schemas/shop/tables/',
      'omnisql:///schemas',
      'omnisql://dev-01/schemas/shop/tables/orders%2/schema',
    ]) {
      expect(parseResourceUri(uri), uri).toBeNull();
    }
  });
});

describe('connectionSummary', () => {
  it('reports how to browse the connection without identifying itself to the database', () => {
    const connection = {
      id: 'dev-01',
      name: 'Dev',
      driver: 'mysql',
      driverId: 'mysql8',
      url: 'jdbc:mysql://root:hunter2@db.internal:3306/shop',
      user: 'root',
      host: 'db.internal',
      port: 3306,
      database: 'shop',
      readonly: true,
      properties: { password: 'hunter2' },
      sshTunnel: { host: 'bastion', user: 'ops', password: 'hunter2' },
    } as unknown as DatabaseConnection;

    const summary = connectionSummary(connection);

    expect(summary).toEqual({
      id: 'dev-01',
      name: 'Dev',
      driver: 'mysql8',
      database: 'shop',
      host: 'db.internal',
      port: 3306,
      readonly: true,
      schemas: 'omnisql://dev-01/schemas',
    });
    expect(JSON.stringify(summary)).not.toContain('hunter2');
    expect(JSON.stringify(summary)).not.toContain('jdbc:');
  });
});
