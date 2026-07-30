/**
 * TableAnalyzer — detects <table> components on the canvas
 * and infers GET /api/{resource} list endpoints with field schemas.
 */

import type { ComponentInfo, APIEndpoint, JSONSchema, JSONSchemaProperty } from '../types';
import { inferResourceName, columnToFieldName } from '../utils/NameInferrer';

export class TableAnalyzer {
  /**
   * Analyze table components and generate API endpoints.
   */
  analyze(tables: ComponentInfo[]): APIEndpoint[] {
    const endpoints: APIEndpoint[] = [];

    for (const table of tables) {
      // Extract column names from <thead> → <th>
      const columns = this.extractColumns(table);
      if (columns.length === 0) continue;

      // Infer resource name from table context
      const resourceName = inferResourceName(table, 'list');
      const tag = this.inferTag(table);

      // Build response schema (list of objects)
      const properties: Record<string, JSONSchemaProperty> = {};
      for (const col of columns) {
        const name = columnToFieldName(col.name);
        properties[name] = {
          type: col.inferredType,
          description: col.name,
        };
        if (col.inferredType === 'string' && (col.name.includes('时间') || col.name.includes('date'))) {
          properties[name].format = 'date-time';
        }
      }

      const responseSchema: JSONSchema = {
        type: 'object',
        properties: {
          code: { type: 'integer', description: '状态码', example: 200 },
          message: { type: 'string', description: '响应消息', example: 'ok' },
          data: {
            type: 'object',
            properties: {
              list: {
                type: 'array',
                items: { type: 'object', properties },
              },
              total: { type: 'integer', description: '总数', example: 100 },
              page: { type: 'integer', description: '当前页', example: 1 },
              pageSize: { type: 'integer', description: '每页条数', example: 20 },
            },
          },
        },
      };

      // Check for action buttons inside/around the table
      const rowActions = this.findRowActions(table);

      endpoints.push({
        method: 'GET',
        path: `/api/${resourceName}`,
        summary: `获取${cleanTag(tag)}列表`,
        description: `查询${cleanTag(tag)}列表，支持分页`,
        tags: [tag],
        requestSchema: null,
        responseSchema,
        queryParams: [
          { name: 'page', type: 'number', required: false, description: '页码' },
          { name: 'pageSize', type: 'number', required: false, description: '每页条数' },
          { name: 'keyword', type: 'string', required: false, description: '搜索关键词' },
        ],
        pathParams: [],
        sources: [table.id],
      });

      // If we find action buttons, create detail/update/delete endpoints
      const detailEndpoints = this.createDetailEndpoints(resourceName, tag, table.id, properties, rowActions);
      endpoints.push(...detailEndpoints);
    }

    return endpoints;
  }

  private extractColumns(table: ComponentInfo): ColumnInfo[] {
    const columns: ColumnInfo[] = [];

    // Look for <thead> → <tr> → <th>
    const thead = table.children.find(c => c.tagName === 'thead');
    let headerCells: ComponentInfo[] = [];

    if (thead) {
      // thead contains <tr> rows; find first row, then its <th> cells
      const headerRow = thead.children.find(c => c.tagName === 'tr');
      headerCells = headerRow
        ? headerRow.children.filter(c => c.tagName === 'th' || c.type === 'cell')
        : [];
    } else {
      // No thead — try the first direct <tr> child of table
      const firstRow = table.children.find(c => c.tagName === 'tr');
      headerCells = firstRow
        ? firstRow.children.filter(c => c.tagName === 'th' || c.type === 'cell')
        : [];
    }

    for (const cell of headerCells) {
      const name = cell.content || cell.label || '';
      if (!name) continue;
      columns.push({
        name,
        inferredType: this.inferColumnType(name),
      });
    }

    // Fallback: if header cells not found, try from first tbody/table row
    if (columns.length === 0) {
      const tbody = table.children.find(c => c.tagName === 'tbody');
      let firstRow: ComponentInfo | undefined;
      if (tbody) {
        firstRow = tbody.children.find(c => c.tagName === 'tr');
      } else {
        // No tbody — rows may be direct children of table
        firstRow = table.children.find(c => c.tagName === 'tr');
      }
      if (firstRow) {
        const cells = firstRow.children.filter(c => c.tagName === 'td' || c.type === 'cell');
        for (const cell of cells) {
          const name = cell.content || '';
          if (!name || name.length > 30) continue;
          // Filter out obvious data values (not header names)
          if (looksLikeData(name)) continue;
          columns.push({ name, inferredType: 'string' });
        }
      }
    }

    return columns;
  }

  private inferColumnType(colName: string): 'string' | 'number' | 'boolean' {
    const lower = colName.toLowerCase();
    if (lower.includes('id') || lower.includes('序号') || lower.includes('数量') || lower.includes('金额') || lower.includes('价格') || lower.includes('年龄') || lower.includes('num')) {
      return 'number';
    }
    if (lower.includes('是否') || (lower.includes('状态') && !lower.includes('名称'))) {
      return 'boolean';
    }
    return 'string';
  }


  private inferTag(table: ComponentInfo): string {
    // Try to find a heading/title above the table
    if (table.label) return table.label;
    // Check the table's id or attributes
    const attrs = table.attributes;
    if (attrs['id']) return attrs['id'];
    if (attrs['data-table']) return attrs['data-table'];
    return '数据';
  }

  private findRowActions(table: ComponentInfo): RowAction[] {
    const actions: RowAction[] = [];

    // Find data rows: check tbody → rows, or direct rows on table
    const tbody = table.children.find(c => c.tagName === 'tbody');
    const rows: ComponentInfo[] = tbody
      ? tbody.children.filter(c => c.tagName === 'tr')
      : table.children.filter(c => c.tagName === 'tr');

    for (const row of rows) {
      for (const cell of row.children) {
        // Look for buttons/links inside cells
        for (const child of cell.children) {
          if (child.tagName === 'a' || child.tagName === 'button') {
            const action = this.detectAction(child);
            if (action) actions.push(action);
          }
        }
      }
    }

    return actions;
  }

  /** Detect CRUD action from a button/link element using text, title, aria-label, and icon classes */
  private detectAction(el: ComponentInfo): RowAction | null {
    // Build a combined semantic string from multiple sources
    const signals: string[] = [];
    if (el.content) signals.push(el.content);
    if (el.attributes['title']) signals.push(el.attributes['title']);
    if (el.attributes['aria-label']) signals.push(el.attributes['aria-label']);
    if (el.attributes['data-action']) signals.push(el.attributes['data-action']);

    // Also check class names and children's class names for icon hints
    const allClasses = this.collectClasses(el);
    signals.push(...allClasses);

    const combined = signals.join(' ').toLowerCase();

    // Check delete BEFORE edit (avoid "delete" substring matching "edit")
    if (/\bdelete\b|删除|移除|remove|trash|fa-trash|icon-delete|bi-trash/i.test(combined)) {
      return { type: 'delete', label: el.content || el.attributes['title'] || el.attributes['aria-label'] || '删除' };
    }
    if (/\bedit\b|编辑|修改|modify|pencil|fa-edit|icon-edit|bi-pencil/i.test(combined)) {
      return { type: 'edit', label: el.content || el.attributes['title'] || el.attributes['aria-label'] || '编辑' };
    }
    if (/查看|详情|\bview\b|detail|eye|fa-eye|icon-view|bi-eye|预览|preview/i.test(combined)) {
      return { type: 'detail', label: el.content || el.attributes['title'] || el.attributes['aria-label'] || '查看' };
    }
    return null;
  }

  /** Recursively collect CSS class names from a component and its children */
  private collectClasses(comp: ComponentInfo): string[] {
    const classes: string[] = [];
    const cl = comp.attributes['class'];
    if (cl) classes.push(cl);
    for (const child of comp.children) {
      classes.push(...this.collectClasses(child));
    }
    return classes;
  }

  private createDetailEndpoints(
    resourceName: string,
    tag: string,
    sourceId: string,
    properties: Record<string, JSONSchemaProperty>,
    actions: RowAction[],
  ): APIEndpoint[] {
    const endpoints: APIEndpoint[] = [];
    const actionTypes = new Set(actions.map(a => a.type));
    const t = cleanTag(tag);

    // GET /api/{resource}/:id — detail
    if (actionTypes.has('detail') || actionTypes.has('edit')) {
      endpoints.push({
        method: 'GET',
        path: `/api/${resourceName}/{id}`,
        summary: `获取${t}详情`,
        description: `根据ID查询${t}详细信息`,
        tags: [tag],
        requestSchema: null,
        responseSchema: {
          type: 'object',
          properties: {
            code: { type: 'integer', description: '状态码', example: 200 },
            message: { type: 'string', example: 'ok' },
            data: { type: 'object', properties },
          },
        },
        queryParams: [],
        pathParams: [{ name: 'id', type: 'number', description: `${t}ID` }],
        sources: [sourceId],
      });
    }

    // PUT /api/{resource}/:id — update
    if (actionTypes.has('edit')) {
      endpoints.push({
        method: 'PUT',
        path: `/api/${resourceName}/{id}`,
        summary: `更新${t}`,
        description: `修改${t}信息`,
        tags: [tag],
        requestSchema: {
          type: 'object',
          properties,
          required: Object.keys(properties).slice(0, 3),
        },
        responseSchema: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 200 },
            message: { type: 'string', example: 'ok' },
          },
        },
        queryParams: [],
        pathParams: [{ name: 'id', type: 'number', description: `${t}ID` }],
        sources: [sourceId],
      });
    }

    // DELETE /api/{resource}/:id
    if (actionTypes.has('delete')) {
      endpoints.push({
        method: 'DELETE',
        path: `/api/${resourceName}/{id}`,
        summary: `删除${t}`,
        description: `根据ID删除${t}`,
        tags: [tag],
        requestSchema: null,
        responseSchema: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 200 },
            message: { type: 'string', example: 'ok' },
          },
        },
        queryParams: [],
        pathParams: [{ name: 'id', type: 'number', description: `${t}ID` }],
        sources: [sourceId],
      });
    }

    return endpoints;
  }
}

interface ColumnInfo {
  name: string;
  inferredType: 'string' | 'number' | 'boolean';
}

/** Heuristic to detect data values vs column header names in fallback mode */
function looksLikeData(text: string): boolean {
  return /@/.test(text)                 // email address
    || /^[¥$￥]\s*[\d,]+/.test(text)    // price/currency
    || /^\d{4,}$/.test(text)            // long number (not a short ID)
    || /^\d{4}[-/]\d{1,2}/.test(text)  // date pattern
    || text.length > 20;                // long text (likely content, not header)
}

/** Strip emoji and common suffixes from display tags for cleaner summaries */
function cleanTag(tag: string): string {
  return tag
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '')
    .replace(/列表|管理|页面|详情|模块/g, '')
    .trim() || tag;
}

interface RowAction {
  type: 'edit' | 'delete' | 'detail';
  label: string;
}
