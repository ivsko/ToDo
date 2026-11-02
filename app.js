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
  getDocs,
  arrayUnion,
  increment,
  runTransaction,
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
  bell: '<path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.7c2 .6 3.4 2.4 4 5.3"/>',
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
  names: new Map(),          // имейл → име, което човекът си е избрал
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

// само малкото име — за бутоните с хора
const firstName = (email, me = 'Аз') => nameOf(email, { me }).split(' ')[0];

function nameOf(email, { me = 'Ти' } = {}) {
  if (!email) return 'Някой';
  if (me !== null && state.user && email === state.user.email) return me;
  const chosen = state.names.get(email);
  if (chosen) return chosen;
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
  el.textContent = (state.names.get(email) || email || '?').charAt(0).toUpperCase();
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
  if (!state.notify || state.push?.on || document.visibilityState === 'visible') return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    else new Notification(title, { body, tag, icon: 'icons/icon-192.png' });
  } catch (err) {
    console.warn('Известието не беше показано', err);
  }
}

// съобщава за промените, направени от другите в семейството
const announced = new Set(); // да не съобщаваме едно и също два пъти

function announceChanges(snapshot) {
  const me = state.user?.uid;

  for (const change of snapshot.docChanges()) {
    if (change.doc.metadata.hasPendingWrites) continue; // наша собствена промяна
    const t = { id: change.doc.id, ...change.doc.data() };
    const key = `${t.id}:${change.type === 'added' ? 'added' : `${t.updatedAt}:${t.lastAction}`}`;
    if (announced.has(key)) continue;
    announced.add(key);
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
    } else if (t.lastAction === 'accept' && (t.assignedBy || t.createdBy) === me) {
      toast({ text: `${who} прие задачата`, sub: t.text, email: t.updatedByEmail });
      systemNotify(`${who} прие задачата`, t.text, `todo-${t.id}`);
      buzz([10, 60, 10]);
    } else if (t.lastAction === 'comment') {
      if (editing?.id === t.id) continue; // коментарите вече се виждат на екрана
      toast({ text: `${who} коментира „${t.text}“`, sub: t.lastComment, email: t.updatedByEmail, action: { label: 'Отвори', run: () => openDetail(t) } });
      systemNotify(`${who} коментира „${t.text}“`, t.lastComment, `todo-${t.id}`);
      buzz([10, 60, 10]);
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

  const snap = await getDoc(doc(db, 'users', user.uid));
  const profile = snap.exists() ? snap.data() : {};
  if (profile.name) state.names.set(user.email, profile.name);
  $('nameInput').value = profile.name || '';
  showMyName();
  state.push = { topic: profile.ntfyTopic || null, on: Boolean(profile.ntfyOn && profile.ntfyTopic) };
  updatePushUI();
  await enterFamily(profile.familyId || null);
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
      loadMembersFromProfiles(familyId);
      // записваме се в списъка с членове (за избора „Кой да я свърши“)
      if (!state.familyMembers.some((m) => m.uid === state.user.uid)) {
        const me = { uid: state.user.uid, email: state.user.email };
        updateDoc(doc(db, 'families', familyId), { members: arrayUnion(me) })
          .catch((err) => console.warn('Не успях да се запиша в членовете (публикувани ли са правилата?)', err));
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
  $('familyName').textContent = joined ? state.familyName || 'Семейство' : 'Добре дошъл';
  $('menuFamily').textContent = joined ? `Семейство ${state.familyName}` : 'Не си в група';
  $('familyCode').textContent = state.familyId || '';

  if (joined) startListening();
  else { stopListening(); location.hash = ''; }
  route();
}

// Всички профили с този семеен код — така се виждат и хората,
// които още не са отворили новата версия на приложението.
async function loadMembersFromProfiles(familyId) {
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('familyId', '==', familyId)));
    const known = new Set(state.familyMembers.map((m) => m.uid));
    state.pushTopics.clear();
    state.pushLoadedAt = Date.now();
    for (const d of snap.docs) {
      const { email, ntfyTopic, ntfyOn, name } = d.data();
      if (email && name) state.names.set(email, name);
      if (email && !known.has(d.id)) state.familyMembers.push({ uid: d.id, email });
      if (ntfyOn && ntfyTopic) state.pushTopics.set(d.id, ntfyTopic);
    }
    if (state.familyId === familyId) render();
  } catch (err) {
    console.warn('Членовете не се заредиха — публикувай новите правила във Firebase.', err);
  }
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

  state.unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    if (!state.firstSnapshot) announceChanges(snapshot);
    state.firstSnapshot = false;
    state.todos = snapshot.docs.map((d) => ({ id: d.id, ...d.data(), pending: d.metadata.hasPendingWrites }));
    render();
    scheduleReminders();
    checkReminders();
  }, (err) => {
    console.error(err);
    toast({ text: 'Задачите не се заредиха', sub: 'Провери връзката или правилата във Firebase.', duration: 6000 });
  });
}

/* ================= Навигация ================= */

// #/list/today, #/list/c0 … — бутонът „Назад“ на телефона работи естествено
function route() {
  const h = location.hash;
  const joined = Boolean(state.familyId);
  const mList = h.match(/^#\/list\/(\w+)/);

  state.list = mList && joined ? listByKey(mList[1]) : null;
  state.view = state.list ? 'list' : 'home';

  $('homeView').hidden = state.view !== 'home';
  $('listView').hidden = state.view !== 'list';

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

// отиване на нов екран; „Назад“ (и бутонът на телефона) връща обратно
function go(hash) {
  history.pushState({ fromApp: true }, '', hash || location.pathname);
  route();
}

document.querySelectorAll('[data-back]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (history.state?.fromApp) history.back();
    else go(btn.dataset.back);
  });
});

function openList(key) {
  go(`#/list/${key}`);
}

/* ================= Рисуване ================= */

function render() {
  if (!state.familyId) return;
  if (state.view === 'list') renderList();
  else if (state.view === 'home') renderHome();
  renderComposerWho();
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

  state.freshIds.clear(); // подсветката на новите задачи е еднократна
}

function taskList(items) {
  const ul = document.createElement('ul');
  ul.className = 'task-list';
  ul.append(...items.map(taskEl));
  return ul;
}

// Възложена задача отмята само човекът, на когото е
const lockedFor = (t) => Boolean(t.assignee) && t.assignee !== state.user?.uid;

function lockedToast(t) {
  const email = emailOfUid(t.assignee);
  toast({ text: `Само ${nameOf(email)} може да я отметне`, sub: t.text, email });
  buzz([8, 40, 8]);
}

function acceptTodo(t) {
  buzz();
  return saveTodo(t, { accepted: true, acceptedAt: Date.now() }, 'accept');
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
  const locked = lockedFor(t);
  if (locked) {
    check.classList.add('locked');
    check.setAttribute('aria-label', `Само ${nameOf(emailOfUid(t.assignee))} може да я отметне`);
  }
  check.onclick = () => {
    if (locked) return lockedToast(t);
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

  // кой е сложил задачата — винаги първо
  const from = document.createElement('span');
  from.className = 'meta meta-from';
  from.textContent = `от ${nameOf(t.createdByEmail, { me: 'теб' })}`;
  meta.append(from);

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
    const mine = t.assignee === state.user.uid;
    const a = document.createElement('span');
    a.className = 'meta';
    let label = `за ${nameOf(email, { me: 'теб' })}`;
    if (!t.done && !t.accepted) {
      a.classList.add('meta-wait');
      label = mine ? 'за теб, не е приета' : `чака ${nameOf(email)}`;
    } else if (!t.done) {
      a.classList.add('meta-ok');
      label = mine ? 'ти я прие' : `${nameOf(email)} я прие`;
    }
    a.textContent = `→ ${label}`;
    meta.append(a);
  }
  if (t.remindAt && !t.done) {
    const r = document.createElement('span');
    r.className = t.remindAt < Date.now() ? 'meta meta-remind past' : 'meta meta-remind';
    r.innerHTML = svg('bell');
    r.append(remindLabel(t.remindAt));
    meta.append(r);
  }
  if (t.commentCount > 0) {
    const c = document.createElement('span');
    c.className = 'meta';
    c.innerHTML = svg('chat');
    c.append(String(t.commentCount));
    meta.append(c);
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

  // „Приеми“ — само за човека, на когото е възложена
  if (t.assignee === state.user.uid && !t.accepted && !t.done) {
    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'accept-btn';
    accept.textContent = 'Приеми';
    accept.onclick = () => acceptTodo(t);
    li.append(check, body, accept);
    return li;
  }

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

// Ясно обяснение защо Firebase е отказал, вместо общо „не е запазено“
function explainError(err, t, action) {
  console.error(err);
  const code = err?.code || '';
  const assigneeEmail = t?.assignee ? emailOfUid(t.assignee) : null;
  const assigneeName = assigneeEmail ? nameOf(assigneeEmail) : '';

  if (code === 'permission-denied') {
    if (assigneeEmail && t.assignee !== state.user.uid && ['done', 'undone'].includes(action)) {
      return toast({ text: `Нямаш право да я отметнеш`, sub: `Задачата е възложена на ${assigneeName}. Само той или тя може да я отметне.`, email: assigneeEmail, duration: 6000 });
    }
    if (assigneeEmail && t.assignee !== state.user.uid && action === 'accept') {
      return toast({ text: `Нямаш право да я приемеш`, sub: `Само ${assigneeName} може да приеме тази задача.`, email: assigneeEmail, duration: 6000 });
    }
    if (action === 'comment') {
      return toast({ text: 'Нямаш право да коментираш тук', sub: 'Публикувай новите правила във Firebase или провери дали още си в семейството.', duration: 6000 });
    }
    if (action === 'delete') {
      return toast({ text: 'Нямаш право да изтриеш тази задача', sub: 'Тя е на друго семейство или си излязъл от групата.', duration: 6000 });
    }
    if (action === 'add') {
      return toast({ text: 'Нямаш право да добавяш тук', sub: 'Провери дали още си в семейството (менюто горе).', duration: 6000 });
    }
    return toast({ text: 'Нямаш право да промениш тази задача', sub: 'Тя е възложена на друг или правилата във Firebase не го позволяват.', duration: 6000 });
  }
  if (code === 'unavailable' || code === 'deadline-exceeded' || !navigator.onLine) {
    return toast({ text: 'Няма връзка с интернет', sub: 'Промяната не е записана. Опитай пак, когато имаш връзка.', duration: 6000 });
  }
  if (code === 'not-found') {
    return toast({ text: 'Задачата вече не съществува', sub: 'Някой друг я е изтрил.', duration: 5000 });
  }
  return toast({ text: 'Промяната не беше записана', sub: `Неочаквана грешка (${code || 'без код'}). Опитай пак.`, duration: 6000 });
}

// кого да уведомим при промяна на задача
function notifyChange(t, action) {
  const boss = t.assignedBy || t.createdBy; // който е възложил задачата
  if (action === 'assign' && t.assignee) {
    pushTo([t.assignee], { title: `${myName()} ти възложи задача`, message: t.text, path: '#/list/mine' });
  } else if (action === 'accept') {
    pushTo([boss], { title: `${myName()} прие задачата`, message: t.text, path: '#/list/all' });
  } else if (action === 'done' && t.assignee) {
    pushTo([boss], { title: `${myName()} свърши задачата`, message: t.text, path: '#/list/all' });
  }
}

async function saveTodo(t, changes, action) {
  const before = {};
  for (const key of Object.keys(changes)) before[key] = t[key];
  Object.assign(t, changes); // веднага на екрана, без да чакаме сървъра
  render();
  try {
    await updateDoc(doc(db, 'todos', t.id), { ...changes, ...changeMeta(action) });
    notifyChange(t, action);
  } catch (err) {
    Object.assign(t, before); // връщаме екрана както си беше
    render();
    explainError(err, t, action);
  }
}

function toggleDone(t) {
  const done = !t.done;
  const changes = {
    done,
    doneByEmail: done ? state.user.email : null,
    doneAt: done ? Date.now() : null,
  };
  if (done && t.assignee && !t.accepted) Object.assign(changes, { accepted: true, acceptedAt: Date.now() });
  return saveTodo(t, changes, done ? 'done' : 'undone');
}

async function removeTodo(t) {
  const { id, ...data } = t;
  try {
    await deleteDoc(doc(db, 'todos', id));
  } catch (err) {
    return explainError(err, t, 'delete');
  }
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
  try {
    await Promise.all(done.map((t) => deleteDoc(doc(db, 'todos', t.id))));
  } catch (err) {
    return explainError(err, null, 'delete');
  }
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
    const b = chip({ label: firstName(m.email), color: colorOf(m.email), checked: state.newAssignee === m.uid, dot: false });
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

// „Напомни:“ при добавяне — по желание
state.newRemind = null;

function setNewRemind(ms) {
  state.newRemind = ms;
  $('remindBtn').classList.toggle('on', Boolean(ms));
  $('remindBtn').setAttribute('aria-pressed', String(Boolean(ms)));
  if (!ms && !$('composerRemind').dataset.keep) composer.classList.remove('remind-open');
  renderRemindPicker($('composerRemind'), state.newRemind, setNewRemind, 'Напомни:');
}

$('remindBtn').addEventListener('mousedown', (e) => e.preventDefault());
$('remindBtn').addEventListener('click', () => {
  composer.classList.add('open');
  composer.classList.toggle('remind-open');
  renderRemindPicker($('composerRemind'), state.newRemind, setNewRemind, 'Напомни:');
  input.focus();
});

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
  if (state.newRemind && state.newRemind > Date.now()) todo.remindAt = state.newRemind;
  const assignee = state.newAssignee || (list?.key === 'mine' ? state.user.uid : null);
  if (assignee) {
    todo.assignee = assignee;
    todo.assignedBy = state.user.uid;
    todo.accepted = assignee === state.user.uid; // на себе си — приета веднага
  }

  input.value = '';
  autosize(input);
  syncAddBtn();
  buzz();
  setNewRemind(null);
  if (assignee && assignee !== state.user.uid) {
    toast({ text: `Възложено на ${nameOf(emailOfUid(assignee))}`, sub: text, email: emailOfUid(assignee) });
  }

  try {
    await addDoc(collection(db, 'todos'), todo);
    if (todo.assignee && todo.assignee !== state.user.uid) {
      pushTo([todo.assignee], { title: `${myName()} ти възложи задача`, message: text, path: '#/list/mine' });
    } else {
      pushTo(otherUids(), { title: `${myName()} добави задача`, message: `${catOf(todo.category).short}: ${text}`, path: '#/list/all' });
    }
  } catch (err) {
    console.error(err);
    input.value = text;
    syncAddBtn();
    explainError(err, null, 'add');
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
    accepted: Boolean(t.accepted),
    remindAt: t.remindAt || null,
  };
  $('detailText').value = t.text;
  $('commentInput').value = '';
  renderDetail();
  openComments(t);
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
  check.classList.toggle('locked', detailLocked());

  // „Приеми задачата“ — за човека, на когото е възложена
  $('detailAccept').hidden = !(editing.assignee === state.user.uid && draft.assignee === state.user.uid && !draft.accepted && !draft.done);

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
    const b = chip({ label: firstName(m.email), color: colorOf(m.email), checked: draft.assignee === m.uid, dot: false });
    b.prepend(avatarEl(m.email, 'avatar-sm'));
    b.onclick = () => { draft.assignee = m.uid; renderDetail(); };
    return b;
  });
  $('detailWho').replaceChildren(nobody, ...people);

  // напомняне
  renderRemindPicker($('detailRemind'), draft.remindAt, (ms) => { draft.remindAt = ms; renderDetail(); });
  $('remindHint').textContent = draft.remindAt ? remindHint(draft.assignee, editing) : '';

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
  if (t.assignee && t.accepted && !t.done) info += `. Приета от ${nameOf(emailOfUid(t.assignee), { me: 'теб' })}`;
  if (t.assignee && !t.accepted && !t.done) info += t.assignee === state.user.uid ? '. Чака да я приемеш' : `. Чака ${nameOf(emailOfUid(t.assignee))} да я приеме`;
  if (t.done && t.doneByEmail) info += `. Отметната от ${nameOf(t.doneByEmail, { me: 'теб' })}`;
  $('detailInfo').textContent = info;
}

// заключено, ако задачата е (или става) възложена на друг
const detailLocked = () => lockedFor(editing) || lockedFor(draft);

$('detailCheck').addEventListener('click', () => {
  if (detailLocked()) return lockedToast(lockedFor(editing) ? editing : draft);
  draft.done = !draft.done;
  buzz();
  renderDetail();
});
$('detailAccept').addEventListener('click', () => { draft.accepted = true; buzz(); renderDetail(); });
$('detailStar').addEventListener('click', () => { draft.important = !draft.important; renderDetail(); });
$('detailText').addEventListener('input', (e) => autosize(e.target));

detail.addEventListener('close', () => {
  const t = editing;
  editing = null;
  closeComments();
  if (!t || detail.returnValue === 'deleted') return;

  const text = $('detailText').value.trim() || t.text;
  const changes = {};
  if (text !== t.text) changes.text = text;
  if (draft.category !== t.category) changes.category = draft.category;
  if ((draft.due || null) !== (t.due || null)) changes.due = draft.due;
  if (draft.important !== Boolean(t.important)) changes.important = draft.important;
  if ((draft.remindAt || null) !== (t.remindAt || null)) changes.remindAt = draft.remindAt;
  const assigneeChanged = (draft.assignee || null) !== (t.assignee || null);
  if (assigneeChanged) {
    changes.assignee = draft.assignee;
    changes.assignedBy = state.user.uid;
    changes.accepted = draft.assignee === state.user.uid; // новият човек трябва да я приеме
    changes.acceptedAt = changes.accepted ? Date.now() : null;
  } else if (draft.accepted && !t.accepted) {
    changes.accepted = true;
    changes.acceptedAt = Date.now();
  }
  if (draft.done !== Boolean(t.done)) {
    changes.done = draft.done;
    changes.doneByEmail = draft.done ? state.user.email : null;
    changes.doneAt = draft.done ? Date.now() : null;
    if (draft.done && t.assignee && !t.accepted && !assigneeChanged) {
      changes.accepted = true;
      changes.acceptedAt = Date.now();
    }
  }
  if (!Object.keys(changes).length) return;

  const action = assigneeChanged && draft.assignee && draft.assignee !== state.user.uid ? 'assign'
    : changes.text || changes.category || 'due' in changes || 'remindAt' in changes ? 'edit'
    : 'done' in changes ? (draft.done ? 'done' : 'undone')
    : changes.accepted ? 'accept'
    : 'edit';
  saveTodo(t, changes, action);
});

$('deleteTodoBtn').addEventListener('click', () => {
  const t = editing;
  detail.close('deleted');
  if (t) removeTodo(t);
});


/* ================= Напомняния ================= */

// Напомнянето се праща през ntfy с „отложена доставка“ — ntfy.sh го пази
// и го изпраща в точния час, дори всички телефони да са затворени.
// ntfy.sh приема до 3 дни напред, затова по-далечните се насрочват,
// когато някой отвори приложението в последните 3 дни преди часа.
const NTFY_MAX_AHEAD = 70 * 60 * 60_000; // малко под 3 дни

const at = (dayOffset, h, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

function remindLabel(ms) {
  const d = new Date(ms);
  const time = timeFmt.format(d);
  const day = isoDay(d);
  if (day === today()) return `днес ${time}`;
  if (day === addDays(1)) return `утре ${time}`;
  if (day === addDays(-1)) return `вчера ${time}`;
  return `${weekdayFmt.format(d)} ${time}`;
}

// на кого отива напомнянето: на човека, на когото е задачата, иначе на всички
const remindRecipients = (t) => (t.assignee ? [t.assignee] : members().map((m) => m.uid));

function remindHint(assignee, t = null) {
  const uids = assignee ? [assignee] : members().map((m) => m.uid);
  const who = assignee ? `Ще получи ${nameOf(emailOfUid(assignee), { me: 'ти' })}.` : 'Ще получат всички в семейството.';
  const without = uids.filter((uid) => !state.pushTopics.has(uid));
  let warn = '';
  if (without.includes(state.user.uid)) {
    warn = ' ⚠ Нямаш включени „Известия при затворено приложение“ (менюто горе) — ще го видиш само ако приложението е отворено.';
  } else if (without.length) {
    warn = ` ⚠ ${without.map((u) => nameOf(emailOfUid(u))).join(', ')} няма включени известия при затворено приложение.`;
  }
  let status = '';
  if (t?.remindAt && t.remindAt === draft?.remindAt) {
    if (t.remindScheduled === t.remindAt) status = ' ✓ Насрочено.';
    else if (t.remindAt - Date.now() > NTFY_MAX_AHEAD) status = ' Ще се насрочи 3 дни преди часа.';
  }
  return who + status + warn;
}

function renderRemindPicker(box, value, onPick, label = '') {
  const now = Date.now();
  const opts = [
    ['Без', null],
    ['След 1 час', now + 60 * 60_000],
  ];
  if (now < at(0, 18, 30)) opts.push(['Днес 19:00', at(0, 19)]);
  opts.push(['Утре 9:00', at(1, 9)]);

  const close = (a, b) => a && b && Math.abs(a - b) < 60_000;
  const chips = [];
  if (label) {
    const l = document.createElement('span');
    l.className = 'who-label';
    l.textContent = label;
    chips.push(l);
  }
  for (const [text, ms] of opts) {
    const checked = ms === null ? !value
      : text === 'След 1 час' ? Boolean(value) && value === state.lastHour
      : close(ms, value);
    const b = chip({ label: text, color: 'var(--primary)', checked, dot: false });
    b.onclick = () => {
      // „След 1 час“ се смята в момента на натискане
      const v = text === 'След 1 час' ? Date.now() + 60 * 60_000 : ms;
      if (text === 'След 1 час') state.lastHour = v;
      onPick(v);
    };
    chips.push(b);
  }
  const custom = value && !chips.some((c) => c.getAttribute?.('aria-checked') === 'true');
  const pick = chip({ label: custom ? remindLabel(value) : 'Друг час…', color: 'var(--primary)', checked: Boolean(custom), html: svg('bell') });
  pick.classList.add('chip-date');
  const inp = document.createElement('input');
  inp.type = 'datetime-local';
  inp.setAttribute('aria-label', 'Избери ден и час за напомняне');
  const base = new Date(value || at(1, 9));
  inp.value = `${isoDay(base)}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
  inp.onchange = () => {
    if (!inp.value) return;
    const ms = new Date(inp.value).getTime();
    if (ms <= Date.now()) return toast({ text: 'Часът вече е минал', sub: 'Избери час в бъдещето.' });
    onPick(ms);
  };
  pick.append(inp);
  chips.push(pick);
  box.replaceChildren(...chips);
}

async function sendReminder(t, recipients) {
  if (Date.now() - state.pushLoadedAt > 5 * 60_000) await loadMembersFromProfiles(state.familyId);
  const topics = [...new Set(recipients)].map((uid) => state.pushTopics.get(uid)).filter(Boolean);
  if (!topics.length) return 0;
  await Promise.all(topics.map((topic) => sendNtfy(topic, {
    title: '⏰ Напомняне',
    message: t.text,
    path: t.assignee ? '#/list/mine' : '#/list/all',
    at: t.remindAt,
  })));
  return topics.length;
}

// всеки отворен телефон проверява дали има напомняния за насрочване;
// транзакцията гарантира, че само един ще го насрочи
let scheduling = false;
let scheduleAgain = false;
async function scheduleReminders() {
  if (!state.familyId) return;
  if (scheduling) { scheduleAgain = true; return; } // ще проверим пак, щом свърши текущата
  scheduling = true;
  try {
    const now = Date.now();
    const due = state.todos.filter((t) => !t.pending && !t.done && t.remindAt
      && t.remindScheduled !== t.remindAt
      && t.remindAt > now - 10 * 60_000
      && t.remindAt - now <= NTFY_MAX_AHEAD);

    for (const t of due) {
      const ref = doc(db, 'todos', t.id);
      const claimed = await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const d = snap.data();
        if (!snap.exists() || d.done || !d.remindAt || d.remindScheduled === d.remindAt) return null;
        tx.update(ref, { remindScheduled: d.remindAt, lastAction: 'system' });
        return { id: snap.id, ...d };
      }).catch((err) => { console.warn('Напомнянето не беше насрочено', err); return null; });
      if (!claimed) continue;
      try {
        const sent = await sendReminder(claimed, remindRecipients(claimed));
        if (claimed.updatedBy === state.user.uid || claimed.createdBy === state.user.uid) {
          if (sent) toast({ text: `⏰ Напомнянето е насрочено за ${remindLabel(claimed.remindAt)}`, sub: claimed.text });
        }
      } catch (err) {
        console.warn(err);
        // връщаме отметката, за да опитаме пак
        updateDoc(doc(db, 'todos', claimed.id), { remindScheduled: null, lastAction: 'system' }).catch(() => {});
        toast({ text: 'Напомнянето не беше насрочено', sub: 'Няма връзка с ntfy. Ще опитам пак след малко.', duration: 6000 });
      }
    }
  } finally {
    scheduling = false;
    if (scheduleAgain) { scheduleAgain = false; setTimeout(scheduleReminders, 1500); }
  }
}

// докато приложението е отворено — и съобщение на екрана
const shownReminders = new Set();
function checkReminders() {
  if (!state.user) return;
  const now = Date.now();
  for (const t of state.todos) {
    if (t.done || !t.remindAt || t.remindAt > now || now - t.remindAt > 3 * 60_000) continue;
    if (!remindRecipients(t).includes(state.user.uid) || shownReminders.has(`${t.id}:${t.remindAt}`)) continue;
    shownReminders.add(`${t.id}:${t.remindAt}`);
    toast({ text: '⏰ Напомняне', sub: t.text, duration: 8000, action: { label: 'Отвори', run: () => openDetail(t) } });
    systemNotify('⏰ Напомняне', t.text, `remind-${t.id}`);
    buzz([20, 80, 20, 80, 20]);
  }
}
setInterval(checkReminders, 20_000);
setInterval(scheduleReminders, 10 * 60_000); // далечните влизат в 3-дневния прозорец

/* ================= Коментари към задача ================= */

// todos/<задача>/comments/<коментар>
let commentsUnsub = null;
let comments = [];

function openComments(t) {
  closeComments();
  comments = [];
  renderComments();
  const q = query(collection(db, 'todos', t.id, 'comments'), orderBy('created'));
  commentsUnsub = onSnapshot(q, (snap) => {
    comments = snap.docs.map((d) => ({ id: d.id, ...d.data(), pending: d.metadata.hasPendingWrites }));
    renderComments();
  }, (err) => {
    console.warn(err);
    if (err?.code === 'permission-denied') {
      $('commentList').textContent = 'Коментарите не се зареждат — публикувай новите правила във Firebase.';
    }
  });
}

function closeComments() {
  if (commentsUnsub) commentsUnsub();
  commentsUnsub = null;
}

function renderComments() {
  const box = $('commentList');
  if (!comments.length) {
    const p = document.createElement('p');
    p.className = 'muted small';
    p.textContent = 'Още няма коментари. Напиши въпрос или уточнение.';
    box.replaceChildren(p);
    return;
  }
  box.replaceChildren(...comments.map((c) => {
    const row = document.createElement('div');
    row.className = c.from === state.user.uid ? 'comment mine' : 'comment';
    const head = document.createElement('p');
    head.className = 'comment-head';
    const who = document.createElement('b');
    who.textContent = nameOf(c.fromEmail, { me: 'Ти' });
    const when = document.createElement('span');
    when.textContent = c.pending ? 'изпраща се…' : relTime(c.created);
    head.append(who, when);
    const text = document.createElement('p');
    text.className = 'comment-text';
    text.textContent = c.text; // никакъв HTML от потребителите
    row.append(head, text);
    return row;
  }));
  box.scrollTop = box.scrollHeight;
}

async function sendComment() {
  const t = editing;
  const inp = $('commentInput');
  const text = inp.value.trim();
  if (!t || !text) return;
  inp.value = '';
  autosize(inp);
  $('commentSend').disabled = true;
  try {
    await addDoc(collection(db, 'todos', t.id, 'comments'), {
      text, from: state.user.uid, fromEmail: state.user.email, created: Date.now(),
    });
    await updateDoc(doc(db, 'todos', t.id), {
      commentCount: increment(1),
      lastComment: text.slice(0, 140),
      ...changeMeta('comment'),
    });
    // известие до хората, свързани със задачата
    pushTo([t.assignee, t.createdBy, t.assignedBy], {
      title: `${myName()} коментира „${t.text.slice(0, 40)}“`,
      message: text,
      path: '#/list/all',
    });
  } catch (err) {
    inp.value = text;
    $('commentSend').disabled = false;
    explainError(err, t, 'comment');
  }
}

$('commentInput').addEventListener('input', (e) => {
  autosize(e.target);
  $('commentSend').disabled = !e.target.value.trim();
});
$('commentInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault(); // Enter праща коментара, не затваря листа
    sendComment();
  }
});
$('commentSend').addEventListener('click', sendComment);

/* ================= Меню ================= */

function renderMembers() {
  $('membersList').replaceChildren(...members().map((m) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'member-label';
    const nm = document.createElement('span');
    nm.textContent = nameOf(m.email, { me: null }) + (m.uid === state.user.uid ? ' (ти)' : '');
    const em = document.createElement('span');
    em.className = 'muted small';
    em.textContent = m.email;
    label.append(nm, em);
    li.append(avatarEl(m.email), label);
    return li;
  }));
}

$('menuBtn').addEventListener('click', () => {
  renderMembers();
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
setInterval(() => {
  // на всеки 5 мин обновяваме имената и каналите на членовете
  if (state.familyId && Date.now() - state.pushLoadedAt > 5 * 60_000) loadMembersFromProfiles(state.familyId);
  if (state.todos.length) render();
}, 60_000);

/* ================= Име в профила ================= */

function showMyName() {
  const email = state.user.email;
  const shown = nameOf(email, { me: null });
  $('user-info').textContent = shown;
  $('homeEmail').textContent = state.names.get(email) ? `${shown}, ${email}` : email;
  for (const id of ['menuAvatar', 'menuAvatarLg']) {
    const el = $(id);
    el.textContent = shown.charAt(0).toUpperCase();
    el.style.setProperty('--av', colorOf(email));
  }
}

async function saveName() {
  const name = $('nameInput').value.trim().replace(/\s+/g, ' ').slice(0, 30);
  try {
    await setDoc(doc(db, 'users', state.user.uid), { name: name || null }, { merge: true });
    if (name) state.names.set(state.user.email, name);
    else state.names.delete(state.user.email);
    $('nameInput').value = name;
    $('nameInput').blur();
    showMyName();
    renderMembers();
    render();
    toast({ text: name ? `Вече си „${name}“` : 'Името е изтрито', sub: name ? 'Останалите ще го видят до няколко минути.' : 'Пак ще се показва имейлът ти.' });
  } catch (err) {
    console.error(err);
    toast({ text: 'Името не беше записано', sub: 'Провери връзката и опитай пак.' });
  }
}

$('saveNameBtn').addEventListener('click', saveName);
$('nameInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); saveName(); } // Enter не затваря менюто
});


/* ================= Известия при затворено приложение (ntfy) ================= */

// Всеки има свой таен канал в ntfy.sh. Приложението праща известие
// само на хората, за които се отнася промяната. Без сървър и без плащане.
state.push = { topic: null, on: false };
state.pushTopics = new Map();   // uid → канал (само на включилите)
state.pushLoadedAt = 0;

const myName = () => nameOf(state.user.email, { me: null });
const otherUids = () => members().map((m) => m.uid).filter((uid) => uid !== state.user.uid);

function newTopic() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return 'semeini-' + [...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
}

async function sendNtfy(topic, { title, message, path = '', at = null }) {
  const body = {
    topic,
    title,
    message: String(message).slice(0, 300),
    click: `${location.origin}${location.pathname}${path}`,
    tags: ['memo'],
  };
  // отложена доставка: ntfy го изпраща в точния час (минимум 10 сек напред)
  if (at && at - Date.now() > 15_000) body.delay = String(Math.floor(at / 1000));
  // без Content-Type — браузърът не прави допълнителна CORS проверка
  const res = await fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`ntfy ${res.status}`);
}

// изпраща до избрани членове (никога до теб самия)
async function pushTo(uids, msg) {
  try {
    if (Date.now() - state.pushLoadedAt > 5 * 60_000) await loadMembersFromProfiles(state.familyId);
    const topics = [...new Set(uids)]
      .filter((uid) => uid && uid !== state.user.uid)
      .map((uid) => state.pushTopics.get(uid))
      .filter(Boolean);
    await Promise.all(topics.map((topic) => sendNtfy(topic, msg)));
  } catch (err) {
    console.warn('Известието през ntfy не беше изпратено', err);
  }
}

function updatePushUI() {
  $('pushToggle').checked = state.push.on;
  $('pushSteps').hidden = !state.push.on;
  $('pushTopic').textContent = state.push.topic || '';
}

$('pushToggle').addEventListener('change', async (e) => {
  const on = e.target.checked;
  const topic = state.push.topic || newTopic();
  try {
    await setDoc(doc(db, 'users', state.user.uid), { ntfyTopic: topic, ntfyOn: on }, { merge: true });
    state.push = { topic, on };
    if (on) state.pushTopics.set(state.user.uid, topic);
    else state.pushTopics.delete(state.user.uid);
    updatePushUI();
    state.pushLoadedAt = 0; // другите ще го видят при следващото изпращане
    if (on) toast({ text: 'Известията са включени', sub: 'Изпълни стъпките отдолу на този телефон.', duration: 5000 });
  } catch (err) {
    e.target.checked = !on;
    toast({ text: 'Настройката не беше записана', sub: 'Провери връзката и опитай пак.' });
  }
});

$('copyTopicBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(state.push.topic);
    toast({ text: 'Името на канала е копирано', sub: 'Постави го в ntfy след +.' });
  } catch {
    prompt('Копирай името на канала:', state.push.topic);
  }
});

$('testPushBtn').addEventListener('click', async () => {
  try {
    await sendNtfy(state.push.topic, { title: 'Семейни задачи', message: 'Пробно известие — работи!' });
    toast({ text: 'Изпратено', sub: 'До секунди трябва да дойде известие от ntfy.' });
  } catch (err) {
    console.warn(err);
    toast({ text: 'Известието не беше изпратено', sub: 'Провери интернет връзката.' });
  }
});

/* ================= Service worker ================= */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('firebase-messaging-sw.js').catch((err) => console.warn(err));
}
