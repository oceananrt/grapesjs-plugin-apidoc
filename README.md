# GrapesJS API Doc Plugin

> 用户在画布上拖拽表格和表单 → 插件自动推断 REST API 接口 → 生成 OpenAPI 3.1 + Postman Collection + Mock 数据

## 效果演示

画布上有用户管理表格（列：用户名、邮箱、角色、创建时间）和新增用户表单：

| 画布组件 | 自动推断 |
|---|---|
| 表格 + 编辑/删除按钮 | `GET /api/users` `PUT /api/users/{id}` `DELETE /api/users/{id}` |
| 新增表单（username, email, role...） | `POST /api/users` + 请求体 Schema |

一键下载 OpenAPI 3.1 JSON 和 Postman Collection。

## 安装

```bash
npm install grapesjs-plugin-apidoc
```

## 使用

```js
import grapesjs from 'grapesjs';
import apiDocPlugin from 'grapesjs-plugin-apidoc';

const editor = grapesjs.init({
  container: '#gjs',
  plugins: [apiDocPlugin],
  pluginsOpts: {
    [apiDocPlugin]: {
      apiPrefix: '/api',   // API 路径前缀
      debug: false,         // 开启控制台调试输出
      btnLabel: 'API Docs', // 面板按钮文字
    },
  },
});
```

或者通过 CDN：

```html
<script src="https://unpkg.com/grapesjs-plugin-apidoc/dist/index.umd.js"></script>
<script>
  grapesjs.init({
    // ...
    plugins: [GrapesjsPluginApidoc],
    pluginsOpts: { [GrapesjsPluginApidoc]: { apiPrefix: '/api' } },
  });
</script>
```

## 配置项

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `apiPrefix` | `string` | `'/api'` | API 路径前缀 |
| `btnLabel` | `string` | `'API Docs'` | 面板按钮文字 |
| `autoScan` | `boolean` | `false` | 组件变化时自动扫描 |
| `panelId` | `string` | `'options'` | 按钮所在面板 ID |
| `debug` | `boolean` | `false` | 控制台输出扫描详情 |

## 支持的场景

- ✅ 数据表格 → GET 列表 + GET 详情 + PUT 更新 + DELETE 删除
- ✅ 创建表单 → POST 创建
- ✅ 编辑表单 → PUT 更新
- ✅ 搜索栏 → 查询参数推断
- ✅ 下拉选择 → 枚举值提取
- ✅ 中文列名/标签 → 英文字段名自动映射（300+ 条）
- ✅ OpenAPI 3.1 JSON 下载
- ✅ Postman Collection JSON 下载
- ✅ Mock 数据生成

## 工作原理

```
CanvasScanner → TableAnalyzer + FormAnalyzer → APIInferrer → OpenAPI31Generator
  (组件扫描)      (表格/表单推断)              (去重合并)     (生成 OpenAPI)
                                                         → PostmanGenerator
                                                         → MockDataGenerator
```

## License

MIT
