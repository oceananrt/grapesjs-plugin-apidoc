# 项目上下文 — 请先完整阅读

## 项目：GrapesJS API Doc 插件

### 一句话概括
做一个 GrapesJS 插件，用户在画布上拖拽设计页面（表格、表单等），插件自动推断出需要的 REST API 接口，并生成 OpenAPI 3.1 文档 + Mock 数据。

---

## ⚠️ 最新进展（2026-07-30，终端 Claude 已完成）

### 本轮做了什么
1. **技术评估完成** — 确认 GrapesJS 插件 API 完全能满足需求，竞品分析确认市场空白
2. **项目骨架搭建完成** — 在 `D:\projects\grapesjs-plugin-apidoc\` 创建完整 TypeScript 项目
3. **核心代码已写出并构建通过** — 零错误零警告
   - CanvasScanner：递归遍历组件树
   - TableAnalyzer：识别表格，推断 GET/DELETE 接口
   - FormAnalyzer：识别表单，推断 POST/PUT 接口
   - APIInferrer：汇总去重
   - OpenAPI31Generator：生成 OpenAPI 3.1 JSON
   - MockDataGenerator：生成 Mock 数据
4. **演示页面已写好** — `demo/index.html`，含用户管理、商品管理两个测试场景
5. **本地服务器已启动** — `http://localhost:3456`（Python HTTP Server 在 demo/ 目录）
6. **构建命令**：`npx rollup -c rollup.config.mjs`，输出到 `dist/`

### ⚠️ 待验证
- **插件还没在浏览器里实际跑过**，需要打开 http://localhost:3456 测试
- 核心验证点：表格列名能否正确提取？表单字段能否正确识别？中文→英文命名映射是否合理？
- 如果效果不理想，调完代码后运行：
  ```bash
  npx rollup -c rollup.config.mjs && cp dist/index.umd.js demo/apidoc-plugin.js
  ```
  然后刷新浏览器

### ⚠️ 服务器情况
- 端口 3456 上跑着 Python HTTP Server，根目录是 `demo/`
- 插件 UMD 文件已复制到 `demo/apidoc-plugin.js`
- 如果服务器挂了，重新启动：`python -m http.server 3456 --directory demo`

---

## 核心思想和差异化

市面上有大量可视化页面构建器（Onlook、Frappe Builder、GrapesJS本身），也有大量 AI 全栈代码生成工具（v0.dev、Bolt.new、Lovable），但**没有一个工具能做到**：
> 用户在画布上搭好页面 → 工具自动猜出后端需要哪些 API → 生成接口文档给后端同事用

### 具体例子
- 画布上拖了一个**用户管理表格**（列：用户名、邮箱、角色、创建时间） → 自动推断 `GET /api/users` 列表接口
- 画布上有个**新增用户表单**（字段：username、email、role、password） → 自动推断 `POST /api/users` 创建接口
- 表格行有**删除按钮** → 自动推断 `DELETE /api/users/:id`
- 搜索框 + 下拉筛选 → 自动推断查询参数 `?keyword=&role=`

### 为什么是插件而不是独立产品？
**策略：借鸡生蛋，不做鸡。**
- GrapesJS 已有 25,800+ GitHub Star，插件生态成熟（GJS.Market 付费市场）
- 自建画布开发量巨大，且无法与已有平台竞争
- 我们的核心竞争力是"API推断"，做成插件可以接入所有用 GrapesJS 的项目
- GJS.Market 上同类 AI/集成类插件售价 $79-$299，目前这个方向**零竞争**

---

## 我（项目创始人）的背景和约束

- **技术栈**：会基础 Java 开发，不熟悉前端（React/TypeScript/Vue 等）
- **开发方式**：全程用 AI 编程工具辅助，我不需要亲自写前端代码
- **编辑器**：电脑上装了 VS Code 和 IntelliJ IDEA，本项目用 VS Code（纯 TypeScript 项目）
- **目标**：先做出可用的 MVP，在 GJS.Market 上架验证市场需求
- **所有下载文件统一放在** `D:\downloads\`

---

## 竞品调研结论（2026年7月）

考察了以下公司/项目，**没有一家做"画布组件→推断API→生成接口文档"这件事**：

| 竞品 | 公司规模 | 做什么 | 缺什么 |
|---|---|---|---|
| Onlook | 7人，YC W25，$100万融资 | 可视化编辑React代码 | 不碰API |
| Frappe Builder | 50-80人，$390万/年收入 | Figma式网页构建器 | 不推断API |
| OpenStitch | 个人开源项目 | 截图/手绘→UI代码 | 不推断API |
| AI-Bilder | 个人开源项目 | 拖拽建站+手动API生成器 | 不自动推断 |
| JeecgBoot | 8-15人，未融资 | 国内低代码平台 | 不生成接口文档 |
| v0.dev / Bolt.new / Lovable | 中型公司 | 全栈AI代码生成 | 生成代码但不独立产出API文档 |

**窗口期还在，值得动手。**

---

## 技术评估结论：完全可行

GrapesJS 的插件 API 提供了所有需要的能力：
- `editor.DomComponents.getWrapper()` — 拿到整个组件树
- `component.get('tagName')` — 获取 HTML 标签（table/form/input/select）
- `component.get('type')` — 获取组件类型（table/row/cell/text/image）
- `component.get('traits')` — 获取可配置属性（name、type、required、placeholder）
- `component.getAttributes()` — 获取 HTML 属性
- `component.components().each()` — 递归遍历子组件
- `editor.Panels.addButton()` — 在右侧面板添加按钮
- `editor.Commands.add()` — 注册命令
- `editor.Modal.open()` — 弹窗展示结果

---

## 当前项目状态

### 已完成（第一版 MVP 代码已写出）

项目路径：`D:\projects\grapesjs-plugin-apidoc\`

```
src/
├── index.ts                    # 插件入口，注册面板按钮 + 扫描命令
├── types.ts                    # 共享 TypeScript 类型
├── engine/
│   ├── CanvasScanner.ts        # 递归遍历组件树，提取结构化信息
│   ├── TableAnalyzer.ts        # 识别表格 → 推断 GET/PUT/DELETE 接口
│   ├── FormAnalyzer.ts         # 识别表单 → 推断 POST/PUT 接口
│   └── APIInferrer.ts          # 汇总去重，应用 API 前缀
├── generators/
│   ├── OpenAPI31Generator.ts   # 生成完整 OpenAPI 3.1 规范 JSON
│   └── MockDataGenerator.ts    # 根据 Schema 生成 Mock 数据
└── utils/
    └── NameInferrer.ts         # 中文列名→英文字段名映射表
demo/
└── index.html                  # 演示页面，含两个测试场景
```

### 构建

```bash
cd D:\projects\grapesjs-plugin-apidoc
npx rollup -c rollup.config.mjs          # 构建
npx rollup -c rollup.config.mjs --watch  # 开发模式
npx serve demo                           # 本地预览
```

构建输出到 `dist/`：CJS、ESM、UMD 三种格式。

### 下一步待做

1. **在浏览器里实际跑通演示页面**，验证插件能正常工作
2. 调试组件扫描逻辑——确认表格列名、表单字段名能正确提取
3. 改进中文→英文命名映射（目前 NameInferrer 里的映射表不够全）
4. 测试更多页面场景（不只是用户管理，还要测商品、订单、文章等）
5. 加手动编辑/修正 UI（推断不准时用户可以改）
6. 导出功能完善（下载 openapi.json、导出 Postman Collection）
7. GJS.Market 上架准备（写描述、做缩略图、录演示视频）

---

## 重要提醒

- **不要从零开始**：项目骨架和核心代码已经写好了，请先读懂现有代码再改
- **保持策略一致**：我们的定位是 GrapesJS 插件，不是独立产品
- **优先验证核心逻辑**：先确保表格识别和表单识别在实际浏览器里能跑通，再完善周边功能
- **遇到问题先搜索 GJS.Market 的博客和论坛**，GrapesJS 社区文档很全
- **下载的任何东西放在 `D:\downloads\`**
