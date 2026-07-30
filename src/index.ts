/**
 * GrapesJS Plugin: API Doc Generator
 *
 * Automatically infers REST API endpoints from canvas components
 * (tables, forms, buttons) and generates OpenAPI 3.1 documentation
 * with mock data.
 */

import type { Plugin, Editor } from 'grapesjs';
import { CanvasScanner } from './engine/CanvasScanner';
import { APIInferrer } from './engine/APIInferrer';
import { OpenAPI31Generator } from './generators/OpenAPI31Generator';
import { MockDataGenerator } from './generators/MockDataGenerator';
import { PostmanGenerator } from './generators/PostmanGenerator';

export interface PluginOptions {
  /** Panel button label */
  btnLabel?: string;
  /** Auto-scan on component change */
  autoScan?: boolean;
  /** API base path prefix */
  apiPrefix?: string;
  /** Panel ID to add the button to */
  panelId?: string;
  /** Enable verbose console debugging */
  debug?: boolean;
}

export type { Plugin };

const defaults: Required<PluginOptions> = {
  btnLabel: 'API Docs',
  autoScan: false,
  apiPrefix: '/api',
  panelId: 'options',
  debug: false,
};

const plugin: Plugin<PluginOptions> = (editor, opts = {}) => {
  const options: Required<PluginOptions> = { ...defaults, ...opts };

  // ---- Init engines ----
  const scanner = new CanvasScanner(editor);
  const inferrer = new APIInferrer(options.apiPrefix);
  const openapiGen = new OpenAPI31Generator();
  const mockGen = new MockDataGenerator();
  const postmanGen = new PostmanGenerator('http://localhost:8080');

  // ---- Command: Scan canvas & generate API docs ----
  editor.Commands.add('apidoc:scan', {
    run() {
      let components: any[] = [];
      let endpoints: any[] = [];
      let openapi: any;
      let mocks: any;
      let postman: any;

      try {
        components = scanner.scanAll();
        endpoints = inferrer.infer(components);
        openapi = openapiGen.generate(endpoints);
        mocks = mockGen.generate(endpoints);
        postman = postmanGen.generate(endpoints);
      } catch (err: any) {
        console.error('API Doc Plugin: scan failed', err);
        editor.Modal.open({
          title: '扫描失败',
          content: `<div style="padding:24px;font-family:system-ui;text-align:center;">
            <p style="color:#ef4444;">扫描过程中出现错误：</p>
            <pre style="background:#1e1e1e;color:#f87171;padding:12px;border-radius:6px;font-size:12px;text-align:left;max-height:200px;overflow:auto;">${escapeHTML(String(err.message || err))}</pre>
            <p style="color:#888;font-size:13px;">请检查画布组件是否正常，或关闭第三方插件后重试。</p>
          </div>`,
        });
        editor.log('API Doc: 扫描失败 — ' + (err.message || err), { level: 'error' });
        return;
      }

      if (endpoints.length === 0) {
        editor.log('API Doc: 扫描完成，但未检测到 API 接口', { level: 'warning' });
      }

      // Store results on editor for external access
      (editor as any).__apidoc = { components, endpoints, openapi, mocks, postman };

      // Debug logging
      if (options.debug) {
        console.group('API Doc Plugin — Debug');
        console.log('Scanned components:', components.length);
        console.table(components.map(c => ({
          id: c.id?.slice(-12),
          tagName: c.tagName,
          type: c.type,
          children: c.children.length,
          label: c.label || '-',
        })));
        console.log('Inferred endpoints:', endpoints.length);
        console.table(endpoints.map(e => ({
          method: e.method,
          path: e.path,
          summary: e.summary,
          reqSchema: e.requestSchema ? '✓' : '-',
          respSchema: e.responseSchema ? '✓' : '-',
          sources: e.sources.join(','),
        })));
        console.log('OpenAPI 3.1:', openapi);
        console.log('Postman Collection:', postman);
        console.log('Mock data:', mocks);
        console.groupEnd();
      }

      const openapiJSON = JSON.stringify(openapi, null, 2);
      const postmanJSON = JSON.stringify(postman, null, 2);

      // Inject a download helper into the page (modal innerHTML can't run scripts)
      const dlId = '__apidoc_data';
      (window as any)[dlId] = { openapiJSON, postmanJSON };
      if (!(window as any).__apidoc_dl) {
        (window as any).__apidoc_dl = function(data: string, filename: string) {
          const blob = new Blob([data], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = filename;
          document.body.appendChild(a); a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
      }

      // Show results modal
      editor.Modal.open({
        title: '推断的 API 接口',
        content: buildModalContent(endpoints, openapi, postman, mocks, dlId),
      });

      editor.log(`API Doc: 扫描到 ${components.length} 个组件，推断出 ${endpoints.length} 个接口`, {
        level: 'info',
      });
    },
  });

  // ---- Add button to panel ----
  editor.Panels.addButton(options.panelId, {
    id: 'apidoc-btn',
    className: 'gjs-pn-btn-apidoc',
    label: `<span style="padding:0 6px;">${options.btnLabel}</span>`,
    command: 'apidoc:scan',
  });

  // ---- Auto-scan on load ----
  if (options.autoScan) {
    editor.on('load', () => editor.runCommand('apidoc:scan'));
  }

  // ---- Panel CSS ----
  editor.on('load', () => {
    const style = document.createElement('style');
    style.textContent = panelCSS;
    document.head.appendChild(style);
  });
};

// ---- Modal content builder ----
function buildModalContent(endpoints: any[], openapi: any, postman: any, _mocks: any, dlId?: string): string {
  const methodColors: Record<string, string> = {
    GET: '#22c55e',
    POST: '#3b82f6',
    PUT: '#f59e0b',
    PATCH: '#a855f7',
    DELETE: '#ef4444',
  };

  // Empty state
  if (!endpoints.length) {
    return `
      <div style="max-height:70vh;overflow-y:auto;font-family:system-ui;padding:32px;text-align:center;">
        <div style="font-size:48px;margin-bottom:16px;">🔍</div>
        <h3 style="margin:0 0 8px;color:#333;">未检测到 API 接口</h3>
        <p style="color:#888;font-size:14px;line-height:1.6;margin:0;">
          画布上未发现表格或表单组件。<br>
          <span style="color:#3b82f6;">💡 提示：</span>拖拽<b>表格</b>或<b>表单</b>组件到画布，再点击 扫描。
        </p>
      </div>
    `;
  }

  // Build rows with expandable detail
  const rows = endpoints.map((ep, i) => {
    const fieldCount = ep.requestSchema?.properties
      ? Object.keys(ep.requestSchema.properties).length
      : 0;
    const respFieldCount = ep.responseSchema?.properties
      ? Object.keys(ep.responseSchema.properties).length
      : 0;
    const reqInfo = fieldCount > 0 ? `${fieldCount} 字段` : '-';
    const respInfo = respFieldCount > 0 ? `${respFieldCount} 字段` : '-';
    const detailId = `apidoc-detail-${i}`;

    return `
      <tr style="cursor:pointer;border-bottom:1px solid #eee;" onclick="document.getElementById('${detailId}').open=!document.getElementById('${detailId}').open">
        <td><span style="
          background:${methodColors[ep.method] || '#666'};
          color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold;
        ">${ep.method}</span></td>
        <td><code style="font-size:13px;">${ep.path}</code></td>
        <td style="color:#555;font-size:13px;">${ep.summary || ''}</td>
        <td style="font-size:12px;color:#888;">${reqInfo}</td>
        <td style="font-size:12px;color:#888;">${respInfo}</td>
      </tr>
      <tr id="${detailId}" style="display:none;">
        <td colspan="5" style="padding:12px;background:#fafafa;">
          <div style="font-size:12px;">
            <b>描述：</b>${ep.description || '-'}<br>
            <b>标签：</b>${(ep.tags || []).join(', ') || '-'}<br>
            ${ep.pathParams.length ? `<b>路径参数：</b>${ep.pathParams.map((p: any) => `${p.name} (${p.type})`).join(', ')}<br>` : ''}
            ${ep.queryParams.length ? `<b>查询参数：</b>${ep.queryParams.map((p: any) => `${p.name} (${p.type})`).join(', ')}<br>` : ''}
            ${ep.requestSchema?.properties ? `<details style="margin-top:4px;"><summary>📥 请求体字段</summary><pre style="font-size:11px;">${JSON.stringify(ep.requestSchema.properties, null, 2)}</pre></details>` : ''}
            ${ep.responseSchema?.properties ? `<details style="margin-top:4px;"><summary>📤 响应体字段</summary><pre style="font-size:11px;">${JSON.stringify(ep.responseSchema.properties, null, 2)}</pre></details>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const openapiJSON = JSON.stringify(openapi, null, 2);
  const postmanJSON = JSON.stringify(postman, null, 2);

  return `
    <div style="max-height:70vh;overflow-y:auto;font-family:system-ui;padding:8px;">
      <div style="margin-bottom:16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <b>接口列表</b>
        <span style="background:#3b82f6;color:#fff;padding:1px 8px;border-radius:10px;font-size:11px;">${endpoints.length}</span>
        <button onclick="window.__apidoc_dl(window['${dlId}'].openapiJSON,'openapi.json')" style="cursor:pointer;padding:4px 12px;border:1px solid #ccc;border-radius:4px;background:#fff;font-size:12px;">
          ⬇ OpenAPI
        </button>
        <button onclick="window.__apidoc_dl(window['${dlId}'].postmanJSON,'postman_collection.json')" style="cursor:pointer;padding:4px 12px;border:1px solid #ccc;border-radius:4px;background:#fff;font-size:12px;">
          📮 Postman
        </button>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="background:#f5f5f5;text-align:left;">
            <th style="padding:8px;font-size:12px;">方法</th>
            <th style="padding:8px;font-size:12px;">路径</th>
            <th style="padding:8px;font-size:12px;">说明</th>
            <th style="padding:8px;font-size:12px;">请求体</th>
            <th style="padding:8px;font-size:12px;">响应体</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <details>
        <summary style="cursor:pointer;font-weight:bold;font-size:13px;">📄 OpenAPI 3.1 JSON</summary>
        <pre style="background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:6px;overflow-x:auto;max-height:300px;font-size:11px;"><code>${escapeHTML(openapiJSON)}</code></pre>
      </details>
      <details style="margin-top:8px;">
        <summary style="cursor:pointer;font-weight:bold;font-size:13px;">📮 Postman Collection JSON</summary>
        <pre style="background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:6px;overflow-x:auto;max-height:300px;font-size:11px;"><code>${escapeHTML(postmanJSON)}</code></pre>
      </details>
    </div>
  `;
}

function escapeHTML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const panelCSS = `
  .gjs-pn-btn-apidoc {
    background: #3b82f6 !important;
    color: #fff !important;
    font-weight: 600;
    border-radius: 6px !important;
    margin: 0 4px;
  }
  .gjs-pn-btn-apidoc:hover { background: #2563eb !important; }
`;

export default plugin;
