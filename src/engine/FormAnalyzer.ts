/**
 * FormAnalyzer — detects forms and input fields on the canvas
 * and infers POST/PUT endpoints with request body schemas.
 */

import type { ComponentInfo, APIEndpoint, JSONSchema, JSONSchemaProperty } from '../types';
import { inferResourceName, columnToFieldName } from '../utils/NameInferrer';

export class FormAnalyzer {
  /**
   * Analyze form-containing components and generate API endpoints.
   */
  analyze(components: ComponentInfo[]): APIEndpoint[] {
    const endpoints: APIEndpoint[] = [];

    // Group components into logical forms
    const forms = this.groupForms(components);

    for (const form of forms) {
      const fields = this.extractFields(form);
      if (fields.length === 0) continue;

      const resourceName = inferResourceName(form.root, 'create');
      const tag = this.inferTag(form.root);
      const method = this.inferMethod(form.root);

      // Build request schema
      const properties: Record<string, JSONSchemaProperty> = {};
      const required: string[] = [];

      for (const field of fields) {
        const prop: JSONSchemaProperty = {
          type: this.traitTypeToJSONType(field.traitType, field.inputType),
          description: field.label || field.name,
        };

        if (field.required) required.push(field.name);
        if (field.inputType === 'email') prop.format = 'email';
        if (field.inputType === 'password') prop.format = 'password';
        if (field.enumValues.length > 0) prop.enum = field.enumValues;

        properties[field.name] = prop;
      }

      // For PUT (partial update), only first field is minimally required;
      // for POST (create), all marked-required fields are required.
      const requiredFields = method === 'PUT'
        ? (required.length > 0 ? [required[0]] : [])
        : required;

      const requestSchema: JSONSchema = {
        type: 'object',
        properties,
        required: requiredFields.length > 0 ? requiredFields : undefined,
      };

      const summary = method === 'POST'
        ? `创建${tag}`
        : method === 'PUT'
          ? `更新${tag}`
          : `提交${tag}`;

      endpoints.push({
        method,
        path: method === 'PUT'
          ? `/api/${resourceName}/{id}`
          : `/api/${resourceName}`,
        summary,
        description: `根据表单字段推断的${summary}接口`,
        tags: [tag],
        requestSchema,
        responseSchema: {
          type: 'object',
          properties: {
            code: { type: 'integer', description: '状态码', example: 200 },
            message: { type: 'string', example: 'ok' },
            data: {
              type: 'object',
              properties: this.buildResponseData(properties),
            },
          },
        },
        queryParams: [],
        pathParams: method === 'PUT'
          ? [{ name: 'id', type: 'number', description: `${tag}ID` }]
          : [],
        sources: [form.root.id],
      });
    }

    return endpoints;
  }

  private groupForms(components: ComponentInfo[]): FormGroup[] {
    const groups: FormGroup[] = [];

    for (const comp of components) {
      // A component is a "form root" if it contains multiple inputs
      // BUT skip page-layout containers that also contain tables
      const inputs = this.findAllInputs(comp);
      const hasTable = this.hasDescendantOfType(comp, 'table');
      if ((inputs.length >= 2 || comp.tagName === 'form') && !hasTable) {
        // Also skip search-only bars (input type=search + filter selects, no create/save buttons)
        if (!this.isSearchOnlyBar(comp, inputs)) {
          groups.push({ root: comp, inputs });
        }
      }
    }

    // Prefer innermost containers: remove groups whose inputs are all covered
    // by a more specific (descendant) group
    return this.removeAncestorGroups(groups);
  }

  /** Detect search/filter bars that aren't real data-entry forms */
  private isSearchOnlyBar(comp: ComponentInfo, inputs: ComponentInfo[]): boolean {
    if (comp.tagName === 'form') return false; // <form> is always intentional
    const buttonTexts = this.collectButtonTexts(comp);
    // Has search-like action (search/reset/filter)
    const hasSearchAction = buttonTexts.some(t =>
      /搜索|查询|筛选|重置|filter|search|query/i.test(t)
    );
    // Has form-like action (create/save/submit)
    const hasFormAction = buttonTexts.some(t =>
      /创建|新增|添加|提交|保存|确认|注册|create|submit|save/i.test(t)
    );
    // Is a search bar if: has search intent AND no form intent
    return hasSearchAction && !hasFormAction;
  }

  private hasDescendantOfType(comp: ComponentInfo, typeOrTag: string): boolean {
    for (const child of comp.children) {
      if (child.tagName === typeOrTag || child.type === typeOrTag) {
        return true;
      }
      if (this.hasDescendantOfType(child, typeOrTag)) {
        return true;
      }
    }
    return false;
  }

  private removeAncestorGroups(groups: FormGroup[]): FormGroup[] {
    return groups.filter((group, i) => {
      // Check if any other group's inputs are a strict subset AND all match
      for (let j = 0; j < groups.length; j++) {
        if (i === j) continue;
        const otherInputs = groups[j].inputs;
        if (otherInputs.length >= group.inputs.length) {
          // other group has more or equal inputs → might be a descendant
          const allMatch = group.inputs.every(inp =>
            otherInputs.some(oi => oi.id === inp.id)
          );
          if (allMatch && otherInputs.length > group.inputs.length) {
            return false; // this is an ancestor, skip it
          }
        }
      }
      return true;
    });
  }

  private findAllInputs(comp: ComponentInfo): ComponentInfo[] {
    const inputs: ComponentInfo[] = [];

    const walk = (c: ComponentInfo) => {
      if (this.isInputComponent(c)) {
        inputs.push(c);
      }
      for (const child of c.children) {
        walk(child);
      }
    };

    walk(comp);
    return inputs;
  }

  private isInputComponent(comp: ComponentInfo): boolean {
    const inputTags = ['input', 'select', 'textarea', 'checkbox', 'radio'];
    return inputTags.includes(comp.tagName) || comp.type === 'input';
  }

  private extractFields(form: FormGroup): FieldInfo[] {
    const fields: FieldInfo[] = [];

    for (const input of form.inputs) {
      const traits = input.traits;
      const attrs = input.attributes;

      // Get field name from traits (highest priority) or attributes
      const nameTrait = traits.find(t => t.name === 'name');
      const typeTrait = traits.find(t => t.name === 'type');
      const requiredTrait = traits.find(t => t.name === 'required');
      const placeholderTrait = traits.find(t => t.name === 'placeholder');

      const fieldName = nameTrait?.value
        || attrs['name']
        || this.guessFieldName(input)
        || `field_${fields.length}`;

      const fieldType = typeTrait?.value || attrs['type'] || input.tagName;
      const isRequired = requiredTrait?.value === true || requiredTrait?.value === 'true' || attrs['required'] === 'required';

      const enumValues = this.extractEnumValues(input);

      fields.push({
        name: String(fieldName),
        label: input.label || placeholderTrait?.value || attrs['placeholder'] || '',
        traitType: typeTrait?.type || 'text',
        inputType: String(fieldType).toLowerCase(),
        required: isRequired,
        enumValues,
      });
    }

    return fields;
  }

  private extractEnumValues(input: ComponentInfo): string[] {
    // For select elements, extract option values
    if (input.tagName !== 'select') return [];

    const options: string[] = [];
    for (const child of input.children) {
      if (child.tagName === 'option') {
        const val = child.attributes['value'] || child.content;
        if (val) options.push(val);
      }
    }

    return options;
  }

  private guessFieldName(comp: ComponentInfo): string | null {
    const attrs = comp.attributes;
    if (attrs['id']) return attrs['id'];
    if (attrs['data-field']) return attrs['data-field'];
    if (comp.label) return columnToFieldName(comp.label);
    return null;
  }

  private traitTypeToJSONType(traitType: string, inputType: string): JSONSchemaProperty['type'] {
    if (inputType === 'number' || inputType === 'range') return 'number';
    if (inputType === 'email' || inputType === 'password' || inputType === 'text' || inputType === 'search') return 'string';
    if (inputType === 'checkbox') return 'boolean';
    if (inputType === 'select' || inputType === 'radio') return 'string';
    return 'string';
  }

  private inferMethod(form: ComponentInfo): 'POST' | 'PUT' {
    // Collect intent signals from: label + button text + attributes
    // (avoid deep recursive text to prevent table data pollution)
    const buttonTexts = this.collectButtonTexts(form);
    const signals = [
      form.label || '',
      ...buttonTexts,
      JSON.stringify(form.attributes),
    ].join(' ');

    if (/编辑|修改|更新|edit|update|保存修改/i.test(signals)) return 'PUT';
    if (/新增|添加|创建|新建|注册|add|create|new|register/i.test(signals)) return 'POST';
    return 'POST';
  }

  /** Collect text from button/link descendants (non-recursive beyond form controls) */
  private collectButtonTexts(comp: ComponentInfo): string[] {
    const texts: string[] = [];
    const walk = (c: ComponentInfo) => {
      if (c.tagName === 'button' || c.tagName === 'a') {
        if (c.content) texts.push(c.content);
      }
      // Don't recurse into tables (avoid table action link text)
      if (c.tagName !== 'table') {
        for (const child of c.children) {
          walk(child);
        }
      }
    };
    walk(comp);
    return texts;
  }

  private inferTag(form: ComponentInfo): string {
    // Use explicit attributes, label, or id
    if (form.attributes['data-form']) return form.attributes['data-form'];
    if (form.attributes['data-resource']) return form.attributes['data-resource'];
    if (form.label) return form.label;
    if (form.attributes['id'] && !/^[a-z0-9]{4,}$/i.test(form.attributes['id'])) return form.attributes['id'];
    // Last resort: try to extract from content (button text like "创建用户")
    const btnMatch = form.content?.match(/(?:创建|新增|添加|编辑|修改)(\S{1,8})/);
    if (btnMatch) return btnMatch[1];
    return '数据';
  }

  private buildResponseData(properties: Record<string, JSONSchemaProperty>): Record<string, JSONSchemaProperty> {
    // Return a subset of meaningful response fields (id + key properties)
    const resp: Record<string, JSONSchemaProperty> = {
      id: { type: 'integer', description: 'ID' },
    };
    for (const [key, prop] of Object.entries(properties)) {
      if (key !== 'password') {
        resp[key] = { ...prop };
      }
    }
    return resp;
  }
}

interface FormGroup {
  root: ComponentInfo;
  inputs: ComponentInfo[];
}

interface FieldInfo {
  name: string;
  label: string;
  traitType: string;
  inputType: string;
  required: boolean;
  enumValues: string[];
}
