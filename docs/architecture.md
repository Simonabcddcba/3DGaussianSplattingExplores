# 高性能 SOG 3D 浏览器架构设计

## 1. 目标与范围

本方案面向现代浏览器（Chrome/Edge/Safari 新版）实现 `.sog`（Spatially Ordered Gaussians）加载、解析与实时渲染，优先 WebGL2，兼容 WebGL1 降级路径。核心目标：

- 100k 高斯在桌面流畅渲染（60 FPS 目标，最低 30 FPS 可接受）。
- 百万级数据可浏览（通过 LOD、流式加载、分块缓存、实例化与批处理）。
- 支持 URL 参数加载与拖放加载。
- 提供桌面 + 移动交互一致 API，包含单指旋转/双指缩放/三指平移。
- 可观测性：FPS、当前渲染高斯数量、内存占用、错误/回退提示。

---

## 2. 模块划分

```text
src/
  core/
    App.ts                // 启动、生命周期、依赖装配
    EventBus.ts           // 全局事件总线
    RenderLoop.ts         // 帧循环与调度
  loaders/
    SogParser.ts          // .sog 头解析、块解码、反量化
    SogLoader.ts          // URL/拖放/流式分块调度
    StreamCache.ts        // 区块缓存、回收策略
  render/
    GaussianRenderer.ts   // splat draw call + shader
    GaussianMaterial.ts   // shader uniform/define 管理
    LodManager.ts         // 屏幕贡献+距离 LOD
  controls/
    UnifiedInput.ts       // 鼠标/触控/指针统一层
    ModeController.ts     // 自由模式 vs 建筑锁定模式
  camera/
    CameraFocus.ts        // 聚焦点计算与缓动
    CameraPath.ts         // 轨迹动画
  utils/
    PerfMonitor.ts        // FPS/内存
    Env.ts                // WebGL1/2 与能力检测
    ExportPNG.ts          // 截图导出
```

---

## 3. 核心接口（TypeScript 风格）

```ts
// loaders/SogParser.ts
export interface SogHeader {
  magic: 'SOG0';
  version: number;
  gaussianCount: number;
  chunkCount: number;
  quantization: {
    posBits: number;
    colorBits: number;
    covBits: number;
    weightBits: number;
  };
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  flags: number;
}

export interface GaussianChunk {
  indexOffset: number;
  count: number;
  positions: Float32Array;   // xyz xyz ...
  covariances: Float32Array; // 6 coeff per gaussian (symmetric 3x3)
  colors: Uint8Array;        // rgba
  weights: Float32Array;
  lodLevel: Uint8Array;
}

export interface ISogParser {
  parseHeader(buffer: ArrayBuffer): SogHeader;
  decodeChunk(buffer: ArrayBuffer, chunkId: number): GaussianChunk;
}
```

```ts
// render/GaussianRenderer.ts
export interface RenderStats {
  visibleGaussians: number;
  gpuMemoryMB: number;
  drawCalls: number;
}

export interface IGaussianRenderer {
  init(): Promise<void>;
  appendChunk(chunk: GaussianChunk): void;
  setQualityPreset(preset: 'ultra' | 'balanced' | 'mobile'): void;
  render(dt: number): RenderStats;
  disposeChunk(chunkId: number): void;
}
```

```ts
// camera/CameraFocus.ts
export interface FocusOptions {
  durationMs?: number; // 默认 800ms
  viewMode?: 'top' | 'isometric';
  lockLookAt?: boolean;
  easing?: (t: number) => number;
}

export function focusCameraToTarget(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; update(): void },
  boundsCenter: THREE.Vector3,
  boundsRadius: number,
  options?: FocusOptions
): Promise<void>;
```

---

## 4. 数据流

1. **输入阶段**
   - URL 参数 `?sog=...` 或拖放文件。
   - `SogLoader` 校验类型、构建 `ReadableStream`。
2. **解析阶段**
   - `SogParser.parseHeader` 读取文件头（magic/version/量化信息/总高斯数）。
   - 分块下载/解压，按块反量化成 TypedArray。
3. **渲染准备阶段**
   - `LodManager` 先渲染低 LOD 粗略层，逐步替换高精度层。
   - `GaussianRenderer` 将数据上传为纹理缓冲或 instance attributes。
4. **帧循环阶段**
   - 计算可见性 + 屏幕贡献阈值。
   - 深度排序（前后混合策略）+ 绘制。
   - `PerfMonitor` 采样 FPS/内存并推送 UI。
5. **回收阶段**
   - 摄像机远离时回收低优先块（LRU + 可见性优先级）。

---

## 5. `.sog` 解析要点（参考 PlayCanvas/SuperSplat 思路）

> 注意：具体字段偏移应以实际规范版本为准，以下给出工程化解析骨架。

### 5.1 建议文件头布局（示例）

```text
0x00: char[4]   magic = "SOG0"
0x04: uint16    version
0x06: uint16    headerSize
0x08: uint32    gaussianCount
0x0C: uint32    chunkCount
0x10: uint8     posBits
0x11: uint8     colorBits
0x12: uint8     covBits
0x13: uint8     weightBits
0x14: float32[3] boundsMin
0x20: float32[3] boundsMax
0x2C: uint32    flags (compressed / hasSH / hasLOD ...)
... chunk table ...
```

### 5.2 反量化伪代码

```pseudo
for each chunk:
  read compressed blob
  if flags.compressed: blob = decompress(blob)
  for i in [0..count):
    qx,qy,qz = readNBits(posBits)
    x = lerp(boundsMin.x, boundsMax.x, qx / ((1<<posBits)-1))
    ...

    qc = readPackedRGBA(colorBits)
    color = decodeSRGB(qc)

    qcov[6] = readNBits(covBits)
    cov = dequantCovariance(qcov, scale)

    qw = readNBits(weightBits)
    weight = qw / ((1<<weightBits)-1)

    lod = readUint8()
```

### 5.3 TypedArray 内存布局建议

- `positions`: `Float32Array(N * 3)`
- `covariances`: `Float32Array(N * 6)`（对称矩阵 6 分量）
- `colors`: `Uint8Array(N * 4)`
- `weights`: `Float32Array(N)`
- `lodLevels`: `Uint8Array(N)`

优点：CPU 解析连续写入、GPU 上传可分 attribute/texture，便于分块回收。

---

## 6. three.js 高效 Gaussian Splat 渲染策略

### 6.1 几何组织

- 使用 `InstancedBufferGeometry` + 单个四边形 billboard（2 三角形）。
- 每实例读取：中心位置、协方差参数、颜色、权重、LOD。
- 超大规模时将协方差与颜色放入 DataTexture（减少 attribute slot 压力）。

### 6.2 Shader 要点（GLSL 思路）

顶点阶段：
1. 将高斯中心投影至裁剪空间。
2. 协方差从物体空间变换到视空间/屏幕空间（Jacobian 近似）。
3. 为 quad 顶点扩展椭圆包围盒。

片元阶段：
1. 根据屏幕空间偏移 `d` 计算权重：`alpha = exp(-0.5 * d^T * Sigma^-1 * d) * weight`。
2. 颜色累积采用预乘 alpha。
3. 结合深度排序或 OIT（weighted blended OIT）。

### 6.3 混合与排序

- 基线：块级深度排序 + 块内近似排序（按中心深度）。
- 高质量：Weighted Blended OIT（MRT，WebGL2 更友好）。
- 低端降级：关闭 OIT，改传统 alpha blend + 粗排序。

---

## 7. LOD 策略（距离 + 屏幕贡献）

### 7.1 评分函数

```text
score = w1 * distanceFactor + w2 * projectedRadiusPx + w3 * semanticPriority
```

- `distanceFactor`: 距离越远越低。
- `projectedRadiusPx`: 屏幕贡献低于阈值则丢弃。
- `semanticPriority`: 地标附近高优先保留。

### 7.2 策略

1. 先渲染 LOD2（粗）确保首帧快。
2. 空闲帧补充 LOD1 -> LOD0。
3. FPS < 30 持续 500ms：提高阈值、减少 maxSplats。
4. 内存超预算：按“不可见 + 最低优先级”先回收。

---

## 8. 流式加载与内存回收

- **分块下载**：HTTP Range 或 chunk 索引请求。
- **优先级队列**：摄像机视锥内 + 焦点附近块优先。
- **解码线程**：Web Worker 解压/反量化，主线程只做上传。
- **缓存策略**：`StreamCache` 使用 LRU，保留最近 K 个 chunk。
- **内存目标**：移动端 150~250MB，桌面 500MB+（可配置）。

---

## 9. 交互控制策略

- **自由模式**：Orbit-like（旋转/缩放/平移）。
- **建筑锁定模式**：约束俯仰范围、锁定 `up`，支持地标吸附。
- **侧栏聚焦**：点击地标触发 `focusCameraToTarget`，默认 800ms，结束后锁定 lookAt 并显示标签。

---

## 10. 移动手势统一层

- 单指：旋转。
- 双指：缩放（pinch）+ 可选轻微旋转抑制。
- 三指：平移。
- `touch-action: none` + 非 passive 监听控制默认手势冲突（避免下拉刷新干扰）。
- 事件节流：`requestAnimationFrame` 合并 move 事件。

---

## 11. 错误与降级

1. 无 WebGL：显示“当前浏览器不支持 WebGL，建议升级或切换设备”。
2. 仅 WebGL1：
   - 关闭 OIT/MRT。
   - 限制最大 splat 数。
   - 降低渲染分辨率。
3. 加载失败：Toast + 重试按钮 + 错误详情折叠面板。

---

## 12. 测试计划

### 12.1 单元测试

- `SogParser`: 头解析、反量化边界值、非法 magic/version。
- `CameraFocus`: easing 边界、路径单调性、终点误差。
- `LodManager`: 不同距离/分辨率下的层级输出正确性。

### 12.2 集成测试

- 拖放加载成功并开始渲染。
- URL 参数加载并自动聚焦首个地标。
- FPS 面板、统计值更新。
- PNG 导出后文件可用。

### 12.3 性能基线

- 桌面（WebGL2）：100k@1080p >= 55 FPS，500k >= 30 FPS。
- 移动（WebGL2）：100k@720p >= 30 FPS。
- WebGL1 降级：100k@720p >= 24 FPS（降质模式）。

---

## 13. 推荐第三方库

- `three`：渲染基础。
- `stats.js`：FPS 面板。
- `lil-gui`（可选）：调参。
- `fflate`（可选）：轻量解压。
- 参考仓库：
  - PlayCanvas/SuperSplat：SOG 结构与打包范式。
  - GaussianSplats3D（mkkellogg）：three.js splat 实战。
  - gsplat.js：TS 生态下可复用渲染与数据结构思路。
  - Reall3dViewer：LOD 与交互流程参考。

安装示例：

```bash
npm i three stats.js fflate
npm i -D typescript vite vitest eslint prettier
```
