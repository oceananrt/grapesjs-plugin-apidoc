/**
 * Shared type definitions for the API Doc plugin.
 */

/** Raw info extracted from a canvas component */
export interface ComponentInfo {
  id: string;
  tagName: string;
  type: string;
  traits: TraitInfo[];
  attributes: Record<string, string>;
  content: string;
  parentType: string | null;
  children: ComponentInfo[];
  /** The text label near the component, if any */
  label: string | null;
}

export interface TraitInfo {
  name: string;
  type: string;
  value: any;
  label?: string;
}

/** Inferred REST API endpoint */
export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  tags: string[];
  requestSchema: JSONSchema | null;
  responseSchema: JSONSchema | null;
  queryParams: QueryParam[];
  pathParams: PathParam[];
  /** Which canvas component IDs contributed to this inference */
  sources: string[];
}

export interface QueryParam {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description: string;
}

export interface PathParam {
  name: string;
  type: 'string' | 'number';
  description: string;
}

/** Simplified JSON Schema (subset of OpenAPI 3.1) */
export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  items?: JSONSchema;
  enum?: string[];
  format?: string;
  example?: any;
}

export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  format?: 'email' | 'date' | 'date-time' | 'uri' | 'password';
  example?: any;
  enum?: string[];
  required?: boolean;
  items?: JSONSchema;
  properties?: Record<string, JSONSchemaProperty>;
}
