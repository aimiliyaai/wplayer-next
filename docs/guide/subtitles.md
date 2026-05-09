# 字幕（WebVTT / HTML5 track） {#subtitles}

WPlayer 内置 **HTML5 `<video>` + `<track kind="subtitles">`** 方案，加载 **WebVTT**（`.vtt`）。不在播放器内解析 ASS/SRT，如需其它格式请先在业务侧转成 VTT 或由其它层叠渲染。

## 功能与界面

| 能力 | 说明 |
| --- | --- |
| 多语言轨 | `video.subtitles` 数组，每条对应一个 `<track>` |
| 控制栏快捷按钮 | 位于 **倍速与设置齿轮之间**，一键在「关闭」与 **默认轨** 之间切换 |
| 设置面板 | `setting: true`（默认）时，齿轮 → **字幕** 一级入口 → 二级列表中选择 **关闭** 或具体语言 |
| 禁用态 | 未配置字幕、或所有轨道加载失败时，快捷图标与设置内入口呈灰色且不可点 |
| 开启态图标 | 快捷按钮在字幕打开时使用实心 CC 图标（`subtitles-on.svg`），关闭时为线框风格（`subtitles.svg`） |

**注意**：若将 `setting` 设为 `false`，将不会渲染设置齿轮及设置内的「字幕」菜单，但 **快捷字幕按钮仍然存在**（仍可开关默认轨）。

---

## 初始化参数 {#init-config}

在 `new WPlayer({ video: { ... } })` 中配置其一即可。

### `video.subtitles`（推荐）

多轨数组：

```ts
subtitles: Array<{
  src: string;           // WebVTT URL，必填
  label?: string;        // 菜单显示名；缺省则用浏览器/轨的 label 或 language
  srclang?: string;      // BCP 47 语言代码，如 zh、en
  default?: boolean;     // 是否为「默认轨」；快捷开启时使用该轨（多条时取配置顺序中第一个 default）
  kind?: 'subtitles' | 'captions';  // 默认 'subtitles'
}>
```

### `video.subtitle`（单轨简写）

等价于仅含一条对象的 `subtitles`：

```js
subtitle: {
  src: 'https://example.com/zh.vtt',
  label: '中文',
  srclang: 'zh',
  default: true,
},
```

单轨也可写为 `subtitles: [{ ... }]`。

### 完整示例

```js
const player = new WPlayer({
  container: document.getElementById('player'),
  lang: 'zh-cn',
  setting: true,
  video: {
    url: 'https://example.com/video.mp4',
    pic: 'https://example.com/poster.jpg',
    subtitles: [
      { src: './subs/zh-Hans.vtt', label: '简体中文', srclang: 'zh-Hans', default: true },
      { src: './subs/en.vtt', label: 'English', srclang: 'en' },
    ],
  },
});
```

---

## 运行时 API {#runtime-api}

### `player.updateSubtitles(config)`

在 **不销毁播放器** 的前提下更换字幕列表并重新挂载 `<track>`。

- 传入 **数组**：写入 `video.subtitles`，删除 `video.subtitle`。
- 传入 **单对象**（含 `src`）：写入 `video.subtitle`，删除 `video.subtitles`。

```js
// 切换到新的多轨
player.updateSubtitles([
  { src: '/api/subs/ep2-zh.vtt', label: '中文', srclang: 'zh', default: true },
]);

// 单轨
player.updateSubtitles({ src: '/api/subs/ep2-en.vtt', label: 'English', srclang: 'en' });
```

切换 **视频 URL**（如 `switchVideo`）后，若新片源字幕不同，请在新的 `video` 配置中包含 `subtitles`，或在切换完成后调用 `updateSubtitles`。

### 原生对象

如需高级控制可直接访问 **`player.video`** 与 **`video.textTracks`**（标准 TextTrack API）。播放器内部已通过 `track.mode = 'showing' | 'disabled'` 控制显隐。

---

## 事件 {#events}

通过 `player.on(event, handler)` 监听：

| 事件 | 含义 |
| --- | --- |
| `subtitle_show` | 至少一条字幕轨处于显示状态 |
| `subtitle_hide` | 字幕全部关闭 |
| `subtitle_change` | 显示状态或当前轨发生变化 |

`subtitle_change` 回调的参数对象（兼容旧用法，以实际触发为准）：

```ts
// 关闭时
{ visible: false, trackIndex: -1 }

// 开启时
{ visible: true, trackIndex: number, label?: string }
```

---

## 样式（画面内字幕）

默认在 `src/css/video.less` 中为当前视频元素设置：

```css
video.wplayer-video-current::cue {
  background-color: rgba(0, 0, 0, 0.65);
  color: #fff;
}
```

业务侧可覆盖 `.wplayer` 下的 `::cue` / `::cue()` 选择器以调整字体与背景（受浏览器对 VTTCue 的支持限制）。

---

## 跨域与本地调试

- **必须通过 HTTP(S)** 提供页面与 `.vtt`，不要用 `file://` 直接打开，否则 `<track>` 往往无法加载。
- **VTT 与页面不同源** 时，响应需携带 **CORS**（如 `Access-Control-Allow-Origin`），否则轨道会失败，UI 进入不可用态。

---

## 与弹幕的间距

若弹幕遮挡底部字幕，可使用已有参数：

```js
danmaku: {
  bottom: '15%', // 或具体 px
},
```

---

## 构建产物

生产构建入口为 `dist/WPlayer.min.js`（样式通过 JS 注入）。集成时引入该文件及对应版本即可，无需单独引字幕相关资源（图标已打包进 bundle）。

---

## 相关文件（二次开发）

| 路径 | 作用 |
| --- | --- |
| `src/js/subtitle.js` | 轨道挂载、加载结果、UI 同步、快捷切换 |
| `src/template/player.art` | 快捷按钮、设置内字幕入口与子菜单结构 |
| `src/js/player.js` | `updateSubtitles` |
| `src/assets/subtitles.svg` / `subtitles-on.svg` | 关闭 / 开启态快捷图标 |

本地演示页面：`demo/simple-player.html`（需 `npm run dev` 通过开发服务器打开）。
