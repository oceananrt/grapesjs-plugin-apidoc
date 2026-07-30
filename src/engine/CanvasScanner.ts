/**
 * CanvasScanner — recursively traverses the GrapesJS component tree
 * and extracts structured info from every component on the canvas.
 */

import type { Editor, Component } from 'grapesjs';
import type { ComponentInfo, TraitInfo } from '../types';

export class CanvasScanner {
  private editor: Editor;

  constructor(editor: Editor) {
    this.editor = editor;
  }

  /** Scan all components on the canvas */
  scanAll(): ComponentInfo[] {
    const result: ComponentInfo[] = [];
    const wrapper = this.editor.DomComponents.getWrapper();
    if (!wrapper) return result;

    const children = wrapper.components();
    children.each((child: Component) => {
      const info = this.extractComponent(child, null);
      if (info) result.push(info);
    });

    return result;
  }

  private extractComponent(comp: Component, parentType: string | null): ComponentInfo | null {
    try {
      const rawTag = comp.get('tagName');
      const tagName = (typeof rawTag === 'string' ? rawTag : '').toLowerCase();
      const rawType = comp.get('type');
      const type = typeof rawType === 'string' ? rawType : '';
      let attributes: Record<string, string> = {};
      try { attributes = comp.getAttributes ? comp.getAttributes() : {}; } catch { /* ignore */ }
      const traits = this.extractTraits(comp);
      const content = this.getTextContent(comp);

      // Find sibling text/label near this component
      const label = this.findLabel(comp);

      const childComponents = comp.components ? comp.components() : null;
      const children: ComponentInfo[] = [];
      if (childComponents && typeof childComponents.each === 'function') {
        childComponents.each((child: Component) => {
          const childInfo = this.extractComponent(child, type);
          if (childInfo) children.push(childInfo);
        });
      }

      return {
        id: comp.getId ? comp.getId() : (comp as any).cid || '',
        tagName,
        type,
        traits,
        attributes,
        content,
        parentType,
        children,
        label,
      };
    } catch {
      // Non-standard component (e.g. third-party plugin) — skip gracefully
      return null;
    }
  }

  private extractTraits(comp: Component): TraitInfo[] {
    const raw = comp.get('traits');
    if (!raw) return [];
    const traitsList: any[] = Array.isArray(raw) ? raw : (raw.models || []);
    if (!traitsList.length) return [];

    return traitsList.map((t: any) => ({
      name: t.get ? t.get('name') : (t.name || ''),
      type: t.get ? t.get('type') : (t.type || 'text'),
      value: t.get ? t.getValue() : (t.value || ''),
      label: t.get ? t.get('label') : (t.label || ''),
    }));
  }

  private getTextContent(comp: Component): string {
    const el = comp.getEl ? comp.getEl() : null;
    if (el) {
      return (el.textContent || '').trim();
    }
    // Fallback: try to get from children that are text nodes
    const childText: string[] = [];
    comp.components().each((c: Component) => {
      if (c.get('type') === 'text' || c.get('type') === 'textnode') {
        childText.push(c.get('content') || '');
      }
    });
    return childText.join(' ').trim();
  }

  private findLabel(comp: Component): string | null {
    // Check the component's own attributes first
    const attrs = comp.getAttributes ? comp.getAttributes() : {};
    if (attrs['aria-label']) return attrs['aria-label'];
    // Note: placeholder is NOT returned as a label — it's input hint text,
    // not a semantic label for resource name inference.

    // Check for a label or text sibling in the same parent container
    let current = comp;
    for (let depth = 0; depth < 3; depth++) {
      const parent = current.parent();
      if (!parent) break;

      // Strategy 1: Check siblings BEFORE this component
      let prevLabel: string | null = null;
      parent.components().each((sibling: Component) => {
        if (sibling.cid === current.cid) return false; // stop at current
        const sibTag = (sibling.get('tagName') || '').toLowerCase();
        const sibType = sibling.get('type') || '';
        if (sibTag === 'label' || /^h[1-6]$/.test(sibTag) || sibType === 'text') {
          const text = sibling.getEl()?.textContent?.trim();
          if (text) prevLabel = text;
        }
      });
      if (prevLabel) return prevLabel;

      // Strategy 2: Check siblings AFTER this component (e.g., <input><label>name</label>)
      let foundCurrent = false;
      let nextLabel: string | null = null;
      parent.components().each((sibling: Component) => {
        if (sibling.cid === current.cid) { foundCurrent = true; return; }
        if (!foundCurrent) return; // skip siblings before current
        if (nextLabel) return; // already found first label after current
        const sibTag = (sibling.get('tagName') || '').toLowerCase();
        if (sibTag === 'label') {
          const text = sibling.getEl()?.textContent?.trim();
          if (text) nextLabel = text;
        }
      });
      if (nextLabel) return nextLabel;

      // Strategy 3: Check parent's own siblings for headings (context at ancestor level)
      const grandparent = parent.parent();
      if (grandparent) {
        let headingLabel: string | null = null;
        grandparent.components().each((sibling: Component) => {
          if (sibling.cid === parent.cid) return false;
          const sibTag = (sibling.get('tagName') || '').toLowerCase();
          if (/^h[1-6]$/.test(sibTag) || sibling.get('type') === 'text') {
            const text = sibling.getEl()?.textContent?.trim();
            if (text) headingLabel = text;
          }
        });
        if (headingLabel) return headingLabel;
      }

      // Move up one level and try again
      current = parent;
    }

    // Final fallback: check component name attribute
    const name = attrs['name'];
    if (name) return name;

    return null;
  }
}
