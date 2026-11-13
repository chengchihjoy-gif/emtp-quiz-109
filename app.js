/* EMT-P 甄試考古題練習（KHB-01 示範）
   純靜態、無外部相依。題目資料在 questions-data.js（由 scripts/package-khb-emtp-quiz.py 產生）。 */
'use strict';

const $ = (id) => document.getElementById(id);
const el = {
  yearLabel: $('year-label'), total: $('total'), links: $('source-links'),
  years: $('years'), jump: $('jump'), score: $('score'), fill: $('bar-fill'),
  origin: $('origin'), review: $('review'), stem: $('stem'), figures: $('figures'),
  choices: $('choices'), feedback: $('feedback'), prev: $('prev'), next: $('next'),
  toggleExplain: $('toggle-explain'), explainBox: $('explain-box'),
};

const KEYS = ['A', 'B', 'C', 'D'];
const DATA = window.KHB_EMTP_QUIZ;
const STORE = 'khb-emtp-quiz-109-v1';

let year = null;
let questions = [];
let i = 0;
let picks = {};   // { "109-001": "A" }
let explainVisible = false;

function init() {
  if (!DATA || !DATA.years || !Object.keys(DATA.years).length) {
    el.stem.textContent = '題庫檔案不完整，請重新下載或解壓縮整個資料夾。';
    return;
  }
  const saved = load();
  picks = saved.picks || {};
  const years = Object.keys(DATA.years).sort();

  el.links.replaceChildren(...years.map((y) => {
    const a = document.createElement('a');
    a.href = DATA.years[y].url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = `${y} 年度題目卷 PDF`;
    return a;
  }));

  if (years.length > 1) {
    el.years.replaceChildren(...years.map((y) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'year';
      b.dataset.year = y;
      b.textContent = `${y} 年度`;
      b.onclick = () => selectYear(y, 0);
      return b;
    }));
  } else {
    el.years.classList.add('hidden');
  }

  el.prev.onclick = () => go(i - 1);
  el.next.onclick = () => go(i + 1);
  el.jump.onchange = () => go(Number(el.jump.value));
  el.toggleExplain.onclick = () => toggleExplanation();
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT') return;
    if (e.key === 'ArrowLeft') go(i - 1);
    if (e.key === 'ArrowRight') go(i + 1);
  });

  const startYear = years.includes(saved.year) ? saved.year : years[years.length - 1];
  selectYear(startYear, saved.year === startYear ? saved.index || 0 : 0);
}

function selectYear(y, index) {
  year = y;
  questions = DATA.years[y].questions;
  el.yearLabel.textContent = `${y} 年度`;
  el.total.textContent = questions.length;
  [...el.years.children].forEach((b) => {
    const on = b.dataset.year === y;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  el.jump.replaceChildren(...questions.map((q, n) => {
    const o = document.createElement('option');
    o.value = n;
    o.textContent = `第 ${q.no} 題${q.needsReview ? '（含圖／需確認）' : ''}`;
    return o;
  }));
  go(Math.min(Math.max(index, 0), questions.length - 1));
}

function go(n) {
  if (n < 0 || n >= questions.length) return;
  i = n;
  explainVisible = false;
  render();
  save();
  const panel = $('quiz');
  if (panel.getBoundingClientRect().top < 0) panel.scrollIntoView({ block: 'start' });
}

/* ---------- 題目 ---------- */

function render() {
  const q = questions[i];
  el.jump.value = i;
  el.fill.style.width = ((i + 1) / questions.length * 100) + '%';
  el.origin.textContent = `${year} 年度 第 ${q.no} 題` + (q.pdfPage ? ` · 原卷第 ${q.pdfPage} 頁` : '');

  if (q.needsReview) {
    el.review.textContent = '需人工確認：' + (q.reviewReasons || []).join('；');
    el.review.classList.remove('hidden');
  } else {
    el.review.classList.add('hidden');
  }

  el.stem.textContent = q.stem;
  el.figures.replaceChildren(...(q.figures || []).map((src) => {
    const fig = document.createElement('figure');
    const img = document.createElement('img');
    img.src = src;
    img.alt = `${year} 年度第 ${q.no} 題原卷截圖`;
    const cap = document.createElement('figcaption');
    cap.textContent = '原卷截圖（含圖題，文字擷取看不到圖）';
    fig.append(img, cap);
    return fig;
  }));

  el.choices.replaceChildren(...KEYS.map((k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.dataset.key = k;
    const text = q.options[k] || '（圖片選項，請看上方原卷截圖）';
    b.innerHTML = `<span class="k">${k}</span><span class="t">${escape(text)}</span>`;
    b.onclick = () => pick(k);
    return b;
  }));

  el.prev.disabled = i === 0;
  el.next.disabled = i === questions.length - 1;
  updateScore();

  const done = picks[q.id];
  if (done) showFeedback(q, done);
  else el.feedback.classList.add('hidden');
  updateExplainState();
}

function judge(q, k) {
  if (q.answer.includes(k)) return 'ok';
  if (q.acceptedAltAll || (q.acceptedAlt || []).includes(k)) return 'alt';
  return 'bad';
}

function pick(k) {
  const q = questions[i];
  if (picks[q.id]) return;          // 每題作答一次；換題再回來仍顯示結果
  picks[q.id] = k;
  save();
  showFeedback(q, k);
  updateScore();
}

function showFeedback(q, k) {
  const v = judge(q, k);
  [...el.choices.children].forEach((node) => {
    const key = node.dataset.key;
    node.disabled = true;
    node.classList.add('locked');
    if (q.answer.includes(key)) node.classList.add('correct');
    else if (q.acceptedAltAll || (q.acceptedAlt || []).includes(key)) node.classList.add('alt');
    if (key === k && v === 'bad') node.classList.add('chosen-wrong');
    if (key === k) node.classList.add('chosen');
  });

  const ans = q.answer.join('、');
  const lines = [];
  lines.push(`<p class="verdict ${v}">${
    v === 'ok' ? '答對了' : v === 'alt' ? '勉予給分' : '答錯了'
  }　你選 ${k}</p>`);
  let official = `官方答案：<b>${escape(ans)}</b>`;
  if (q.answer.length > 1) {
    official += `<span class="note">答案欄原文為「${escape(q.answerRaw)}」，本練習把列出的每個選項都算對。</span>`;
  }
  lines.push(`<p>${official}</p>`);
  if (q.acceptedAltAll) {
    lines.push(`<p>答案卷括號註記：<b>送分</b><span class="note">原文「${escape(q.answerRaw)}」</span></p>`);
  } else if ((q.acceptedAlt || []).length) {
    lines.push(`<p>勉予給分：<b>${escape(q.acceptedAlt.join('、'))}</b><span class="note">答案卷括號註記，原文「${escape(q.answerRaw)}」</span></p>`);
  }
  el.feedback.innerHTML = lines.join('');
  el.feedback.classList.remove('hidden');
  updateExplainState();
}

function updateScore() {
  const answered = questions.filter((q) => picks[q.id]);
  const right = answered.filter((q) => judge(q, picks[q.id]) !== 'bad').length;
  el.score.textContent = `已作答 ${answered.length}／${questions.length}　答對 ${right}`;
}

/* ---------- 工具 ---------- */

function load() {
  try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; }
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ year, index: i, picks })); } catch (e) { /* 無痕或封鎖時略過 */ }
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}


function toggleExplanation() {
  explainVisible = !explainVisible;
  updateExplainState();
}

function updateExplainState() {
  const q = questions[i];
  if (!el.explainBox || !el.toggleExplain) return;
  
  if (explainVisible) {
    el.toggleExplain.textContent = '🙈 收起本題詳解';
    el.toggleExplain.classList.add('on');
    if (q && q.explanation) {
      el.explainBox.innerHTML = q.explanation;
      el.explainBox.classList.remove('hidden');
      el.explainBox.style.display = 'block';
    } else {
      el.explainBox.innerHTML = '<p class="explain">本題暫無詳解。</p>';
      el.explainBox.classList.remove('hidden');
      el.explainBox.style.display = 'block';
    }
  } else {
    el.toggleExplain.textContent = '💡 查看本題詳解';
    el.toggleExplain.classList.remove('on');
    el.explainBox.classList.add('hidden');
    el.explainBox.style.display = 'none';
  }
}

// 啟動測驗
init();
