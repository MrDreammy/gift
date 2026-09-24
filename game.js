/* Рушій гри. Запитання й тексти редагуються в questions.js — цей файл чіпати не потрібно. */
(() => {
  'use strict';

  const cfg = window.GAME_CONFIG;
  const $ = (sel) => document.querySelector(sel);

  if (!cfg || !Array.isArray(cfg.questions) || cfg.questions.length === 0) {
    $('#app').innerHTML =
      '<p class="fatal">Запитання не завантажилися. Перевір, що файл <code>questions.js</code> лежить поруч з index.html і в ньому немає синтаксичних помилок (відкрий консоль браузера: F12).</p>';
    return;
  }

  /* ---------- Налаштування ---------- */
  const LETTERS = ['A', 'B', 'C', 'D'];
  const KEYMAP = new Map([
    ['a', 0], ['b', 1], ['c', 2], ['d', 3],
    ['ф', 0], ['и', 1], ['с', 2], ['в', 3], // та сама клавіша в кириличній розкладці
    ['1', 0], ['2', 1], ['3', 2], ['4', 3],
  ]);
  const DEFAULT_LADDER = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
  const total = cfg.questions.length;
  const lifelinesOn = Object.assign({ fifty: true, phone: true, audience: true }, cfg.lifelines || {});

  const prizes = (() => {
    if (Array.isArray(cfg.prizes) && cfg.prizes.length === total) return cfg.prizes;
    if (Array.isArray(cfg.prizes) && cfg.prizes.length) {
      console.warn(`[гра] У prizes ${cfg.prizes.length} значень, а запитань ${total}. Шкалу призів створено автоматично.`);
    }
    if (total <= DEFAULT_LADDER.length) return DEFAULT_LADDER.slice(-total);
    return Array.from({ length: total }, (_, i) => Math.max(1, Math.round(1000000 / 2 ** (total - 1 - i))));
  })();

  const safeHavens = Array.isArray(cfg.safeHavens)
    ? cfg.safeHavens.filter((n) => Number.isInteger(n) && n >= 1 && n <= total)
    : total >= 6 ? [Math.round(total / 3), Math.round((total * 2) / 3)] : [];

  const fmt = (v) =>
    typeof v === 'number'
      ? v.toLocaleString('uk-UA') + (cfg.currency ? '\u00A0' + cfg.currency : '')
      : String(v);
  const zeroText = () => cfg.zeroPrizeText || fmt(0);
  const prizeText = (v) => (v === 0 ? zeroText() : fmt(v));

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  // «1 запитання», «3 запитання», «20 запитань»
  const pluralQuestions = (n) => {
    const m10 = n % 10, m100 = n % 100;
    return m10 >= 1 && m10 <= 4 && (m100 < 11 || m100 > 14) ? 'запитання' : 'запитань';
  };
  // [5, 10, 15] → «5, 10 і 15»
  const joinList = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' і ' + a[a.length - 1]);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const buildQuestions = () =>
    cfg.questions.map((q, n) => {
      const raw = Array.isArray(q.answers) ? q.answers.slice(0, 4) : [];
      if (raw.length < 2) console.warn(`[гра] Запитання ${n + 1}: потрібно від 2 до 4 відповідей.`);
      const correct = Number.isInteger(q.correct) && q.correct >= 0 && q.correct < raw.length ? q.correct : 0;
      let answers = raw.map((text, i) => ({ text: String(text), orig: i, correct: i === correct }));
      if (cfg.shuffleAnswers !== false && !q.keepOrder) answers = shuffle(answers);
      return { ...q, answers, correctIndex: answers.findIndex((a) => a.correct) };
    });

  /* ---------- DOM ---------- */
  const el = {
    qNum: $('#q-num'), qTotal: $('#q-total'), qPrize: $('#q-prize'), qText: $('#q-text'), qImage: $('#q-image'),
    qBlock: $('#question-block'), answers: $('#answers'),
    result: $('#result'), resultTitle: $('#result-title'), resultImage: $('#result-image'), resultText: $('#result-text'), resultNote: $('#result-note'),
    next: $('#btn-next'), walk: $('#btn-walk'), confirm: $('#btn-confirm'),
    panel: $('#panel'), panelTitle: $('#panel-title'), panelBody: $('#panel-body'),
    ladder: $('#ladder'), ladderList: $('#ladder-list'), ladderBtn: $('#btn-ladder'),
    sound: $('#btn-sound'),
    modal: $('#modal'), modalTitle: $('#modal-title'), modalText: $('#modal-text'),
    modalOk: $('#modal-ok'), modalCancel: $('#modal-cancel'),
    endImage: $('#end-image'),
    canvas: $('#confetti'),
  };
  const lifelineBtns = [...document.querySelectorAll('.lifeline')];
  const answerBtns = () => [...el.answers.children];

  /* ---------- Звук (генерується в браузері, файли не потрібні) ---------- */
  let soundOn = true;
  try { soundOn = localStorage.getItem('quiz-sound') !== 'off'; } catch (e) { /* без сховища — не страшно */ }
  let actx = null;
  function tone(freqs, dur = 0.15, type = 'sine', gap = 0, vol = 0.08) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      let t = actx.currentTime + 0.01;
      freqs.forEach((f) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = type;
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(actx.destination);
        o.start(t);
        o.stop(t + dur + 0.03);
        t += dur + gap;
      });
    } catch (e) { /* звук не критичний */ }
  }
  const sfx = {
    start: () => tone([392, 523, 659, 784], 0.14, 'triangle'),
    select: () => tone([660], 0.07, 'triangle', 0, 0.06),
    lock: () => tone([196, 196, 196], 0.22, 'sine', 0.35, 0.07),
    correct: () => tone([523, 659, 784, 1046], 0.12, 'triangle'),
    wrong: () => tone([311, 233], 0.4, 'sawtooth', 0, 0.05),
    lifeline: () => tone([880, 1175], 0.09, 'sine'),
    win: () => tone([523, 659, 784, 1046, 784, 1046, 1318], 0.15, 'triangle'),
  };
  function renderSound() {
    el.sound.setAttribute('aria-pressed', String(soundOn));
    el.sound.title = soundOn ? 'Вимкнути звук' : 'Увімкнути звук';
  }

  /* ---------- Стан ---------- */
  let questions = [];
  let state = null;
  let onNext = null;

  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.id === id));
    // Кіт видний тільки під час гри
    const cat = document.querySelector('.cat');
    if (cat) {
      cat.classList.toggle('visible', id === 'screen-game');
    }
    window.scrollTo(0, 0);
  }

  function startGame() {
    const built = buildQuestions();
    // Відокремлюємо запитання з keepOrder від звичайних
    const withKeepOrder = built.filter((q) => q.keepOrder);
    const toShuffle = built.filter((q) => !q.keepOrder);
    // Перемішуємо звичайні запитання
    questions = shuffle(toShuffle).concat(withKeepOrder);
    state = { idx: 0, selected: null, locked: false, used: { fifty: false, phone: false, audience: false }, hidden: new Set(), correctAnswerCount: 0 };
    show('screen-game');
    renderQuestion();
    sfx.start();
  }

  /* ---------- Рендер запитання ---------- */
  function renderQuestion() {
    const q = questions[state.idx];
    state.selected = null;
    state.locked = false;
    state.hidden = new Set();

    el.qNum.textContent = state.idx + 1;
    el.qTotal.textContent = total;
    el.qPrize.textContent = fmt(prizes[state.idx]);
    el.qText.textContent = q.question;

    if (q.image) {
      el.qImage.src = q.image;
      el.qImage.alt = q.imageAlt || '';
      el.qImage.hidden = false;
    } else {
      el.qImage.hidden = true;
      el.qImage.removeAttribute('src');
    }

    el.answers.innerHTML = '';
    q.answers.forEach((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'answer';
      b.innerHTML = `<span class="letter">${LETTERS[i]}:</span><span class="text"></span>`;
      b.querySelector('.text').textContent = a.text;
      b.addEventListener('click', () => select(i));
      el.answers.appendChild(b);
    });

    el.qBlock.classList.remove('enter');
    void el.qBlock.offsetWidth; // перезапуск анімації
    el.qBlock.classList.add('enter');

    el.result.hidden = true;
    el.confirm.hidden = true;
    el.walk.disabled = state.idx === 0; // на першому запитанні забирати ще нічого
    closePanel();
    renderLadder();
    updateLifelines();
  }

  function renderLadder() {
    el.ladderList.innerHTML = '';
    for (let i = total - 1; i >= 0; i--) {
      const li = document.createElement('li');
      li.className = 'rung';
      if (safeHavens.includes(i + 1)) li.classList.add('safe');
      if (state && i === state.idx) li.classList.add('current');
      if (state && i < state.idx) li.classList.add('passed');
      li.innerHTML = '<span class="rung-n"></span><span class="rung-p"></span>';
      li.firstChild.textContent = i + 1;
      li.lastChild.textContent = fmt(prizes[i]);
      el.ladderList.appendChild(li);
    }
    // прокручуємо шкалу так, щоб поточну сходинку було видно
    const cur = el.ladderList.querySelector('.current');
    if (cur && el.ladder.scrollHeight > el.ladder.clientHeight) {
      el.ladder.scrollTop = cur.offsetTop - el.ladder.clientHeight / 2;
    }
  }

  function updateLifelines() {
    lifelineBtns.forEach((b) => {
      const k = b.dataset.lifeline;
      b.hidden = !lifelinesOn[k];
      b.classList.toggle('used', !!state?.used[k]);
      b.disabled = !state || state.used[k] || state.locked;
    });
  }

  /* ---------- Відповіді ---------- */
  function select(i) {
    if (!state || state.locked || state.hidden.has(i)) return;
    if (i >= questions[state.idx].answers.length) return;
    state.selected = i;
    answerBtns().forEach((b, j) => b.classList.toggle('selected', j === i));
    el.confirm.hidden = false;
    sfx.select();
  }

  function lockIn() {
    if (!state || state.locked || state.selected === null) return;
    state.locked = true;
    const btns = answerBtns();
    btns.forEach((b) => (b.disabled = true));
    btns[state.selected].classList.remove('selected');
    btns[state.selected].classList.add('locked');
    el.confirm.hidden = true;
    el.walk.disabled = true;
    updateLifelines();
    closeLadder();
    sfx.lock();
    const delay = Number(cfg.suspenseMs);
    setTimeout(reveal, delay >= 0 ? delay : 2200);
  }

  function createHearts(x, y) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const heartEmojis = ['❤️', '💕', '💖', '💗', '💝'];
    const W = window.innerWidth;
    const H = window.innerHeight;

    for (let i = 0; i < 16; i++) {
      const heart = document.createElement('div');
      heart.className = 'heart';
      heart.textContent = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];

      // Випадкові напрями для вильоту по всьому екрану
      const angle = (i / 16) * Math.PI * 2;
      const distance = 200 + Math.random() * 300;
      const drift = Math.cos(angle) * distance;
      const vertDrift = Math.sin(angle) * distance * 0.7;

      heart.style.setProperty('--drift', drift + 'px');
      heart.style.setProperty('--vert-drift', vertDrift + 'px');
      heart.style.left = x + 'px';
      heart.style.top = y + 'px';

      // Випадкова затримка для ефекту хвилі
      const delay = Math.random() * 0.1;
      heart.style.setProperty('--delay', delay + 's');

      document.body.appendChild(heart);
      setTimeout(() => heart.remove(), 2400);
    }
  }

  function reveal() {
    const q = questions[state.idx];
    const btns = answerBtns();
    const ok = state.selected === q.correctIndex;
    const isLast = state.idx === total - 1;

    btns[state.selected].classList.remove('locked');
    // Показуємо правильну відповідь тільки якщо гравець відповів правильно
    if (ok) {
      btns[q.correctIndex].classList.add('correct');
    }
    if (!ok) btns[state.selected].classList.add('wrong');

    if (ok) {
      sfx.correct();
      el.ladderList.querySelector('.current')?.classList.add('won');
      // Создаём сердечки в центре правильного ответа
      const correctBtn = btns[q.correctIndex];
      const rect = correctBtn.getBoundingClientRect();
      createHearts(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const note = safeHavens.includes(state.idx + 1) && !isLast
        ? `Незгоряна сума: ${fmt(prizes[state.idx])}`
        : '';
      // Циклически показываем фото (correct-1, correct-2, correct-3, correct-4)
      state.correctAnswerCount += 1;
      const correctImageNum = ((state.correctAnswerCount - 1) % 4) + 1;
      const correctImage = `img/correct-${correctImageNum}.webp`;
      showResult({
        ok,
        title: pick(cfg.correctPhrases || ['Правильно!', 'Абсолютно правильно!', 'І це правильна відповідь!']),
        text: q.comment,
        note,
        image: correctImage,
        button: isLast ? 'До головного призу' : 'Наступне запитання',
        next: () => {
          if (isLast) return finish('win');
          state.idx += 1;
          renderQuestion();
        },
      });
    } else {
      sfx.wrong();
      showResult({
        ok,
        title: 'На жаль, це неправильна відповідь',
        text: q.comment || '',
        image: 'img/wrong-answer.webp',
        button: 'Подивитися підсумок',
        next: () => finish('lose'),
      });
    }
  }

  function showResult({ ok, title, text, note, image, button, next }) {
    el.result.className = 'result ' + (ok ? 'is-ok' : 'is-bad');
    el.resultTitle.textContent = title;
    if (image) {
      el.resultImage.src = image;
      el.resultImage.hidden = false;
    } else {
      el.resultImage.hidden = true;
    }
    el.resultText.textContent = text || '';
    el.resultText.hidden = !text;
    el.resultNote.textContent = note || '';
    el.resultNote.hidden = !note;
    el.next.textContent = button;
    onNext = next;
    el.result.hidden = false;
    setTimeout(() => {
      el.next.focus({ preventScroll: true });
      el.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  /* ---------- Підказки ---------- */
  const visibleWrong = (q) =>
    q.answers.map((_, i) => i).filter((i) => i !== q.correctIndex && !state.hidden.has(i));

  function useLifeline(kind) {
    if (!state || state.locked || state.used[kind]) return;
    state.used[kind] = true;
    sfx.lifeline();
    const q = questions[state.idx];
    if (kind === 'fifty') fiftyFifty(q);
    else if (kind === 'phone') phoneFriend(q);
    else askAudience(q);
    updateLifelines();
  }

  function fiftyFifty(q) {
    const wrong = shuffle(visibleWrong(q));
    const remove = wrong.slice(0, Math.min(2, Math.max(0, wrong.length - 1)));
    const btns = answerBtns();
    remove.forEach((i) => {
      state.hidden.add(i);
      btns[i].classList.add('gone');
      btns[i].classList.remove('selected');
      btns[i].disabled = true;
      btns[i].setAttribute('aria-hidden', 'true');
    });
    if (state.hidden.has(state.selected)) {
      state.selected = null;
      el.confirm.hidden = true;
    }
  }

  function phoneFriend(q) {
    let text = q.phone;
    if (!text) {
      const confidence = Math.max(0.45, 0.95 - state.idx * 0.035);
      const guess = Math.random() < confidence ? q.correctIndex : pick(visibleWrong(q)) ?? q.correctIndex;
      const pct = Math.round(45 + confidence * 50 * Math.random() + 5);
      text = `Хм… Мені здається, це ${LETTERS[guess]}: «${q.answers[guess].text}». Відсотків на ${pct}. Але вирішувати тобі!`;
    }
    const p = document.createElement('p');
    p.className = 'phone-text';
    p.textContent = text;
    openPanel(`Дзвінок: ${cfg.friendName || 'друг'} на зв’язку`, p);
  }

  function askAudience(q) {
    const idxs = q.answers.map((_, i) => i).filter((i) => !state.hidden.has(i));
    const custom = Array.isArray(q.audience) && q.audience.length >= q.answers.length;
    const w = {};

    if (custom) {
      idxs.forEach((i) => (w[i] = Math.max(0, Number(q.audience[q.answers[i].orig]) || 0)));
    } else {
      idxs.forEach((i) => (w[i] = i === q.correctIndex ? 0 : 0.2 + Math.random()));
      const others = idxs.filter((i) => i !== q.correctIndex).reduce((s, i) => s + w[i], 0);
      const share = Math.min(0.88, Math.max(0.3, 0.74 - state.idx * 0.025 + (Math.random() - 0.5) * 0.16));
      w[q.correctIndex] = others === 0 ? 1 : (others * share) / (1 - share);
    }

    const sum = Object.values(w).reduce((s, v) => s + v, 0) || 1;
    const pct = {};
    idxs.forEach((i) => (pct[i] = Math.round((w[i] / sum) * 100)));
    const diff = 100 - Object.values(pct).reduce((s, v) => s + v, 0);
    const top = idxs.reduce((a, b) => (pct[a] >= pct[b] ? a : b));
    pct[top] += diff;

    const wrap = document.createElement('div');
    wrap.className = 'bars';
    const fills = [];
    q.answers.forEach((_, i) => {
      const v = pct[i] ?? 0;
      const bar = document.createElement('div');
      bar.className = 'bar' + (state.hidden.has(i) ? ' is-off' : '');
      bar.innerHTML = '<span class="bar-val"></span><div class="bar-track"><div class="bar-fill"></div></div><span class="bar-label"></span>';
      bar.querySelector('.bar-val').textContent = v + '%';
      bar.querySelector('.bar-label').textContent = LETTERS[i];
      fills.push([bar.querySelector('.bar-fill'), v]);
      wrap.appendChild(bar);
    });
    openPanel('Голосування залу', wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => fills.forEach(([f, v]) => (f.style.height = v + '%'))));
  }

  function openPanel(title, node) {
    el.panelTitle.textContent = title;
    el.panelBody.innerHTML = '';
    el.panelBody.appendChild(node);
    el.panel.hidden = false;
  }
  function closePanel() { el.panel.hidden = true; }

  /* ---------- Шкала призів на мобільних ---------- */
  function toggleLadder(force) {
    const open = force ?? !el.ladder.classList.contains('open');
    el.ladder.classList.toggle('open', open);
    el.ladderBtn.setAttribute('aria-expanded', String(open));
  }
  const closeLadder = () => toggleLadder(false);

  /* ---------- Модальне вікно ---------- */
  let modalDone = null;
  function ask(title, text, okText, cancelText) {
    return new Promise((resolve) => {
      el.modalTitle.textContent = title;
      el.modalText.textContent = text;
      el.modalOk.textContent = okText;
      el.modalCancel.textContent = cancelText;
      el.modal.hidden = false;
      el.modalCancel.focus();
      modalDone = (v) => {
        el.modal.hidden = true;
        modalDone = null;
        resolve(v);
      };
    });
  }
  el.modalOk.addEventListener('click', () => modalDone?.(true));
  el.modalCancel.addEventListener('click', () => modalDone?.(false));
  el.modal.addEventListener('click', (e) => { if (e.target === el.modal) modalDone?.(false); });

  /* ---------- Фінал ---------- */
  function finish(type) {
    let prize, sub, title, message;
    const answered = type === 'win' ? total : state.idx;

    if (type === 'win') {
      prize = prizes[total - 1];
      title = cfg.winTitle || 'Перемога!';
      message = cfg.winMessage;
      sfx.win();
      confetti(6500);
    } else if (type === 'walk') {
      prize = state.idx > 0 ? prizes[state.idx - 1] : 0;
      title = cfg.walkTitle || 'Мудре рішення';
      message = cfg.walkMessage;
      if (state.idx > 0) confetti(2000);
    } else {
      const reached = safeHavens.filter((h) => h <= state.idx);
      prize = reached.length ? prizes[Math.max(...reached) - 1] : 0;
      title = cfg.loseTitle || 'Гру завершено';
      message = cfg.loseMessage;
    }

    sub = `Правильних відповідей: ${answered} з ${total}`;
    $('#end-sub').textContent = sub;
    $('#end-title').textContent = title;
    // Показуємо відповідне фото залежно від результату
    if (type === 'win') {
      el.endImage.src = 'img/win.webp';
      el.endImage.hidden = false;
    } else if (type === 'lose') {
      el.endImage.src = 'img/lose.webp';
      el.endImage.hidden = false;
    } else {
      el.endImage.hidden = true;
    }
    $('#end-prize').textContent = prizeText(prize);
    $('#end-message').textContent = message || '';
    closeLadder();
    show('screen-end');
    setTimeout(() => $('#btn-restart').focus({ preventScroll: true }), 100);
  }

  /* ---------- Конфеті ---------- */
  let confettiRaf = 0;
  function confetti(duration = 5000) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = el.canvas;
    const ctx = c.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = ['#f2b544', '#ffe3a3', '#8b6cff', '#37d27f', '#ff6fa3', '#63d0ff'];
    const parts = Array.from({ length: 170 }, () => ({
      x: Math.random() * W,
      y: -20 - Math.random() * H * 0.6,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 10,
      vx: (Math.random() - 0.5) * 2.2,
      vy: 2 + Math.random() * 3,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.24,
      color: colors[(Math.random() * colors.length) | 0],
    }));
    const end = performance.now() + duration;

    cancelAnimationFrame(confettiRaf);
    const tick = (t) => {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of parts) {
        p.x += p.vx + Math.sin(p.y / 40) * 0.6;
        p.y += p.vy;
        p.r += p.vr;
        if (p.y > H + 20) {
          if (t < end) { p.y = -20; p.x = Math.random() * W; p.vy = 2 + Math.random() * 3; }
          else continue;
        }
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.cos(p.r * 2));
        ctx.restore();
      }
      if (alive) confettiRaf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    confettiRaf = requestAnimationFrame(tick);
  }

  /* ---------- Події ---------- */
  $('#btn-start').addEventListener('click', startGame);
  $('#btn-restart').addEventListener('click', () => show('screen-start'));
  el.confirm.addEventListener('click', lockIn);
  el.next.addEventListener('click', () => { const fn = onNext; onNext = null; fn?.(); });
  lifelineBtns.forEach((b) => b.addEventListener('click', () => useLifeline(b.dataset.lifeline)));
  $('#panel-close').addEventListener('click', closePanel);
  el.ladderBtn.addEventListener('click', () => toggleLadder());
  $('#btn-ladder-close').addEventListener('click', closeLadder);
  el.sound.addEventListener('click', () => {
    soundOn = !soundOn;
    try { localStorage.setItem('quiz-sound', soundOn ? 'on' : 'off'); } catch (e) { /* ок */ }
    renderSound();
    sfx.select();
  });

  el.walk.addEventListener('click', async () => {
    if (!state || state.locked || state.idx === 0) return;
    const amount = fmt(prizes[state.idx - 1]);
    const yes = await ask(
      `Забрати ${amount}?`,
      'Гра завершиться, і цей виграш залишиться за тобою.',
      'Забрати',
      'Грати далі'
    );
    if (yes) finish('walk');
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!el.modal.hidden) {
      if (e.key === 'Escape') modalDone?.(false);
      return;
    }
    const onButton = e.target instanceof Element && e.target.closest('button');
    const active = document.querySelector('.screen.is-active')?.id;

    if (e.key === 'Escape') { closePanel(); closeLadder(); return; }
    if (active !== 'screen-game' || !state) {
      if (e.key === 'Enter' && !onButton) {
        e.preventDefault();
        if (active === 'screen-start') startGame();
        else if (active === 'screen-end') show('screen-start');
      }
      return;
    }

    const k = e.key.toLowerCase();
    if (KEYMAP.has(k) && el.result.hidden) {
      select(KEYMAP.get(k));
    } else if (e.key === 'Enter' && !onButton) {
      e.preventDefault();
      if (!el.result.hidden) el.next.click();
      else if (!el.confirm.hidden) lockIn();
    }
  });

  /* ---------- Старт ---------- */
  document.title = cfg.title || document.title;
  $('#start-title').textContent = cfg.title || 'Гра на мільйон';
  $('#start-subtitle').textContent = cfg.subtitle || '';
  $('#start-subtitle').hidden = !cfg.subtitle;
  $('#start-lead').textContent = cfg.intro || '';
  const havensText = safeHavens.length
    ? ` Незгоряні суми — після запитань ${joinList(safeHavens)}.`
    : '';
  $('#start-rules').textContent =
    `${total} ${pluralQuestions(total)}, головний приз — ${fmt(prizes[total - 1])}.${havensText} Виграш можна забрати будь-коли.`;
  renderSound();
})();
