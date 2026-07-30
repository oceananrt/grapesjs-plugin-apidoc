/**
 * MockDataGenerator — generates realistic mock data
 * for each inferred API endpoint based on the schema.
 */

import type { APIEndpoint, JSONSchema, JSONSchemaProperty } from '../types';

export interface MockData {
  [endpointKey: string]: {
    description: string;
    request?: any;
    response: any;
  };
}

export class MockDataGenerator {
  generate(endpoints: APIEndpoint[]): MockData {
    const mocks: MockData = {};

    for (const ep of endpoints) {
      const key = `${ep.method} ${ep.path}`;
      const entry: MockData[string] = {
        description: ep.summary,
        response: ep.responseSchema
          ? this.generateMockFromSchema(ep.responseSchema)
          : { code: 200, message: 'ok' },
      };

      if (ep.requestSchema) {
        entry.request = this.generateMockFromSchema(ep.requestSchema);
      }

      mocks[key] = entry;
    }

    return mocks;
  }

  private generateMockFromSchema(schema: JSONSchema): any {
    if (schema.example !== undefined) return schema.example;

    switch (schema.type) {
      case 'object':
        return this.generateObjectMock(schema);
      case 'array':
        return this.generateArrayMock(schema);
      case 'string':
        return this.generateStringMock(schema);
      case 'number':
      case 'integer':
        return this.generateNumberMock(schema);
      case 'boolean':
        return schema.example ?? true;
      default:
        return null;
    }
  }

  private generateObjectMock(schema: JSONSchema): Record<string, any> {
    const obj: Record<string, any> = {};

    if (!schema.properties) return obj;

    for (const [key, prop] of Object.entries(schema.properties)) {
      if (prop.example !== undefined) {
        obj[key] = prop.example;
      } else if (prop.enum && prop.enum.length > 0) {
        obj[key] = prop.enum[0];
      } else {
        obj[key] = this.generateValueForProp(key, prop);
      }
    }

    return obj;
  }

  private generateArrayMock(schema: JSONSchema): any[] {
    if (!schema.items) return [];
    const item = this.generateMockFromSchema(schema.items);
    return [item, item]; // Generate 2 items as sample
  }

  private generateStringMock(schema: JSONSchema): string {
    if (schema.format === 'email') return 'user@example.com';
    if (schema.format === 'date-time') return new Date().toISOString();
    if (schema.format === 'date') return new Date().toISOString().split('T')[0];
    if (schema.format === 'uri') return 'https://example.com';
    if (schema.format === 'password') return '******';
    if (schema.enum && schema.enum.length > 0) return schema.enum[0];
    return '示例文本';
  }

  private _mockCounter = 0;

  private generateNumberMock(_schema: JSONSchema): number {
    this._mockCounter++;
    return this._mockCounter;
  }

  private generateValueForProp(key: string, prop: JSONSchemaProperty): any {
    // Use the key name to generate more realistic mock values
    const lower = key.toLowerCase();

    if (lower === 'id' || lower.endsWith('id')) return 1;
    if (lower === 'username' || lower === 'name') return '张三';
    if (lower === 'email') return 'zhangsan@example.com';
    if (lower === 'phone' || lower === 'mobile') return '13800138000';
    if (lower === 'role') return '管理员';
    if (lower === 'status') return 1;
    if (lower === 'createdat' || lower === 'updatedat') return new Date().toISOString();
    if (lower === 'code') return 200;
    if (lower === 'message') return 'ok';
    if (lower === 'total') return 100;
    if (lower === 'page') return 1;
    if (lower === 'pagesize') return 20;
    if (lower === 'count') return 50;
    if (lower === 'amount' || lower === 'price') return 99.99;
    if (lower === 'avatar') return 'https://via.placeholder.com/150';
    if (lower === 'title') return '示例标题';
    if (lower === 'content' || lower === 'description' || lower === 'remark') return '这是一段示例内容...';

    if (prop.type === 'number' || prop.type === 'integer') return 1;
    if (prop.type === 'boolean') return true;
    if (prop.type === 'string') return '示例文本';

    return null;
  }
}
