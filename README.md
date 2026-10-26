# Flower Sea（花海）

你伸手，花海就起风。

手势驱动的沉浸式花海网页。浏览器本地手势识别（MediaPipe，摄像头画面不上传），你的手是穿过花海的风；指尖一搓，天降花雨。

在线体验：https://rt8nnz4v4h-design.github.io/flower-sea/

## 本地预览

```powershell
python -m http.server 43117 --bind 127.0.0.1
```

然后打开 <http://127.0.0.1:43117/>。

## 资源结构

- `index.html`：界面、花海渲染与交互逻辑，可直接快速加载。
- `assets/models/`：按需加载的手部与人脸识别模型。
- `assets/vision/`：MediaPipe 运行时及 WASM。
- `assets/music/serenity.wav`：默认的 32 秒原创舒缓纯音乐，首次交互后循环播放。
- `tools/compose-serenity.mjs`：用于重新生成这首原创配乐。
- `tools/split-assets.mjs`：旧版单文件迁移脚本。
- `tools/check-syntax.mjs`：检查主模块语法。
