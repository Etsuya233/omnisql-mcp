import { DatabaseConnection } from './types.js';

/**
 * Resource URIs.
 *
 * Resources are a flat map of URI to readable content, so the tree a client
 * browses is a convention this module owns:
 *
 *   omnisql://connections
 *   omnisql://<connection>/schemas
 *   omnisql://<connection>/schemas/<schema>/tables
 *   omnisql://<connection>/schemas/<schema>/tables/<table>/schema
 *
 * Only the root is listed by `resources/list` together with one `/schemas`
 * entry per connection, which costs no database round trip. Everything below
 * that is discovered through `resources/templates/list` and read on demand,
 * so browsing never enumerates a whole catalogue up front.
 *
 * URIs are parsed as plain text rather than with `new URL()`, which lowercases
 * the authority: connection ids and names are matched case-sensitively, and a
 * DBeaver name may carry capitals.
 */
const SCHEME = 'omnisql://';

export type ResourceTarget =
  | { kind: 'connections' }
  | { kind: 'schemas'; connection: string }
  | { kind: 'tables'; connection: string; schema: string }
  | { kind: 'tableSchema'; connection: string; schema: string; table: string };

/** A connection as the root resource reports it, with the URI to browse it. */
export interface ConnectionSummary {
  id: string;
  name: string;
  driver: string;
  database?: string;
  host?: string;
  port?: number;
  readonly?: boolean;
  schemas: string;
}

const segment = (value: string): string => encodeURIComponent(value);

export function connectionsUri(): string {
  return `${SCHEME}connections`;
}

export function schemasUri(connectionId: string): string {
  return `${SCHEME}${segment(connectionId)}/schemas`;
}

export function tablesUri(connectionId: string, schema: string): string {
  return `${schemasUri(connectionId)}/${segment(schema)}/tables`;
}

export function tableSchemaUri(connectionId: string, schema: string, table: string): string {
  return `${tablesUri(connectionId, schema)}/${segment(table)}/schema`;
}

/**
 * Read a resource URI back into the target it names, or null when it names
 * nothing this server serves. Malformed escapes count as unserved: a client
 * that mangles a segment gets "not found" rather than a decoding error.
 */
export function parseResourceUri(uri: string): ResourceTarget | null {
  if (typeof uri !== 'string' || !uri.startsWith(SCHEME)) {
    return null;
  }

  let parts: string[];
  try {
    parts = uri.slice(SCHEME.length).split('/').map(decodeURIComponent);
  } catch {
    return null;
  }

  if (parts.some((part) => part.length === 0)) {
    return null;
  }

  const [connection, level, schema, childLevel, table, leaf] = parts;

  if (parts.length === 1 && connection === 'connections') {
    return { kind: 'connections' };
  }
  if (parts.length === 2 && level === 'schemas') {
    return { kind: 'schemas', connection };
  }
  if (parts.length === 4 && level === 'schemas' && childLevel === 'tables') {
    return { kind: 'tables', connection, schema };
  }
  if (parts.length === 6 && level === 'schemas' && childLevel === 'tables' && leaf === 'schema') {
    return { kind: 'tableSchema', connection, schema, table };
  }

  return null;
}

/**
 * The connection facts a browsing client needs, and nothing that identifies
 * itself to the database: no credentials, and no JDBC URL, which may carry
 * them inline.
 */
export function connectionSummary(connection: DatabaseConnection): ConnectionSummary {
  return {
    id: connection.id,
    name: connection.name,
    driver: connection.driverId ?? connection.driver,
    database: connection.database,
    host: connection.host,
    port: connection.port,
    readonly: connection.readonly,
    schemas: schemasUri(connection.id),
  };
}
