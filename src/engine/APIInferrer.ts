/**
 * APIInferrer — coordinates all analyzers and produces the final
 * list of inferred API endpoints with deduplication.
 */

import type { ComponentInfo, APIEndpoint } from '../types';
import { TableAnalyzer } from './TableAnalyzer';
import { FormAnalyzer } from './FormAnalyzer';

export class APIInferrer {
  private apiPrefix: string;
  private tableAnalyzer: TableAnalyzer;
  private formAnalyzer: FormAnalyzer;

  constructor(apiPrefix: string = '/api') {
    this.apiPrefix = apiPrefix;
    this.tableAnalyzer = new TableAnalyzer();
    this.formAnalyzer = new FormAnalyzer();
  }

  /**
   * Main entry point: takes all canvas components and returns
   * inferred API endpoints.
   */
  infer(components: ComponentInfo[]): APIEndpoint[] {
    if (!components.length) return [];

    // Separate components by role
    const tables = this.findByType(components, 'table');
    const allComponents = this.flatten(components);

    // Run analyzers
    const tableEndpoints = this.tableAnalyzer.analyze(tables);
    const formEndpoints = this.formAnalyzer.analyze(allComponents);

    // Combine and deduplicate
    const all = [...tableEndpoints, ...formEndpoints];
    const deduped = this.deduplicate(all);

    // Apply API prefix (analyzers already generate paths with /api/ prefix)
    return deduped.map(ep => ({
      ...ep,
      path: ep.path.replace(/^\/api/, this.apiPrefix),
    }));
  }

  private findByType(components: ComponentInfo[], type: string): ComponentInfo[] {
    const results: ComponentInfo[] = [];
    const walk = (list: ComponentInfo[]) => {
      for (const comp of list) {
        if (comp.type === type || comp.tagName === type) {
          results.push(comp);
        }
        walk(comp.children);
      }
    };
    walk(components);
    return results;
  }

  private flatten(components: ComponentInfo[]): ComponentInfo[] {
    const result: ComponentInfo[] = [];
    const walk = (list: ComponentInfo[]) => {
      for (const comp of list) {
        result.push(comp);
        walk(comp.children);
      }
    };
    walk(components);
    return result;
  }

  private deduplicate(endpoints: APIEndpoint[]): APIEndpoint[] {
    const seen = new Map<string, APIEndpoint>();

    for (const ep of endpoints) {
      const key = `${ep.method}:${ep.path}`;
      const existing = seen.get(key);

      if (existing) {
        // Merge: keep the one with more schema info
        if (ep.requestSchema && !existing.requestSchema) {
          existing.requestSchema = ep.requestSchema;
        }
        if (ep.responseSchema && !existing.responseSchema) {
          existing.responseSchema = ep.responseSchema;
        }
        existing.sources = [...new Set([...existing.sources, ...ep.sources])];
        existing.queryParams = [...existing.queryParams, ...ep.queryParams.filter(
          q => !existing.queryParams.find(e => e.name === q.name)
        )];
      } else {
        seen.set(key, { ...ep });
      }
    }

    return Array.from(seen.values());
  }
}
