/**
 * OpenAPI31Generator — generates OpenAPI 3.1 specification
 * from inferred API endpoints.
 */

import type { APIEndpoint, JSONSchema } from '../types';

export class OpenAPI31Generator {
  generate(endpoints: APIEndpoint[], info?: Partial<OpenAPIInfo>): OpenAPIDocument {
    const tags = this.collectTags(endpoints);
    const paths = this.buildPaths(endpoints);

    return {
      openapi: '3.1.0',
      info: {
        title: info?.title || 'API Documentation',
        version: info?.version || '1.0.0',
        description: info?.description || 'Auto-generated from visual page design',
      },
      servers: [
        {
          url: 'http://localhost:8080',
          description: 'Local development server',
        },
      ],
      tags: tags.map(t => ({ name: t, description: `${t} related endpoints` })),
      paths,
      components: {
        schemas: this.buildSchemas(endpoints),
      },
    };
  }

  private collectTags(endpoints: APIEndpoint[]): string[] {
    const tags = new Set<string>();
    for (const ep of endpoints) {
      for (const tag of ep.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags);
  }

  private buildPaths(endpoints: APIEndpoint[]): Record<string, any> {
    const paths: Record<string, any> = {};

    for (const ep of endpoints) {
      const path = this.toOpenAPIPath(ep.path);
      if (!paths[path]) paths[path] = {};

      const operation: any = {
        summary: ep.summary,
        description: ep.description,
        tags: ep.tags,
        operationId: this.toOperationId(ep),
        parameters: [],
        responses: {
          '200': {
            description: 'Successful response',
          },
        },
      };

      // Path parameters
      for (const param of ep.pathParams) {
        operation.parameters.push({
          name: param.name,
          in: 'path',
          required: true,
          schema: { type: param.type },
          description: param.description,
        });
      }

      // Query parameters
      for (const param of ep.queryParams) {
        operation.parameters.push({
          name: param.name,
          in: 'query',
          required: param.required,
          schema: { type: param.type },
          description: param.description,
        });
      }

      // Request body
      if (ep.requestSchema) {
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: this.convertSchema(ep.requestSchema),
            },
          },
        };
      }

      // Response body
      if (ep.responseSchema) {
        operation.responses['200'].content = {
          'application/json': {
            schema: this.convertSchema(ep.responseSchema),
          },
        };
      }

      paths[path][ep.method.toLowerCase()] = operation;
    }

    // Sort paths for consistent output
    const sorted: Record<string, any> = {};
    Object.keys(paths).sort().forEach(k => { sorted[k] = paths[k]; });

    return sorted;
  }

  private toOpenAPIPath(path: string): string {
    // Ensure path starts with /
    return path.startsWith('/') ? path : `/${path}`;
  }

  private toOperationId(ep: APIEndpoint): string {
    const parts = ep.path
      .replace(/^\/api\//, '')
      .replace(/[{}]/g, '')
      .split('/');
    const action = ep.method.toLowerCase();
    const resource = parts.join('_');
    return `${action}_${resource}`;
  }

  private convertSchema(schema: JSONSchema): any {
    const result: any = { type: schema.type };

    if (schema.properties) {
      result.properties = {};
      result.required = schema.required || [];
      for (const [key, prop] of Object.entries(schema.properties)) {
        const openapiProp: any = {
          type: prop.type,
          description: prop.description || '',
        };
        if (prop.format) openapiProp.format = prop.format;
        if (prop.example !== undefined) openapiProp.example = prop.example;
        if (prop.enum) openapiProp.enum = prop.enum;
        if (prop.items) openapiProp.items = this.convertSchema(prop.items);
        if (prop.properties) {
          openapiProp.properties = {};
          for (const [k, v] of Object.entries(prop.properties)) {
            openapiProp.properties[k] = {
              type: v.type,
              description: v.description || '',
            };
          }
        }
        result.properties[key] = openapiProp;
      }
    }

    if (schema.items) {
      result.items = this.convertSchema(schema.items);
    }

    if (schema.format) result.format = schema.format;
    if (schema.example !== undefined) result.example = schema.example;

    return result;
  }

  private buildSchemas(endpoints: APIEndpoint[]): Record<string, any> {
    const schemas: Record<string, any> = {};

    for (const ep of endpoints) {
      if (ep.requestSchema && ep.tags.length > 0) {
        const tag = ep.tags[0];
        const schemaName = `Create${capitalize(tag)}Request`;
        if (!schemas[schemaName]) {
          schemas[schemaName] = this.convertSchema(ep.requestSchema);
        }
      }
      if (ep.responseSchema && ep.tags.length > 0) {
        const tag = ep.tags[0];
        const schemaName = `${capitalize(tag)}Response`;
        if (!schemas[schemaName]) {
          schemas[schemaName] = this.convertSchema(ep.responseSchema);
        }
      }
    }

    return schemas;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface OpenAPIDocument {
  openapi: string;
  info: OpenAPIInfo;
  servers: OpenAPIServer[];
  tags: OpenAPITag[];
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
  };
}

export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
}

export interface OpenAPIServer {
  url: string;
  description?: string;
}

export interface OpenAPITag {
  name: string;
  description?: string;
}
