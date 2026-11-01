import { auth, db } from './firebase.js';

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  where,
  setDoc,
  getDoc,
  arrayUnion,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

/* ================= Икони ================= */

const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  all: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 7H6"/>',
  heart: '<path d="M12 20s-7.5-4.5-9.3-9.2A5 5 0 0 1 12 6.6a5 5 0 0 1 9.3 4.2C19.5 15.5 12 20 12 20z"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chev: '<path d="M9 18l6-6-6-6"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

/* ================= Категории и списъци ================= */

// id-тата са същите като досега, за да работят и старите задачи
const CATEGORIES = [
  { id: 'Хранителни стоки', label: 'Хранителни стоки', short: 'Храна',  color: '#E0901A', icon: 'cart' },
  { id: 'Здраве',           label: 'Здраве',           short: 'Здраве', color: '#E04E66', icon: 'heart' },
  { id: 'Дом',              label: 'Дом',              short: 'Дом',    color: '#2F80D8', icon: 'home' },
  { id: 'Ремонт',           label: 'Ремонт',           short: 'Ремонт', color: '#7457E8', icon: 'wrench' },
  { id: 'Работа',           label: 'Работа',           short: 'Работа', color: '#14967F', icon: 'work' },
  { id: 'Друго',            label: 'Друго',            short: 'Друго',  color: '#7C8396', icon: 'tag' },
];
const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

// „Умни“ списъци — като в Microsoft To Do
const SMART = [
  { key: 'today',     title: 'Днес',            icon: 'sun',      color: '#E07A1F', match: (t) => t.due && t.due <= today(), empty: ['Свободен ден', 'Задачите със срок днес ще се появят тук.'] },
  { key: 'important', title: 'Важни',           icon: 'star',     color: '#D6455D', match: (t) => t.important, empty: ['Няма важни задачи', 'Натисни звездата на задача, за да я отбележиш.'] },
  { key: 'planned',   title: 'Планирани',       icon: 'calendar', color: '#2D6BE4', match: (t) => Boolean(t.due), empty: ['Нищо не е планирано', 'Задачите със срок ще се подредят тук по дати.'] },
  { key: 'mine',      title: 'Възложени на мен', icon: 'user',    color: '#14967F', match: (t) => t.assignee === state.user?.uid, empty: ['Никой не ти е възложил задача', 'Когато някой те избере за задача, тя ще е тук.'] },
  { key: 'all',       title: 'Всички задачи',   icon: 'all',      color: '#5B6275', match: () => true, empty: ['Списъкът е празен', 'Добави първата задача в полето отдолу.'] },
];

function listByKey(key) {
  const smart = SMART.find((s) => s.key === key);
  if (smart) return { ...smart, smart: true };
  const cat = CATEGORIES[Number(String(key).replace('c', ''))];
  if (!cat) return null;
  return {
    key, title: cat.label, icon: cat.icon, color: cat.color, cat: cat.id,
    match: (t) => t.category === cat.id,
    empty: ['Няма задачи тук', 'Добави първата в полето отдолу.'],
  };
}

/* ================= Състояние ================= */

const $ = (id) => document.getElementById(id);

const store = {
  get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* частен режим */ } },
};

const state = {
  user: null,
  familyId: null,
  familyName: '',
  familyMembers: [],
  todos: [],
  list: null,                 // отвореният списък или null за началния екран
  newCat: store.get('newCat', CATEGORIES[0].id),
  newAssignee: null,          // на кого е новата задача (null = на всеки)
  unsubscribe: null,
  firstSnapshot: true,
  freshIds: new Set(),
  notify: store.get('notify', '0') === '1' && 'Notification' in window && Notification.permission === 'granted',
};

/* ================= Дати ================= */

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDay(new Date());
const addDays = (n, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() + n); return isoDay(d); };
const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

const weekdayFmt = new Intl.DateTimeFormat('bg-BG', { weekday: 'short', day: 'numeric', month: 'short' });
const dayFmt = new Intl.DateTimeFormat('bg-BG', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('bg-BG', { hour: '2-digit', minute: '2-digit' });

function dueLabel(due) {
  if (due === today()) return 'Днес';
  if (due === addDays(1)) return 'Утре';
  if (due === addDays(-1)) return 'Вчера';
  return (due < today() ? dayFmt : weekdayFmt).format(parseDay(due));
}

function relTime(ms) {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'току-що';
  if (diff < 3_600_000) return `преди ${Math.floor(diff / 60_000)} мин`;
  const d = new Date(ms);
  if (isoDay(d) === today()) return `днес в ${timeFmt.format(d)}`;
  if (isoDay(d) === addDays(-1)) return `вчера в ${timeFmt.format(d)}`;
  return dayFmt.format(d);
}

/* ================= Хора ================= */

function nameOf(email, { me = 'Ти' } = {}) {
  if (!email) return 'Някой';
  if (state.user && email === state.user.email) return me;
  return email.split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function colorOf(text = '') {
  const palette = ['#E0901A', '#E04E66', '#2F80D8', '#7457E8', '#14967F', '#C2589B'];
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

function avatarEl(email, cls = '') {
  const el = document.createElement('span');
  el.className = `avatar ${cls}`.trim();
  el.style.setProperty('--av', colorOf(email));
  el.textContent = (email || '?').charAt(0).toUpperCase();
  return el;
}

// всички членове: записаните в групата + всеки, който е добавял задачи
function members() {
  const map = new Map();
  for (const m of state.familyMembers) if (m?.uid) map.set(m.uid, m.email);
  for (const t of state.todos) if (t.createdBy && t.createdByEmail) map.set(t.createdBy, t.createdByEmail);
  if (state.user) map.set(state.user.uid, state.user.email);
  return [...map].map(([uid, email]) => ({ uid, email }))
    .sort((a, b) => (a.uid === state.user?.uid ? -1 : b.uid === state.user?.uid ? 1 : a.email.localeCompare(b.email)));
}
const emailOfUid = (uid) => members().find((m) => m.uid === uid)?.email;

function buzz(ms = 12) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

/* ================= Съобщения в приложението ================= */

function toast({ text, sub = '', email = null, action = null, duration = 3500 }) {
  const el = document.createElement('div');
  el.className = 'toast';
  if (email) el.append(avatarEl(email));

  const body = document.createElement('div');
  body.className = 'toast-text';
  const b = document.createElement('b');
  b.textContent = text;
  body.append(b);
  if (sub) {
    const s = document.createElement('span');
    s.textContent = sub;
    body.append(s);
  }
  el.append(body);

  const close = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 200);
  };

  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action.label;
    btn.onclick = () => { action.run(); close(); };
    el.append(btn);
  }

  $('toasts').append(el);
  setTimeout(close, duration);
}

/* ================= Системни известия ================= */

function updateBell() {
  $('bellBtn').classList.toggle('on', state.notify);
  $('bellBtn').setAttribute('aria-pressed', String(state.notify));
  $('notifToggle').checked = state.notify;
}

async function setNotify(on) {
  if (!on) {
    state.notify = false;
    store.set('notify', '0');
    updateBell();
    return;
  }
  if (!('Notification' in window)) {
    toast({ text: 'Браузърът не поддържа известия', sub: 'На iPhone първо добави приложението на началния екран.', duration: 5000 });
    updateBell();
    return;
  }
  const permission = await Notification.requestPermission();
  state.notify = permission === 'granted';
  store.set('notify', state.notify ? '1' : '0');
  updateBell();
  if (state.notify) toast({ text: 'Известията са включени', sub: 'Ще разбереш, когато някой добави или промени задача.' });
  else toast({ text: 'Известията са спрени от браузъра', sub: 'Разреши ги от настройките на сайта.', duration: 5000 });
}

async function systemNotify(title, body, tag) {
  if (!state.notify || document.visibilityState === 'visible') return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    else new Notification(title, { body, tag, icon: 'icons/icon-192.png' });
  } catch (err) {
    console.warn('Известието не беше показано', err);
  }
}

// съобщава за промените, направени от другите в семейството
function announceChanges(snapshot) {
  const me = state.user?.uid;

  for (const change of snapshot.docChanges()) {
    if (change.doc.metadata.hasPendingWrites) continue; // наша собствена промяна
    const t = { id: change.doc.id, ...change.doc.data() };
    const cat = catOf(t.category).short;

    if (change.type === 'added' && t.createdBy !== me) {
      state.freshIds.add(t.id);
      const who = nameOf(t.createdByEmail);
      const forMe = t.assignee === me ? ' за теб' : '';
      toast({ text: `${who} добави${forMe} в ${cat}`, sub: t.text, email: t.createdByEmail });
      systemNotify(`${who} добави задача${forMe}`, `${cat}: ${t.text}`, `todo-${t.id}`);
      buzz([10, 60, 10]);
      continue;
    }

    if (change.type !== 'modified' || !t.updatedBy || t.updatedBy === me) continue;
    const who = nameOf(t.updatedByEmail);

    if (t.lastAction === 'assign' && t.assignee === me) {
      state.freshIds.add(t.id);
      toast({ text: `${who} ти възложи задача`, sub: t.text, email: t.updatedByEmail });
      systemNotify(`${who} ти възложи задача`, t.text, `todo-${t.id}`);
      buzz([10, 60, 10]);
    } else if (t.lastAction === 'edit') {
      state.freshIds.add(t.id);
      toast({ text: `${who} промени задача`, sub: t.text, email: t.updatedByEmail });
      systemNotify(`${who} промени задача`, `${cat}: ${t.text}`, `todo-${t.id}`);
    } else if (t.lastAction === 'done') {
      toast({ text: `${who} отметна`, sub: t.text, email: t.updatedByEmail });
      systemNotify(`${who} отметна задача`, t.text, `todo-${t.id}`);
    }
  }
}

/* ================= Вход и регистрация ================= */

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Грешен имейл или парола.',
  'auth/wrong-password': 'Грешен имейл или парола.',
  'auth/user-not-found': 'Няма профил с този имейл. Натисни „Нов профил“.',
  'auth/email-already-in-use': 'Вече има профил с този имейл. Влез с него.',
  'auth/weak-password': 'Паролата трябва да е поне 6 знака.',
  'auth/invalid-email': 'Имейлът не е валиден.',
  'auth/too-many-requests': 'Твърде много опити. Изчакай малко и опитай пак.',
  'auth/network-request-failed': 'Няма връзка с интернет.',
};
const authError = (err) => AUTH_ERRORS[err?.code] || 'Нещо се обърка. Опитай пак.';

$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('authError').textContent = '';
  try {
    await signInWithEmailAndPassword(auth, $('email').value.trim(), $('password').value);
  } catch (err) {
    $('authError').textContent = authError(err);
  }
});

$('registerBtn').addEventListener('click', async () => {
  $('authError').textContent = '';
  if (!$('authForm').reportValidity()) return;
  try {
    const cred = await createUserWithEmailAndPassword(auth, $('email').value.trim(), $('password').value);
    await setDoc(doc(db, 'users', cred.user.uid), { email: cred.user.email, created: Date.now() }, { merge: true });
  } catch (err) {
    $('authError').textContent = authError(err);
  }
});

$('logoutBtn').addEventListener('click', async () => {
  $('menuDialog').close();
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  state.user = user;

  if (!user) {
    stopListening();
    $('auth-section').hidden = false;
    $('todo-section').hidden = true;
    return;
  }

  $('auth-section').hidden = true;
  $('todo-section').hidden = false;
  $('user-info').textContent = user.email;
  $('homeEmail').textContent = user.email;
  for (const id of ['menuAvatar', 'menuAvatarLg']) {
    const el = $(id);
    el.textContent = user.email.charAt(0).toUpperCase();
    el.style.setProperty('--av', colorOf(user.email));
  }

  const snap = await getDoc(doc(db, 'users', user.uid));
  await enterFamily(snap.exists() ? snap.data().familyId || null : null);
});

/* ================= Семейство ================= */

async function enterFamily(familyId) {
  state.familyId = familyId;
  state.familyName = '';
  state.familyMembers = [];

  if (familyId) {
    const fam = await getDoc(doc(db, 'families', familyId));
    if (fam.exists()) {
      state.familyName = fam.data().name || '';
      state.familyMembers = fam.data().members || [];
      // записваме се в списъка с членове (за избора „Кой да я свърши“)
      if (!state.familyMembers.some((m) => m.uid === state.user.uid)) {
        const me = { uid: state.user.uid, email: state.user.email };
        updateDoc(doc(db, 'families', familyId), { members: arrayUnion(me) }).catch(() => {});
        state.familyMembers.push(me);
      }
    } else {
      state.familyId = null;
    }
  }

  const joined = Boolean(state.familyId);
  $('familyNotJoined').hidden = joined;
  $('homeLists').hidden = !joined;
  $('leaveFamilyBtn').hidden = !joined;
  $('codeBox').hidden = !joined;
  $('membersBox').hidden = !joined;
  $('familyName').textContent = joined ? `Семейство ${state.familyName}`.trim() : 'Добре дошъл';
  $('menuFamily').textContent = joined ? `Семейство ${state.familyName}` : 'Не си в група';
  $('familyCode').textContent = state.familyId || '';

  if (joined) startListening();
  else { stopListening(); location.hash = ''; }
  route();
}

async function newFamilyCode() {
  for (let i = 0; i < 5; i++) {
    const code = 'FAM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const exists = await getDoc(doc(db, 'families', code));
    if (!exists.exists()) return code;
  }
  throw new Error('Не успяхме да създадем код');
}

$('createFamilyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('familyNameInput').value.trim();
  if (!name) return;
  try {
    const familyId = await newFamilyCode();
    await setDoc(doc(db, 'families', familyId), {
      name,
      createdBy: state.user.uid,
      created: Date.now(),
      members: [{ uid: state.user.uid, email: state.user.email }],
    });
    await setDoc(doc(db, 'users', state.user.uid), { familyId }, { merge: true });
    await enterFamily(familyId);
    toast({ text: 'Групата е създадена', sub: `Сподели кода ${familyId} със семейството.`, duration: 6000 });
  } catch (err) {
    console.error(err);
    toast({ text: 'Групата не беше създадена', sub: 'Провери връзката и опитай пак.' });
  }
});

$('joinFamilyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = $('joinFamilyInput').value.trim().toUpperCase();
  if (!code) return;
  const fam = await getDoc(doc(db, 'families', code));
  if (!fam.exists()) {
    toast({ text: 'Няма група с този код', sub: 'Провери дали е изписан точно.' });
    return;
  }
  await setDoc(doc(db, 'users', state.user.uid), { familyId: code }, { merge: true });
  await enterFamily(code);
  toast({ text: `Присъедини се към ${fam.data().name}` });
});

$('leaveFamilyBtn').addEventListener('click', async () => {
  if (!confirm('Да напуснеш групата? Задачите остават за останалите.')) return;
  $('menuDialog').close();
  await setDoc(doc(db, 'users', state.user.uid), { familyId: null }, { merge: true });
  await enterFamily(null);
});

$('copyCodeBtn').addEventListener('click', async () => {
  const code = state.familyId;
  try {
    await navigator.clipboard.writeText(code);
    toast({ text: 'Кодът е копиран', sub: code });
  } catch {
    prompt('Копирай кода:', code);
  }
});

/* ================= Слушане за задачи ================= */

function stopListening() {
  if (state.unsubscribe) state.unsubscribe();
  state.unsubscribe = null;
  state.todos = [];
}

// един слушател за цялото семейство — списъците се правят в браузъра
function startListening() {
  stopListening();
  state.firstSnapshot = true;

  const q = query(
    collection(db, 'todos'),
    where('familyId', '==', state.familyId),
    orderBy('created', 'desc'),
  );

  state.unsubscribe = onSnapshot(q, (snapshot) => {
    if (!state.firstSnapshot) announceChanges(snapshot);
    state.firstSnapshot = false;
    state.todos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  }, (err) => {
    console.error(err);
    toast({ text: 'Задачите не се заредиха', sub: 'Провери връзката или правилата във Firebase.', duration: 6000 });
  });
}

/* ================= Навигация ================= */

// #/list/today, #/list/c0 … — бутонът „Назад“ на телефона работи естествено
function route() {
  const m = location.hash.match(/^#\/list\/(\w+)/);
  state.list = m && state.familyId ? listByKey(m[1]) : null;

  $('homeView').hidden = Boolean(state.list);
  $('listView').hidden = !state.list;
  state.newAssignee = state.list?.key === 'mine' ? state.user?.uid ?? null : null;
  if (state.list) {
    document.documentElement.style.setProperty('--accent', state.list.color);
    if (state.list.cat) setNewCat(state.list.cat, { silent: true });
    $('composer').classList.toggle('pick-cat', !state.list.cat);
  } else {
    document.documentElement.style.removeProperty('--accent');
  }
  render();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

$('backBtn').addEventListener('click', () => {
  if (history.state?.fromHome) history.back();
  else location.hash = '';
});

function openList(key) {
  history.pushState({ fromHome: true }, '', `#/list/${key}`);
  route();
}

/* ================= Рисуване ================= */

function render() {
  if (!state.familyId) return;
  if (state.list) renderList();
  else renderHome();
}

function listRow({ key, title, icon, color }, count, alert = false) {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'list-row';
  btn.style.setProperty('--c', color);
  btn.innerHTML = `<span class="list-icon">${svg(icon)}</span>`;

  const name = document.createElement('span');
  name.className = 'list-name';
  name.textContent = title;

  const num = document.createElement('span');
  num.className = alert ? 'list-count alert' : 'list-count';
  num.textContent = count || '';

  const chev = document.createElement('span');
  chev.innerHTML = svg('chev');
  chev.firstChild.classList.add('list-chev');

  btn.append(name, num, chev.firstChild);
  btn.onclick = () => openList(key);
  li.append(btn);
  return li;
}

function renderHome() {
  const open = state.todos.filter((t) => !t.done);
  const overdue = open.some((t) => t.due && t.due < today());

  $('smartLists').replaceChildren(...SMART.map((s) =>
    listRow(s, open.filter(s.match).length, s.key === 'today' && overdue)));

  $('catLists').replaceChildren(...CATEGORIES.map((c, i) =>
    listRow({ key: `c${i}`, title: c.label, icon: c.icon, color: c.color }, open.filter((t) => t.category === c.id).length)));
}

function renderList() {
  const list = state.list;
  $('listTitle').textContent = list.title;

  const items = state.todos.filter(list.match);
  let open = items.filter((t) => !t.done);
  const done = items.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  // важните най-горе; в „Планирани“ и „Днес“ — по дата
  if (list.key === 'planned' || list.key === 'today') open.sort((a, b) => a.due.localeCompare(b.due) || b.created - a.created);
  else open.sort((a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0) || b.created - a.created);

  $('listSub').textContent = list.key === 'today'
    ? new Intl.DateTimeFormat('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
    : open.length ? `${open.length} ${open.length === 1 ? 'задача' : 'задачи'}` : '';

  const area = $('taskArea');
  area.replaceChildren();

  if (!open.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = `<div class="empty-icon">${svg(list.icon)}</div>`;
    const strong = document.createElement('strong');
    const p = document.createElement('span');
    [strong.textContent, p.textContent] = done.length && !['important', 'mine', 'planned', 'today'].includes(list.key)
      ? ['Всичко е свършено', 'Браво! Няма чакащи задачи тук.']
      : list.empty;
    empty.append(strong, p);
    area.append(empty);
  } else if (list.key === 'planned') {
    const groups = [
      ['Просрочени', (t) => t.due < today(), true],
      ['Днес', (t) => t.due === today()],
      ['Утре', (t) => t.due === addDays(1)],
      ['Тази седмица', (t) => t.due > addDays(1) && t.due <= addDays(7)],
      ['По-късно', (t) => t.due > addDays(7)],
    ];
    for (const [title, fn, alert] of groups) {
      const part = open.filter(fn);
      if (!part.length) continue;
      const h = document.createElement('h2');
      h.className = alert ? 'section-title alert' : 'section-title';
      h.textContent = title;
      area.append(h, taskList(part));
    }
  } else {
    area.append(taskList(open));
  }

  $('doneWrap').hidden = !done.length;
  $('doneTitle').textContent = `Завършени ${done.length}`;
  $('doneList').replaceChildren(...done.map(taskEl));

  renderComposerWho();
  state.freshIds.clear(); // подсветката на новите задачи е еднократна
}

function taskList(items) {
  const ul = document.createElement('ul');
  ul.className = 'task-list';
  ul.append(...items.map(taskEl));
  return ul;
}

function taskEl(t) {
  const cat = catOf(t.category);
  const inSmart = state.list?.smart;

  const li = document.createElement('li');
  li.className = 'task';
  li.classList.toggle('done', Boolean(t.done));
  li.classList.toggle('is-new', state.freshIds.has(t.id));
  li.style.setProperty('--cat', cat.color);

  // кръгче с чавка
  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'check';
  check.style.setProperty('--cat', inSmart ? cat.color : 'var(--accent)');
  check.innerHTML = svg('check');
  check.setAttribute('aria-label', t.done ? 'Върни като незавършена' : 'Отметни като готова');
  check.onclick = () => {
    if (li.dataset.busy) return;
    li.dataset.busy = '1';
    li.classList.toggle('done', !t.done);
    li.classList.add('ticking');
    buzz();
    setTimeout(() => toggleDone(t), t.done ? 150 : 600);
  };

  // текст + подробности → отваря детайлите
  const body = document.createElement('button');
  body.type = 'button';
  body.className = 'task-body';

  const text = document.createElement('p');
  text.className = 'task-text';
  text.textContent = t.text; // textContent — никакъв HTML от потребителите

  const meta = document.createElement('div');
  meta.className = 'task-meta';

  if (inSmart) {
    const c = document.createElement('span');
    c.className = 'meta meta-cat';
    c.textContent = cat.short;
    meta.append(c);
  }
  if (t.due) {
    const d = document.createElement('span');
    d.className = 'meta meta-due';
    if (!t.done && t.due < today()) d.classList.add('late');
    else if (t.due === today()) d.classList.add('today');
    d.innerHTML = svg('calendar');
    d.append(dueLabel(t.due));
    meta.append(d);
  }
  if (t.assignee) {
    const email = emailOfUid(t.assignee);
    const a = document.createElement('span');
    a.className = 'meta';
    a.append(avatarEl(email, 'avatar-sm'), nameOf(email));
    meta.append(a);
  }
  if (t.done && t.doneByEmail && t.doneByEmail !== state.user.email) {
    const w = document.createElement('span');
    w.className = 'meta';
    w.textContent = `отметна ${nameOf(t.doneByEmail)}`;
    meta.append(w);
  }

  body.append(text, meta);
  body.onclick = () => openDetail(t);

  // звезда
  const star = document.createElement('button');
  star.type = 'button';
  star.className = t.important ? 'star on' : 'star';
  star.innerHTML = svg('star');
  star.setAttribute('aria-label', t.important ? 'Махни от важни' : 'Отбележи като важна');
  star.setAttribute('aria-pressed', String(Boolean(t.important)));
  star.onclick = () => saveTodo(t, { important: !t.important }, 'star');

  li.append(check, body, star);
  return li;
}

/* ================= Действия със задачи ================= */

function changeMeta(action) {
  return {
    updatedBy: state.user.uid,
    updatedByEmail: state.user.email,
    updatedAt: Date.now(),
    lastAction: action,
  };
}

async function saveTodo(t, changes, action) {
  Object.assign(t, changes); // веднага на екрана, без да чакаме сървъра
  render();
  try {
    await updateDoc(doc(db, 'todos', t.id), { ...changes, ...changeMeta(action) });
  } catch (err) {
    console.error(err);
    toast({ text: 'Промяната не беше запазена', sub: 'Провери връзката.' });
  }
}

function toggleDone(t) {
  const done = !t.done;
  return saveTodo(t, {
    done,
    doneByEmail: done ? state.user.email : null,
    doneAt: done ? Date.now() : null,
  }, done ? 'done' : 'undone');
}

async function removeTodo(t) {
  const { id, ...data } = t;
  await deleteDoc(doc(db, 'todos', id));
  toast({
    text: 'Задачата е изтрита',
    sub: t.text,
    duration: 6000,
    action: { label: 'Върни', run: () => setDoc(doc(db, 'todos', id), data) },
  });
}

$('clearDoneBtn').addEventListener('click', async (e) => {
  e.preventDefault(); // да не сгъва секцията
  const done = state.todos.filter((t) => t.done && state.list?.match(t));
  if (!done.length || !confirm(`Да изтрия ли ${done.length} завършени задачи?`)) return;
  const backup = done.map(({ id, ...data }) => ({ id, data }));
  await Promise.all(done.map((t) => deleteDoc(doc(db, 'todos', t.id))));
  toast({
    text: `Изтрити ${done.length} задачи`,
    duration: 6000,
    action: { label: 'Върни', run: () => backup.forEach(({ id, data }) => setDoc(doc(db, 'todos', id), data)) },
  });
});

/* ================= Чипове ================= */

function chip({ label, color, checked, dot = true, html = '' }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', String(checked));
  if (color) b.style.setProperty('--c', color);
  if (html) b.insertAdjacentHTML('beforeend', html);
  else if (dot && color) b.insertAdjacentHTML('beforeend', '<span class="dot"></span>');
  b.append(label);
  b.addEventListener('mousedown', (e) => e.preventDefault()); // полето да не губи фокус
  return b;
}

function renderCatPicker(container, selectedId, onPick, useShort = true) {
  container.replaceChildren(...CATEGORIES.map((c) => {
    const b = chip({ label: useShort ? c.short : c.label, color: c.color, checked: c.id === selectedId });
    b.onclick = () => onPick(c.id);
    return b;
  }));
}

/* ================= Нова задача ================= */

function setNewCat(id, { silent = false } = {}) {
  state.newCat = id;
  if (!silent) store.set('newCat', id);
  renderCatPicker($('composerCats'), state.newCat, (cid) => setNewCat(cid));
}
setNewCat(catOf(state.newCat).id, { silent: true });

// „За кого“ при добавяне: Всеки, Аз и останалите членове
function renderComposerWho() {
  const box = $('composerWho');
  if (!state.user) return;
  const label = document.createElement('span');
  label.className = 'who-label';
  label.textContent = 'За:';

  const everyone = chip({ label: 'Всеки', color: 'var(--accent)', checked: !state.newAssignee, dot: false });
  everyone.onclick = () => setNewAssignee(null);

  const people = members().map((m) => {
    const b = chip({ label: nameOf(m.email, { me: 'Аз' }), color: colorOf(m.email), checked: state.newAssignee === m.uid, dot: false });
    b.prepend(avatarEl(m.email, 'avatar-sm'));
    b.onclick = () => setNewAssignee(m.uid);
    return b;
  });
  box.replaceChildren(label, everyone, ...people);
}

function setNewAssignee(uid) {
  state.newAssignee = uid;
  renderComposerWho();
}

const input = $('newTodo');
const composer = $('composer');

function autosize(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}
function syncAddBtn() {
  $('addTodoBtn').disabled = !input.value.trim();
}

input.addEventListener('input', () => { autosize(input); syncAddBtn(); });
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    composer.requestSubmit();
  }
});
composer.addEventListener('focusin', () => composer.classList.add('open'));
composer.addEventListener('focusout', (e) => {
  if (composer.contains(e.relatedTarget) || input.value.trim()) return;
  composer.classList.remove('open');
});
syncAddBtn();

composer.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !state.familyId) return;

  // задачата получава свойствата на списъка, в който е добавена
  const list = state.list;
  const todo = {
    text,
    category: list?.cat || state.newCat,
    familyId: state.familyId,
    createdBy: state.user.uid,
    createdByEmail: state.user.email,
    created: Date.now(),
    done: false,
  };
  if (list?.key === 'today' || list?.key === 'planned') todo.due = today();
  if (list?.key === 'important') todo.important = true;
  const assignee = state.newAssignee || (list?.key === 'mine' ? state.user.uid : null);
  if (assignee) todo.assignee = assignee;

  input.value = '';
  autosize(input);
  syncAddBtn();
  buzz();
  if (assignee && assignee !== state.user.uid) {
    toast({ text: `Възложено на ${nameOf(emailOfUid(assignee))}`, sub: text, email: emailOfUid(assignee) });
  }

  try {
    await addDoc(collection(db, 'todos'), todo);
  } catch (err) {
    console.error(err);
    input.value = text;
    syncAddBtn();
    toast({ text: 'Задачата не беше добавена', sub: 'Провери връзката и опитай пак.' });
  }
});

/* ================= Детайли на задача ================= */

const detail = $('detailDialog');
let draft = null;   // временни промени, докато листът е отворен
let editing = null;

function openDetail(t) {
  editing = t;
  draft = {
    text: t.text,
    category: catOf(t.category).id,
    due: t.due || null,
    assignee: t.assignee || null,
    important: Boolean(t.important),
    done: Boolean(t.done),
  };
  $('detailText').value = t.text;
  renderDetail();
  detail.returnValue = '';
  detail.showModal();
  autosize($('detailText'));
}

function renderDetail() {
  const cat = catOf(draft.category);
  detail.style.setProperty('--accent', cat.color);

  const check = $('detailCheck');
  check.innerHTML = svg('check');
  check.classList.toggle('on', draft.done);
  check.style.setProperty('--cat', cat.color);
  check.setAttribute('aria-label', draft.done ? 'Върни като незавършена' : 'Отметни като готова');

  const star = $('detailStar');
  star.innerHTML = svg('star');
  star.classList.toggle('on', draft.important);

  renderCatPicker($('detailCats'), draft.category, (id) => { draft.category = id; renderDetail(); }, false);

  // срок
  const dueOpts = [
    ['Без срок', null],
    ['Днес', today()],
    ['Утре', addDays(1)],
    ['След седмица', addDays(7)],
  ];
  const dueChips = dueOpts.map(([label, value]) => {
    const b = chip({ label, color: 'var(--primary)', checked: draft.due === value, dot: false });
    b.onclick = () => { draft.due = value; renderDetail(); };
    return b;
  });
  const custom = draft.due && !dueOpts.some(([, v]) => v === draft.due);
  const pick = chip({ label: custom ? dueLabel(draft.due) : 'Дата…', color: 'var(--primary)', checked: custom, html: svg('calendar') });
  pick.classList.add('chip-date');
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = draft.due || '';
  dateInput.setAttribute('aria-label', 'Избери дата');
  dateInput.onchange = () => { draft.due = dateInput.value || null; renderDetail(); };
  pick.append(dateInput);
  $('detailDue').replaceChildren(...dueChips, pick);

  // кой да я свърши
  const nobody = chip({ label: 'Всеки', color: 'var(--primary)', checked: !draft.assignee, dot: false });
  nobody.onclick = () => { draft.assignee = null; renderDetail(); };
  const people = members().map((m) => {
    const b = chip({ label: nameOf(m.email, { me: 'Аз' }), color: colorOf(m.email), checked: draft.assignee === m.uid, dot: false });
    b.prepend(avatarEl(m.email, 'avatar-sm'));
    b.onclick = () => { draft.assignee = m.uid; renderDetail(); };
    return b;
  });
  $('detailWho').replaceChildren(nobody, ...people);

  // Google Календар (целодневно събитие)
  const cal = $('calendarLink');
  cal.hidden = !draft.due;
  if (draft.due) {
    const start = draft.due.replaceAll('-', '');
    const end = addDays(1, parseDay(draft.due)).replaceAll('-', '');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: $('detailText').value.trim() || editing.text,
      dates: `${start}/${end}`,
      details: `Семейни задачи: ${cat.label}`,
    });
    cal.href = `https://calendar.google.com/calendar/render?${params}`;
  }

  const t = editing;
  let info = `Добавена от ${nameOf(t.createdByEmail, { me: 'теб' })} ${relTime(t.created)}`;
  if (t.done && t.doneByEmail) info += `. Отметната от ${nameOf(t.doneByEmail, { me: 'теб' })}`;
  $('detailInfo').textContent = info;
}

$('detailCheck').addEventListener('click', () => { draft.done = !draft.done; buzz(); renderDetail(); });
$('detailStar').addEventListener('click', () => { draft.important = !draft.important; renderDetail(); });
$('detailText').addEventListener('input', (e) => autosize(e.target));

detail.addEventListener('close', () => {
  const t = editing;
  editing = null;
  if (!t || detail.returnValue === 'deleted') return;

  const text = $('detailText').value.trim() || t.text;
  const changes = {};
  if (text !== t.text) changes.text = text;
  if (draft.category !== t.category) changes.category = draft.category;
  if ((draft.due || null) !== (t.due || null)) changes.due = draft.due;
  if (draft.important !== Boolean(t.important)) changes.important = draft.important;
  const assigneeChanged = (draft.assignee || null) !== (t.assignee || null);
  if (assigneeChanged) changes.assignee = draft.assignee;
  if (draft.done !== Boolean(t.done)) {
    changes.done = draft.done;
    changes.doneByEmail = draft.done ? state.user.email : null;
    changes.doneAt = draft.done ? Date.now() : null;
  }
  if (!Object.keys(changes).length) return;

  const action = assigneeChanged && draft.assignee && draft.assignee !== state.user.uid ? 'assign'
    : changes.text || changes.category || 'due' in changes ? 'edit'
    : 'done' in changes ? (draft.done ? 'done' : 'undone')
    : 'edit';
  saveTodo(t, changes, action);
});

$('deleteTodoBtn').addEventListener('click', () => {
  const t = editing;
  detail.close('deleted');
  if (t) removeTodo(t);
});

/* ================= Меню ================= */

$('menuBtn').addEventListener('click', () => {
  $('membersList').replaceChildren(...members().map((m) => {
    const li = document.createElement('li');
    li.append(avatarEl(m.email), m.uid === state.user.uid ? `${m.email} (ти)` : m.email);
    return li;
  }));
  $('menuDialog').showModal();
});
$('bellBtn').addEventListener('click', () => setNotify(!state.notify));
$('notifToggle').addEventListener('change', (e) => setNotify(e.target.checked));

// клик извън листа го затваря (и запазва промените)
for (const dlg of [detail, $('menuDialog')]) {
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close('save'); });
}

updateBell();

// обновява „преди N мин“ и „Днес“ всяка минута
setInterval(() => { if (state.todos.length) render(); }, 60_000);

/* ================= Service worker ================= */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('firebase-messaging-sw.js').catch((err) => console.warn(err));
}
