# SOG Browser Demo Skeleton

一个面向现代浏览器的高性能 `.sog`（Spatially Ordered Gaussians）浏览器方案与示例代码。

## 目录

- `docs/architecture.md`：完整架构设计、数据流、性能与测试计划。
- `ui/prototype.html`：Tailwind CSS v3 UI 原型 + DSL。
- `src/`：模块化 three.js/SOG loader/相机聚焦/手势示例。
- `tests/`：单元与集成测试脚本示例。

## 快速运行

> 当前仓库以“结构化样例”形式交付，便于你粘贴到真实前端工程（Vite/Next.js）中。

### 推荐方式（Vite + TypeScript）

```bash
npm create vite@latest sog-viewer -- --template vanilla-ts
cd sog-viewer
npm i three stats.js fflate
# 将本仓库的 src/ docs/ ui/ tests/ 合并到项目
npm run dev
```

### 最小静态预览 UI

```bash
python -m http.server 4173
# 打开 http://localhost:4173/ui/prototype.html
```

## 浏览器兼容性

- 优先：Chrome / Edge（WebGL2 + MRT，可启用 OIT）。
- 次优：Safari 最新版（功能视具体 WebGL 扩展而定）。
- 降级：WebGL1（关闭 OIT，降低分辨率与 LOD，限制 splat 数）。

## 建议依赖

```bash
npm i three stats.js fflate
npm i -D typescript vite vitest eslint prettier @types/three
```

## 参考与借鉴

- PlayCanvas SOG / SuperSplat：借鉴 `.sog` 文件头 + 分块打包思路。
- Reall3dViewer：借鉴 three.js 下的交互与 LOD 组织方式。
- GaussianSplats3D（mkkellogg）：借鉴社区实践中的渲染与排序策略。
- gsplat.js：借鉴 JS/TS 生态中的 splat 数据组织与 API 设计。

## CI 建议

- Lint：`eslint .`
- Format：`prettier -c .`
- Unit：`node tests/unit/cameraFocus.test.mjs && node tests/unit/sogParser.test.mjs`
- Integration（可选 Playwright）：拖放加载、URL 加载、截图导出流程。
