/* EMT-P 甄試考古題練習
   純靜態、無外部相依。題目資料在 questions-data.js。 */
'use strict';

const $ = (id) => document.getElementById(id);
const el = {
  total: $('total'), links: $('source-links'), years: $('years'),
  jump: $('jump'), score: $('score'), fill: $('bar-fill'),
  topUserName: $('top-user-name'), userChip: $('user-chip'),

  // 第一頁
  viewIntro: $('view-intro'),
  inputName: $('input-examinee-name'),
  btnSaveName: $('btn-save-name'),
  nameSaveStatus: $('name-save-status'),
  btnStartQuiz: $('btn-start-quiz'),
  btnResumeQuiz: $('btn-resume-quiz'),

  // 試題頁
  viewQuestion: $('view-question'),
  origin: $('origin'), review: $('review'), stem: $('stem'), figures: $('figures'),
  choices: $('choices'), feedback: $('feedback'),
  toggleExplain: $('toggle-explain'), explainBox: $('explain-box'),

  // 增加的最後一頁
  viewResult: $('view-result'),
  resultExamineeName: $('result-examinee-name'),
  btnEditName: $('btn-edit-name'),
  resultTotalScore: $('result-total-score'),
  resultPassRate: $('result-pass-rate'),
  statOkCount: $('stat-ok-count'),
  statAltCount: $('stat-alt-count'),
  statBadCount: $('stat-bad-count'),
  statUnansweredCount: $('stat-unanswered-count'),
  mistakesContainer: $('review-mistakes-container'),
  mistakesList: $('mistakes-list'),
  btnReviewQ1: $('btn-review-q1'),
  btnRestartQuiz: $('btn-restart-quiz'),

  // 底部導覽按鈕
  prev: $('prev'), next: $('next'),
};

const KEYS = ['A', 'B', 'C', 'D'];
const DATA = window.KHB_EMTP_QUIZ;
const STORE = 'khb-emtp-quiz-109-v2';
const LEGACY_STORE = 'khb-emtp-quiz-109-v1';

let year = null;
let questions = [];
let i = -1;           // -1 = 第一頁, 0..99 = 試題, 100 = 最後一頁
let picks = {};       // { "109-001": "A" }
let examineeName = '';
let explainVisible = false;

function init() {
  if (!DATA || !DATA.years || !Object.keys(DATA.years).length) {
    if (el.stem) el.stem.textContent = '題庫檔案不完整，請重新整理網頁。';
    return;
  }

  const saved = load();
  picks = saved.picks || {};
  examineeName = saved.name || '';
  updateNameDisplays();

  const years = Object.keys(DATA.years).sort();
  year = years.includes(saved.year) ? saved.year : years[years.length - 1];
  questions = DATA.years[year].questions;
  if (el.total) el.total.textContent = questions.length;

  if (el.links) {
    el.links.replaceChildren(...years.map((y) => {
      const a = document.createElement('a');
      a.href = DATA.years[y].url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = `${y} 年度題目卷 PDF`;
      return a;
    }));
  }

  // 綁定第一頁考生姓名事件
  if (el.inputName) {
    el.inputName.value = examineeName;
    el.inputName.addEventListener('input', (e) => {
      examineeName = e.target.value.trim();
      updateNameDisplays();
      save();
    });
    el.inputName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveNameNotice();
        go(0);
      }
    });
  }

  if (el.btnSaveName) {
    el.btnSaveName.onclick = () => {
      if (el.inputName) examineeName = el.inputName.value.trim();
      updateNameDisplays();
      save();
      saveNameNotice();
    };
  }

  if (el.userChip) {
    el.userChip.onclick = () => go(-1);
  }

  if (el.btnEditName) {
    el.btnEditName.onclick = () => {
      go(-1);
      setTimeout(() => { if (el.inputName) el.inputName.focus(); }, 100);
    };
  }

  if (el.btnStartQuiz) {
    el.btnStartQuiz.onclick = () => {
      if (el.inputName) examineeName = el.inputName.value.trim();
      updateNameDisplays();
      save();
      go(0);
    };
  }

  if (el.btnResumeQuiz) {
    const answeredCount = Object.keys(picks).length;
    if (answeredCount > 0 && answeredCount < questions.length) {
      el.btnResumeQuiz.classList.remove('hidden');
      el.btnResumeQuiz.onclick = () => {
        // 找到第一個尚未作答的題目
        const firstUnanswered = questions.findIndex((q) => !picks[q.id]);
        go(firstUnanswered !== -1 ? firstUnanswered : 0);
      };
    } else {
      el.btnResumeQuiz.classList.add('hidden');
    }
  }

  // 綁定最後一頁事件
  if (el.btnReviewQ1) {
    el.btnReviewQ1.onclick = () => go(0);
  }

  if (el.btnRestartQuiz) {
    el.btnRestartQuiz.onclick = () => {
      if (confirm('確定要清除所有作答紀錄並重新測驗嗎？（考生姓名將會保留）')) {
        picks = {};
        save();
        buildJumpMenu();
        go(-1);
      }
    };
  }

  // 詳解按鈕
  if (el.toggleExplain) {
    el.toggleExplain.onclick = () => toggleExplanation();
  }

  // 鍵盤左右鍵切換
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') {
      if (i > -1) go(i - 1);
    }
    if (e.key === 'ArrowRight') {
      if (i < questions.length) go(i + 1);
    }
  });

  // 建置導覽下拉選單
  buildJumpMenu();
  if (el.jump) {
    el.jump.onchange = () => go(Number(el.jump.value));
  }

  // 決定起始頁面
  let targetIndex = -1;
  if (typeof saved.index === 'number' && saved.index >= -1 && saved.index <= questions.length) {
    targetIndex = saved.index;
  }
  go(targetIndex);
}

function updateNameDisplays() {
  const display = examineeName || '未填寫';
  if (el.topUserName) el.topUserName.textContent = display;
  if (el.resultExamineeName) el.resultExamineeName.textContent = examineeName || '（未填寫）';
}

function saveNameNotice() {
  if (!el.nameSaveStatus) return;
  const original = el.nameSaveStatus.innerHTML;
  el.nameSaveStatus.innerHTML = '✅ <b style="color:var(--ok);">姓名已成功儲存！隨時可點擊「開始作答」。</b>';
  setTimeout(() => {
    if (el.nameSaveStatus) el.nameSaveStatus.innerHTML = original;
  }, 2500);
}

function buildJumpMenu() {
  if (!el.jump) return;
  const options = [];

  // 第一頁
  const optIntro = document.createElement('option');
  optIntro.value = -1;
  optIntro.textContent = '📝 [第一頁] 測試人員資訊與測驗指引';
  options.push(optIntro);

  // 題目 1~100
  questions.forEach((q, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    const isDone = picks[q.id];
    let tag = '';
    if (isDone) {
      const v = judge(q, isDone);
      tag = v === 'ok' ? ' [✓對]' : v === 'alt' ? ' [~勉]' : ' [✗錯]';
    }
    opt.textContent = `第 ${q.no} 題${tag}${q.needsReview ? '（含圖）' : ''}`;
    options.push(opt);
  });

  // 增加的最後一頁
  const optResult = document.createElement('option');
  optResult.value = questions.length;
  optResult.textContent = '🏁 [最後一頁] ～所有試題均已完成，辛苦了！～';
  options.push(optResult);

  el.jump.replaceChildren(...options);
}

function go(n) {
  if (n < -1 || n > questions.length) return;
  i = n;
  explainVisible = false;
  render();
  save();

  const panel = $('quiz');
  if (panel && panel.getBoundingClientRect().top < 0) {
    panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

function render() {
  if (el.jump) el.jump.value = i;
  updateScore();

  // 進度條
  if (el.fill) {
    if (i === -1) {
      el.fill.style.width = '0%';
    } else if (i === questions.length) {
      el.fill.style.width = '100%';
    } else {
      el.fill.style.width = `${((i + 1) / questions.length * 100)}%`;
    }
  }

  // 頁面顯示切換
  if (el.viewIntro) el.viewIntro.classList.toggle('hidden', i !== -1);
  if (el.viewQuestion) el.viewQuestion.classList.toggle('hidden', i < 0 || i >= questions.length);
  if (el.viewResult) el.viewResult.classList.toggle('hidden', i !== questions.length);

  // 狀態處理
  if (i === -1) {
    renderIntro();
  } else if (i === questions.length) {
    renderResult();
  } else {
    renderQuestion();
  }
}

/* ---------- 第一頁 ---------- */
function renderIntro() {
  if (el.prev) {
    el.prev.disabled = true;
    el.prev.textContent = '← 第一頁';
  }
  if (el.toggleExplain) {
    el.toggleExplain.classList.add('hidden');
  }
  if (el.next) {
    el.next.disabled = false;
    el.next.textContent = '開始作答（第 1 題）→';
    el.next.onclick = () => {
      if (el.inputName) examineeName = el.inputName.value.trim();
      updateNameDisplays();
      save();
      go(0);
    };
  }

  const answeredCount = Object.keys(picks).length;
  if (el.btnResumeQuiz) {
    if (answeredCount > 0 && answeredCount < questions.length) {
      el.btnResumeQuiz.classList.remove('hidden');
      el.btnResumeQuiz.textContent = `繼續上次進度（已完成 ${answeredCount} 題）→`;
    } else {
      el.btnResumeQuiz.classList.add('hidden');
    }
  }
}

/* ---------- 試題頁面 (1~100 題) ---------- */
function renderQuestion() {
  const q = questions[i];
  if (!q) return;

  if (el.origin) {
    el.origin.textContent = `${year} 年度 第 ${q.no} 題` + (q.pdfPage ? ` · 原卷第 ${q.pdfPage} 頁` : '');
  }

  if (el.review) {
    if (q.needsReview) {
      el.review.textContent = '需人工確認：' + (q.reviewReasons || []).join('；');
      el.review.classList.remove('hidden');
    } else {
      el.review.classList.add('hidden');
    }
  }

  if (el.stem) el.stem.textContent = q.stem;

  if (el.figures) {
    el.figures.replaceChildren(...(q.figures || []).map((src) => {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.src = src;
      img.alt = `${year} 年度第 ${q.no} 題原卷截圖`;
      const cap = document.createElement('figcaption');
      cap.textContent = '原卷高解析心電圖／波形截圖（點擊可另開大圖檢視）';
      img.style.cursor = 'zoom-in';
      img.onclick = () => window.open(src, '_blank');
      fig.append(img, cap);
      return fig;
    }));
  }

  if (el.choices) {
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
  }

  // 底部導覽按鈕
  if (el.prev) {
    el.prev.disabled = false;
    el.prev.textContent = (i === 0) ? '← 第一頁（考生資訊）' : '← 上一題';
    el.prev.onclick = () => go(i - 1);
  }

  if (el.toggleExplain) {
    el.toggleExplain.classList.remove('hidden');
  }

  if (el.next) {
    el.next.disabled = false;
    if (i === questions.length - 1) {
      el.next.textContent = '完成交卷（結算成績）➔';
      el.next.onclick = () => go(questions.length);
    } else {
      el.next.textContent = '下一題 →';
      el.next.onclick = () => go(i + 1);
    }
  }

  const done = picks[q.id];
  if (done) showFeedback(q, done);
  else if (el.feedback) el.feedback.classList.add('hidden');
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
  buildJumpMenu();                  // 更新下拉選單標記
}

function showFeedback(q, k) {
  const v = judge(q, k);
  if (el.choices) {
    [...el.choices.children].forEach((node) => {
      const key = node.dataset.key;
      node.disabled = true;
      node.classList.add('locked');
      if (q.answer.includes(key)) node.classList.add('correct');
      else if (q.acceptedAltAll || (q.acceptedAlt || []).includes(key)) node.classList.add('alt');
      if (key === k && v === 'bad') node.classList.add('chosen-wrong');
      if (key === k) node.classList.add('chosen');
    });
  }

  const ans = q.answer.join('、');
  const lines = [];
  lines.push(`<p class="verdict ${v}">${
    v === 'ok' ? '答對了' : v === 'alt' ? '勉予給分' : '答錯了'
  }　你選 ${k}</p>`);
  let official = `官方答案：<b>${escape(ans)}</b>`;
  if (q.answer.length > 1) {
    official += `<span class="note">答案欄原文為「${escape(q.answerRaw)}」，本練習把官方公佈的複選每個選項都算對。</span>`;
  }
  lines.push(`<p>${official}</p>`);
  if (q.acceptedAltAll) {
    lines.push(`<p>答案卷括號註記：<b>送分</b><span class="note">原文「${escape(q.answerRaw)}」</span></p>`);
  } else if ((q.acceptedAlt || []).length) {
    lines.push(`<p>勉予給分：<b>${escape(q.acceptedAlt.join('、'))}</b><span class="note">答案卷括號註記，原文「${escape(q.answerRaw)}」</span></p>`);
  }

  if (el.feedback) {
    el.feedback.innerHTML = lines.join('');
    el.feedback.classList.remove('hidden');
  }
  updateExplainState();
}

function updateScore() {
  if (!el.score || !questions.length) return;
  const answered = questions.filter((q) => picks[q.id]);
  const right = answered.filter((q) => judge(q, picks[q.id]) !== 'bad').length;
  el.score.textContent = `已作答 ${answered.length}／${questions.length}　得分 ${right}`;
}

/* ---------- 增加的最後一頁（成績結算頁） ---------- */
function renderResult() {
  if (el.prev) {
    el.prev.disabled = false;
    el.prev.textContent = '← 返回第 100 題';
    el.prev.onclick = () => go(questions.length - 1);
  }
  if (el.toggleExplain) {
    el.toggleExplain.classList.add('hidden');
  }
  if (el.next) {
    el.next.disabled = true;
    el.next.textContent = '已至最後一頁';
  }

  updateNameDisplays();

  let okCount = 0;
  let altCount = 0;
  let badCount = 0;
  let unansweredCount = 0;
  const mistakeQuestions = [];

  questions.forEach((q, idx) => {
    const choice = picks[q.id];
    if (!choice) {
      unansweredCount++;
      mistakeQuestions.push({ q, idx, status: 'empty' });
    } else {
      const v = judge(q, choice);
      if (v === 'ok') okCount++;
      else if (v === 'alt') altCount++;
      else {
        badCount++;
        mistakeQuestions.push({ q, idx, status: 'bad' });
      }
    }
  });

  const totalScore = okCount + altCount;
  const rate = Math.round((totalScore / questions.length) * 100);

  if (el.resultTotalScore) el.resultTotalScore.textContent = totalScore;
  if (el.resultPassRate) el.resultPassRate.textContent = `正確率 ${rate}% · 全卷 100 題`;
  if (el.statOkCount) el.statOkCount.textContent = okCount;
  if (el.statAltCount) el.statAltCount.textContent = altCount;
  if (el.statBadCount) el.statBadCount.textContent = badCount;
  if (el.statUnansweredCount) el.statUnansweredCount.textContent = unansweredCount;

  // 錯題檢視按鈕清單
  if (el.mistakesList && el.mistakesContainer) {
    if (mistakeQuestions.length === 0) {
      el.mistakesContainer.classList.add('hidden');
    } else {
      el.mistakesContainer.classList.remove('hidden');
      el.mistakesList.replaceChildren(...mistakeQuestions.map((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `mistake-chip ${item.status}`;
        btn.textContent = `第 ${item.q.no} 題 ${item.status === 'empty' ? '(未作答)' : '(答錯)'}`;
        btn.onclick = () => go(item.idx);
        return btn;
      }));
    }
  }
}

/* ---------- 詳解展開與工具 ---------- */
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

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return JSON.parse(raw) || {};
    // 相容遷移 v1 舊資料
    const legacy = localStorage.getItem(LEGACY_STORE);
    if (legacy) return JSON.parse(legacy) || {};
    return {};
  } catch (e) {
    return {};
  }
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({
      year,
      index: i,
      picks,
      name: examineeName,
    }));
  } catch (e) {
    /* 無痕或封鎖時略過 */
  }
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 啟動測驗
init();
