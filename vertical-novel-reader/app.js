const $ = id => document.getElementById(id);
const reader = $('reader'), tocEl = $('toc');

let chapters = [];
let current = 0;
let backupRaw = null;

const DEFAULTS = {
  mode: 'horizontal',
  bg: '#f6f1e7', text: '#333333',
  fontSize: 20, lineHeight: 2, width: 800,
  fontFamily: "'Noto Serif SC','Songti SC',serif",
  fontUrl: '', fontName: ''
};
let settings = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem('novelReaderSettings') || '{}');
  settings = { ...DEFAULTS, ...saved };
} catch (e) {}

function applySettings() {
  const r = document.documentElement.style;
  r.setProperty('--bg', settings.bg);
  r.setProperty('--paper', isDark(settings.bg) ? '#222' : '#fffdf7');
  r.setProperty('--ink', settings.text);
  r.setProperty('--fs', settings.fontSize + 'px');
  r.setProperty('--lh', settings.lineHeight);
  r.setProperty('--width', settings.width + 'px');
  const fam = settings.fontFamily === 'custom' && settings.fontName
    ? `'${settings.fontName}', serif` : settings.fontFamily;
  r.setProperty('--font', fam);

  reader.classList.toggle('horizontal', settings.mode === 'horizontal');
  reader.classList.toggle('vertical', settings.mode === 'vertical');
  for (const id of ['modeH', 'modeV', 'modeH2', 'modeV2']) $(id)?.classList.remove('active');
  if (settings.mode === 'horizontal') { $('modeH').classList.add('active'); $('modeH2').classList.add('active'); }
  else { $('modeV').classList.add('active'); $('modeV2').classList.add('active'); }

  $('bgColor').value = settings.bg;
  $('textColor').value = settings.text;
  $('fontSize').value = settings.fontSize;
  $('fontSizeVal').textContent = settings.fontSize + 'px';
  $('lineHeight').value = settings.lineHeight;
  $('lineHeightVal').textContent = settings.lineHeight;
  $('contentWidth').value = settings.width;
  $('widthVal').textContent = settings.width + 'px';
  $('fontFamily').value = settings.fontFamily;
  $('fontUrl').value = settings.fontUrl || '';
  $('fontName').value = settings.fontName || '';
  localStorage.setItem('novelReaderSettings', JSON.stringify(settings));
}
function isDark(hex) {
  try {
    const c = hex.replace('#', '');
    const v = [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16));
    return (0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]) < 90;
  } catch { return false; }
}
function setMode(m) { settings.mode = m; applySettings(); }

// ---------- 文件导入 ----------
$('fileInput').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) readFile(f);
});
['dragover', 'dragenter'].forEach(ev => document.addEventListener(ev, e => {
  e.preventDefault(); $('dropTip').classList.add('over');
}));
['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => {
  e.preventDefault(); $('dropTip').classList.remove('over');
}));
document.addEventListener('drop', e => {
  const f = e.dataTransfer.files?.[0];
  if (f) readFile(f);
});

async function readFile(file) {
  const buf = await file.arrayBuffer();
  let text = tryDecode(buf);
  // 去掉竖排常见的全角空格堆积，统一换行
  text = text.replace(/\r/g, '\n');
  loadBook(file.name.replace(/\.[^.]+$/, ''), text);
}
function tryDecode(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { try { return new TextDecoder('gbk').decode(buf); } catch { return new TextDecoder().decode(buf); } }
}

// ---------- 章节切分（网文站目录风） ----------
const CHAPTER_RE = /^(第[一二三四五六七八九十零百千万\d\s]+[章节回集卷].{0,30}|Chapter\s*\d+.{0,30}|序章.*|楔子.*|前言.*|后记.*|番外.*|正文.*)$/;
function loadBook(title, rawText) {
  backupRaw = rawText;
  $('undoFixBtn').disabled = true;
  const lines = rawText.split('\n').map(s => s.trim()).filter(Boolean);
  chapters = [];
  let cur = { title: '正文', content: [] };
  for (const ln of lines) {
    if (CHAPTER_RE.test(ln) && ln.length < 60 && cur.content.length > 0) {
      chapters.push(cur);
      cur = { title: ln, content: [] };
    } else if (CHAPTER_RE.test(ln) && ln.length < 60 && cur.content.length === 0 && chapters.length === 0 && cur.title === '正文') {
      cur.title = ln; // 第一章直接当标题
    } else {
      cur.content.push(ln);
    }
  }
  if (cur.content.length || cur.title !== '正文') chapters.push(cur);
  if (!chapters.length) chapters = [{ title: '全文', content: lines }];
  current = 0;
  $('bookTitle').textContent = title;
  $('bookTitleSide').textContent = title;
  renderToc(''); renderChapter();
}

// ---------- 竖版乱序重排：把“每行几个字、横着读”的文本转成横版 ----------
// 原理：从竖排 PDF 复制时，原本一列变成了一行，多列变成多行，
// 需要按列转置：把连续 N 行当成矩阵，做行列互换。
function verticalFix(text) {
  const paras = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const out = paras.map(block => {
    const rows = block.split('\n').map(s => s.replace(/\s+/g, '')).filter(Boolean);
    if (rows.length < 4) return rows.join('\n');
    const lens = rows.map(r => [...r].length);
    const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
    const variance = Math.max(...lens) - Math.min(...lens);
    // 短行 + 等长 => 很像竖排复制出来的
    if (avg > 25 || variance > Math.max(4, avg * 0.5)) return rows.join('\n');
    const W = Math.max(...lens);
    const grid = rows.map(r => [...r.padEnd(W, '　')]);
    let rebuilt = '';
    for (let c = 0; c < W; c++) {
      for (let r = 0; r < grid.length; r++) rebuilt += grid[r][c];
    }
    rebuilt = rebuilt.replace(/　+$/g, '');
    // 按标点粗切段，方便阅读
    return rebuilt.replace(/([。！？…])/g, '$1\n');
  });
  return out.join('\n\n');
}

$('fixVerticalBtn').addEventListener('click', () => {
  if (!backupRaw) return alert('请先导入小说');
  if (!chapters.length) return;
  const full = chapters.map(c => c.title + '\n' + c.content.join('\n')).join('\n\n');
  const fixed = verticalFix(backupRaw.length > full.length / 2 ? backupRaw : full);
  // 重新切章
  const title = $('bookTitle').textContent;
  loadBook(title + '（横版）', fixed);
  $('undoFixBtn').disabled = false;
});
$('undoFixBtn').addEventListener('click', () => {
  if (!backupRaw) return;
  loadBook($('bookTitle').textContent.replace('（横版）', ''), backupRaw);
  $('undoFixBtn').disabled = true;
});

// ---------- 渲染 ----------
function renderToc(filter = '') {
  tocEl.innerHTML = '';
  chapters.forEach((c, i) => {
    if (filter && !c.title.includes(filter)) return;
    const b = document.createElement('button');
    b.textContent = c.title;
    if (i === current) b.classList.add('active');
    b.onclick = () => { current = i; renderChapter(); renderToc($('searchToc').value.trim()); if (window.innerWidth < 1000) $('sidebar').classList.remove('open'); };
    tocEl.appendChild(b);
  });
  $('chapterCount').textContent = chapters.length + ' 章';
}
function renderChapter() {
  if (!chapters.length) return;
  const c = chapters[current];
  $('chapterTitle').textContent = c.title;
  reader.innerHTML = '';
  const h = document.createElement('h2');
  h.textContent = c.title;
  h.style.cssText = 'text-align:center;font-size:1.3em;margin-bottom:1em';
  reader.appendChild(h);
  c.content.forEach(p => {
    const el = document.createElement('p');
    el.textContent = '　　' + p;
    reader.appendChild(el);
  });
  $('pageInfo').textContent = `${current + 1} / ${chapters.length}`;
  reader.scrollTop = 0; window.scrollTo({ top: 0 });
}
$('searchToc').addEventListener('input', e => renderToc(e.target.value.trim()));
$('prevBtn').onclick = () => { if (current > 0) { current--; renderChapter(); renderToc(); } };
$('nextBtn').onclick = () => { if (current < chapters.length - 1) { current++; renderChapter(); renderToc(); } };

// ---------- 版式 / 主题 ----------
$('modeH').onclick = () => setMode('horizontal');
$('modeV').onclick = () => setMode('vertical');
$('modeH2').onclick = () => setMode('horizontal');
$('modeV2').onclick = () => setMode('vertical');

const THEMES = {
  qidian: { bg: '#f6f1e7', text: '#333333' },
  white: { bg: '#ffffff', text: '#222222' },
  green: { bg: '#e8f5e9', text: '#2e3b2e' },
  dark: { bg: '#1a1a1a', text: '#cccccc' },
  pink: { bg: '#fdf0f3', text: '#5b3a42' }
};
document.querySelectorAll('.theme-dot').forEach(d => {
  d.onclick = () => {
    const t = THEMES[d.dataset.theme];
    settings.bg = t.bg; settings.text = t.text; applySettings();
  };
});
$('bgColor').oninput = e => { settings.bg = e.target.value; applySettings(); };
$('textColor').oninput = e => { settings.text = e.target.value; applySettings(); };
$('fontSize').oninput = e => { settings.fontSize = +e.target.value; applySettings(); };
$('lineHeight').oninput = e => { settings.lineHeight = +e.target.value; applySettings(); };
$('contentWidth').oninput = e => { settings.width = +e.target.value; applySettings(); };
$('fontFamily').onchange = e => { settings.fontFamily = e.target.value; applySettings(); };
$('resetBtn').onclick = () => { settings = { ...DEFAULTS }; document.querySelectorAll('link[data-custom-font]').forEach(l => l.remove()); applySettings(); };

// ---------- 自定义字体链接 ----------
$('loadFontBtn').onclick = () => {
  const url = $('fontUrl').value.trim();
  const name = $('fontName').value.trim() || 'CustomFont';
  if (!url) return alert('请先粘贴字体链接');
  document.querySelectorAll('link[data-custom-font],style[data-custom-font]').forEach(n => n.remove());
  const st = $('fontStatus');
  if (/\.css(\?|$)/.test(url) || url.includes('fonts.googleapis')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = url; l.dataset.customFont = '1';
    l.onload = () => st.textContent = '✅ 字体 CSS 已加载，上面选“自定义”即可使用：' + name;
    l.onerror = () => st.textContent = '❌ 链接加载失败，检查网址是否可公开访问';
    document.head.appendChild(l);
  } else if (/\.(woff2?|ttf|otf)(\?|$)/i.test(url)) {
    const s = document.createElement('style');
    s.dataset.customFont = '1';
    const fmt = url.includes('.woff2') ? 'woff2' : url.includes('.woff') ? 'woff' : 'truetype';
    s.textContent = `@font-face{font-family:'${name}';src:url('${url}') format('${fmt}');}`;
    document.head.appendChild(s);
    st.textContent = '✅ 字体文件已注入，上面选“自定义”即可使用：' + name;
  } else {
    return alert('链接格式不认：请用 fonts css 链接，或 .woff2/.woff/.ttf/.otf 直链');
  }
  settings.fontUrl = url; settings.fontName = name; settings.fontFamily = 'custom';
  applySettings();
};
$('clearFontBtn').onclick = () => {
  document.querySelectorAll('link[data-custom-font],style[data-custom-font]').forEach(n => n.remove());
  settings.fontUrl = ''; settings.fontName = ''; settings.fontFamily = DEFAULTS.fontFamily;
  $('fontStatus').textContent = ''; applySettings();
};
// 启动时恢复已保存的自定义字体
if (settings.fontUrl) { const u = settings.fontUrl, n = settings.fontName; settings.fontUrl = ''; setTimeout(() => { $('fontUrl').value = u; $('fontName').value = n; $('loadFontBtn').click(); }, 300); }

// ---------- 导出横版 ----------
$('exportBtn').onclick = () => {
  if (!chapters.length) return alert('请先导入小说');
  const text = $('bookTitle').textContent + '\n\n' +
    chapters.map(c => c.title + '\n\n' + c.content.join('\n')).join('\n\n');
  const blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = $('bookTitle').textContent + '_横版.txt';
  a.click();
};

// ---------- 示例（模拟竖版来源，默认横版显示） ----------
$('sampleBtn').onclick = () => {
  loadBook('示例小说《长夜灯火》', `第一章 入城
　　夜雨敲着青石板，沈知微提着一盏纸灯，站在城门口。
　　守城的老兵打量她一眼，瓮声瓮气地问，来投亲还是赶考。
　　她笑，说来找一个人，一个很多年前把灯借给她的人。

第二章 灯市
　　灯市三千盏，人间一团火。
　　她在人群里逆行，纸灯的光晕染开，像水里化开的一滴蜜。
　　忽然有人在背后喊她的名字，声音很轻，却穿过了整条街。

第三章 故人
　　转身处，长街尽头站着一个人，撑着一把旧油纸伞。
　　伞下眉眼未变，只是多了些风霜。
　　他说，这盏灯，我等你还了十年。

番外 尾声
　　雨停了，灯还亮着。
　　从此长夜有火，归路有人。`);
};

// ---------- 移动端目录 ----------
const toggleToc = () => $('sidebar').classList.toggle('open');
$('tocToggle').onclick = toggleToc;
$('fabToc').onclick = toggleToc;

applySettings();
