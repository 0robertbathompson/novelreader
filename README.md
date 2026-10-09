# 竖版小说 → 横版阅读网

仿普通网文站（起点/晋江风）的小说阅读器：导入竖版小说文档，自动以横版显示。
纯静态三件套 `index.html / style.css / app.js`，无需后端，直接用 GitHub Pages 就能给别人用。

## 功能
- 导入 `.txt / .md / .html / .epub`（拖拽或点按钮，txt 自动兼容 UTF-8 / GBK）
- EPUB（含日文竖排书）按 spine 顺序解包，只取文字丢掉 `vertical-rl` 版式，自然变横版；`ruby/rt` 注音默认只留汉字，可勾选保留为 汉字（假名）
- 默认**横版**显示，右上可一键切换**竖版预览**（writing-mode）
- 自动切章节 + 左侧网文式目录 + 搜索 + 上/下一章
- **一键竖版重排**：从竖排 PDF 复制出的乱序文字（每行几个字、要横着连读）可按列转置还原成横版，可撤销
- 导出横版 TXT
- 右侧样式面板：
  - 背景色 / 文字颜色（取色器 + 5 套网文预设：米黄/纯白/护眼绿/夜间/粉）
  - 字体大小 12–34px、行高、内容宽度
  - 字体切换：宋体/黑体/楷体/仿宋
  - **自定义字体链接**：贴 Google Fonts CSS 链接或 `.woff2/.woff/.ttf/.otf` 直链 + 字体名，点“导入字体”即生效
- 样式自动存 localStorage，下次打开还在

## 本地运行
```powershell
cd vertical-novel-reader
python -m http.server 8000
# 浏览器打开 http://localhost:8000
```
直接双击 `index.html` 也能用（推荐用上面 http 方式，字体外链更稳）。
> EPUB 解析依赖 JSZip CDN，离线双击打开时需联网一次；传到 GitHub Pages 上用没问题。

## 自定义字体举例
1. Google Fonts CSS：
   - 链接如 `https://fonts.googleapis.com/css2?family=ZCOOL+XiaoWei`
   - 字体名填 `ZCOOL XiaoWei`，导入后上面选“自定义”
2. 字体文件直链：
   - 链接如 `https://example.com/fonts/my.woff2`
   - 字体名填 `MyFont`，导入即可
