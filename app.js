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
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

/* ================= Настройки ================= */

// id-тата са същите като досега, за да работят и старите задачи
const CATEGORIES = [
  { id: 'Хранителни стоки', label: 'Храна',    color: '#E09A1A' },
  { id: 'Здраве',           label: 'Здраве',   color: '#E04E66' },
  { id: 'Дом',              label: 'Дом',      color: '#2F80D8' },
  { id: 'Ремонт',           label: 'Ремонт',   color: '#7457E8' },
  { id: 'Работа',           label: 'Работа',   color: '#14967F' },
  { id: 'Друго',            label: 'Друго',    color: '#858CA0' },
];
const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

const $ = (id) => document.getElementById(id);

const store = {
  get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
};

const state = {
  user: null,
  familyId: null,
  familyName: '',
  todos: [],
  filter: store.get('filter', 'all'),
  newCat: store.get('newCat', CATEGORIES[0].id),
  unsubscribe: null,
  firstSnapshot: true,
  freshIds: new Set(),
  editing: null,
  notify: store.get('notify', '0') === '1' && 'Notification' in window && Notification.permission === 'granted',
};

/* ================= Помощни ================= */

function nameOf(email) {
  if (!email) return 'Някой';
  if (state.user && email === state.user.email) return 'Ти';
  return email.split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function colorOf(text = '') {
  const palette = CATEGORIES.map((c) => c.color);
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % (palette.length - 1)];
}

function avatarEl(email, cls = '') {
  const el = document.createElement('span');
  el.className = `avatar ${cls}`.trim();
  el.style.setProperty('--av', colorOf(email));
  el.textContent = (email || '?').charAt(0).toUpperCase();
  return el;
}

const timeFmt = new Intl.DateTimeFormat('bg-BG', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('bg-BG', { day: 'numeric', month: 'short' });

function relTime(ms) {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'току-що';
  if (diff < 3_600_000) return `преди ${Math.floor(diff / 60_000)} мин`;
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `днес, ${timeFmt.format(d)}`;
  if (d.toDateString() === yesterday.toDateString()) return `вчера, ${timeFmt.format(d)}`;
  return dayFmt.format(d);
}

function buzz(ms = 12) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

/* ================= Известия в приложението ================= */

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
  if (state.notify) {
    toast({ text: 'Известията са включени', sub: 'Ще разбереш, когато някой добави или промени задача.' });
  } else {
    toast({ text: 'Известията са спрени от браузъра', sub: 'Разреши ги от настройките на сайта.', duration: 5000 });
  }
}

async function systemNotify(title, body, tag) {
  if (!state.notify || document.visibilityState === 'visible') return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) {
      await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    } else {
      new Notification(title, { body, tag, icon: 'icons/icon-192.png' });
    }
  } catch (err) {
    console.warn('Известието не беше показано', err);
  }
}

// Сравнява новото състояние със старото и съобщава за промените от другите
function announceChanges(snapshot) {
  const me = state.user?.uid;

  for (const change of snapshot.docChanges()) {
    if (change.doc.metadata.hasPendingWrites) continue; // наша собствена промяна
    const t = { id: change.doc.id, ...change.doc.data() };
    const cat = catOf(t.category).label;

    if (change.type === 'added' && t.createdBy !== me) {
      state.freshIds.add(t.id);
      const who = nameOf(t.createdByEmail);
      toast({ text: `${who} добави в ${cat}`, sub: t.text, email: t.createdByEmail });
      systemNotify(`${who} добави задача`, `${cat}: ${t.text}`, `todo-${t.id}`);
      buzz([10, 60, 10]);
    }

    if (change.type === 'modified' && t.updatedBy && t.updatedBy !== me) {
      const who = nameOf(t.updatedByEmail);
      if (t.lastAction === 'edit') {
        state.freshIds.add(t.id);
        toast({ text: `${who} промени задача`, sub: t.text, email: t.updatedByEmail });
        systemNotify(`${who} промени задача`, `${cat}: ${t.text}`, `todo-${t.id}`);
      } else if (t.lastAction === 'done') {
        toast({ text: `${who} отметна`, sub: t.text, email: t.updatedByEmail });
        systemNotify(`${who} отметна задача`, t.text, `todo-${t.id}`);
      }
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
  for (const id of ['menuBtn', 'menuAvatar']) {
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

  if (familyId) {
    const fam = await getDoc(doc(db, 'families', familyId));
    if (fam.exists()) {
      state.familyName = fam.data().name || '';
    } else {
      state.familyId = null;
    }
  }

  const joined = Boolean(state.familyId);
  $('familyNotJoined').hidden = joined;
  $('familyJoined').hidden = !joined;
  $('composer').hidden = !joined;
  $('leaveFamilyBtn').hidden = !joined;
  $('familyName').textContent = joined ? state.familyName || 'Семейство' : 'Добре дошъл';
  $('menuFamily').textContent = joined ? `Семейство ${state.familyName}` : 'Не си в група';
  $('familyCode').textContent = state.familyId || '—';
  $('familyCode').closest('.code-box').hidden = !joined;

  if (joined) startListening();
  else stopListening();
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
    await setDoc(doc(db, 'families', familyId), { name, createdBy: state.user.uid, created: Date.now() });
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

// Един слушател за цялото семейство — филтърът е в браузъра,
// затова не се трупат слушатели и не трябва допълнителен индекс.
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
    toast({ text: 'Задачите не се заредиха', sub: 'Провери връзката или правилата в Firebase.', duration: 6000 });
  });
}

/* ================= Рисуване ================= */

function render() {
  renderFilters();

  const match = (t) => state.filter === 'all' || t.category === state.filter;
  const open = state.todos.filter((t) => !t.done && match(t));
  const done = state.todos.filter((t) => t.done && match(t));

  const list = $('todo-list');
  list.replaceChildren(...open.map(todoEl));

  if (!open.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    const strong = document.createElement('strong');
    const p = document.createElement('span');
    if (!state.todos.length) {
      strong.textContent = 'Списъкът е празен';
      p.textContent = 'Напиши първата задача в полето отдолу.';
    } else if (done.length) {
      strong.textContent = 'Всичко е отметнато';
      p.textContent = 'Няма чакащи задачи тук.';
    } else {
      strong.textContent = `Няма задачи в ${catOf(state.filter).label}`;
      p.textContent = 'Добави една отдолу или избери друга категория.';
    }
    li.append(strong, p);
    list.append(li);
  }

  $('doneWrap').hidden = !done.length;
  $('doneTitle').textContent = `Готови (${done.length})`;
  $('done-list').replaceChildren(...done.map(todoEl));

  // подсветката на новите задачи е еднократна
  state.freshIds.clear();
}

function chipEl({ label, color, count, selected, role = 'pressed', all = false }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = all ? 'chip all' : 'chip';
  if (color) b.style.setProperty('--cat', color);
  if (role === 'pressed') b.setAttribute('aria-pressed', String(selected));
  else { b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(selected)); }

  if (color && !all) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    b.append(dot);
  }
  b.append(label);
  if (count) {
    const c = document.createElement('span');
    c.className = 'count';
    c.textContent = count;
    b.append(c);
  }
  return b;
}

function renderFilters() {
  const openCount = (id) => state.todos.filter((t) => !t.done && (id === 'all' || t.category === id)).length;

  const all = chipEl({ label: 'Всички', color: 'var(--primary)', count: openCount('all'), selected: state.filter === 'all', all: true });
  all.onclick = () => setFilter('all');

  const chips = CATEGORIES.map((c) => {
    const chip = chipEl({ label: c.label, color: c.color, count: openCount(c.id), selected: state.filter === c.id });
    chip.onclick = () => setFilter(c.id);
    return chip;
  });

  $('filterBar').replaceChildren(all, ...chips);
}

function setFilter(id) {
  state.filter = id;
  store.set('filter', id);
  if (id !== 'all') setNewCat(id); // новата задача отива в избраната категория
  render();
}

const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const MORE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';

function todoEl(t) {
  const cat = catOf(t.category);

  const li = document.createElement('li');
  li.className = 'todo';
  li.classList.toggle('done', Boolean(t.done));
  li.classList.toggle('is-new', state.freshIds.has(t.id));
  li.style.setProperty('--cat', cat.color);

  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'check';
  check.innerHTML = CHECK_SVG;
  check.setAttribute('aria-pressed', String(Boolean(t.done)));
  check.setAttribute('aria-label', t.done ? 'Върни като незавършена' : 'Отметни като готова');

  const body = document.createElement('div');
  body.className = 'todo-body';

  const text = document.createElement('p');
  text.className = 'todo-text';
  text.textContent = t.text; // textContent — никакъв HTML от потребителите

  const meta = document.createElement('div');
  meta.className = 'todo-meta';

  const catSpan = document.createElement('span');
  catSpan.className = 'cat';
  catSpan.textContent = cat.label;

  const who = document.createElement('span');
  who.className = 'who';
  const shownEmail = t.done && t.doneByEmail ? t.doneByEmail : t.createdByEmail;
  who.append(avatarEl(shownEmail), t.done && t.doneByEmail
    ? `отметнато от ${t.doneByEmail === state.user.email ? 'теб' : nameOf(t.doneByEmail)}`
    : nameOf(t.createdByEmail));

  const when = document.createElement('span');
  when.textContent = relTime(t.done && t.doneAt ? t.doneAt : t.created);

  meta.append(catSpan, who, when);
  body.append(text, meta);

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'more';
  more.innerHTML = MORE_SVG;
  more.setAttribute('aria-label', 'Редактирай или изтрий');
  more.onclick = (e) => { e.stopPropagation(); openEdit(t); };

  // целият ред отмята — най-лесният жест на телефон
  li.onclick = () => toggleDone(t);

  li.append(check, body, more);
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

async function toggleDone(t) {
  const done = !t.done;
  t.done = done; // веднага на екрана, без да чакаме сървъра
  t.doneByEmail = state.user.email;
  t.doneAt = Date.now();
  buzz();
  render();
  try {
    await updateDoc(doc(db, 'todos', t.id), {
      done,
      doneByEmail: done ? state.user.email : null,
      doneAt: done ? Date.now() : null,
      ...changeMeta(done ? 'done' : 'undone'),
    });
  } catch (err) {
    console.error(err);
    toast({ text: 'Промяната не беше запазена', sub: 'Провери връзката.' });
  }
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

async function clearDone() {
  const done = state.todos.filter((t) => t.done && (state.filter === 'all' || t.category === state.filter));
  if (!done.length || !confirm(`Да изтрия ли ${done.length} готови задачи?`)) return;
  const backup = done.map(({ id, ...data }) => ({ id, data }));
  await Promise.all(done.map((t) => deleteDoc(doc(db, 'todos', t.id))));
  toast({
    text: `Изтрити ${done.length} задачи`,
    duration: 6000,
    action: { label: 'Върни', run: () => backup.forEach(({ id, data }) => setDoc(doc(db, 'todos', id), data)) },
  });
}

$('clearDoneBtn').addEventListener('click', (e) => {
  e.preventDefault(); // да не затваря/отваря секцията
  clearDone();
});

/* ================= Нова задача ================= */

function renderCatPicker(container, selectedId, onPick) {
  container.replaceChildren(...CATEGORIES.map((c) => {
    const chip = chipEl({ label: c.label, color: c.color, selected: c.id === selectedId, role: 'radio' });
    chip.onclick = () => onPick(c.id);
    return chip;
  }));
}

function setNewCat(id) {
  state.newCat = id;
  store.set('newCat', id);
  renderCatPicker($('composerCats'), state.newCat, setNewCat);
}
setNewCat(catOf(state.newCat).id);

const input = $('newTodo');

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
    $('composer').requestSubmit();
  }
});
syncAddBtn();

$('composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !state.familyId) return;

  input.value = '';
  autosize(input);
  syncAddBtn();
  buzz();

  try {
    await addDoc(collection(db, 'todos'), {
      text,
      category: state.newCat,
      familyId: state.familyId,
      createdBy: state.user.uid,
      createdByEmail: state.user.email,
      created: Date.now(),
      done: false,
    });
  } catch (err) {
    console.error(err);
    input.value = text;
    syncAddBtn();
    toast({ text: 'Задачата не беше добавена', sub: 'Провери връзката и опитай пак.' });
  }
});

/* ================= Редакция ================= */

const editDialog = $('editDialog');
let editCat = null;

function openEdit(t) {
  state.editing = t;
  editCat = catOf(t.category).id;
  $('editText').value = t.text;
  const pick = (id) => { editCat = id; renderCatPicker($('editCats'), editCat, pick); };
  pick(editCat);
  editDialog.returnValue = '';
  editDialog.showModal();
}

editDialog.addEventListener('close', async () => {
  const t = state.editing;
  state.editing = null;
  if (!t || editDialog.returnValue !== 'save') return;

  const text = $('editText').value.trim();
  if (!text || (text === t.text && editCat === t.category)) return;

  await updateDoc(doc(db, 'todos', t.id), { text, category: editCat, ...changeMeta('edit') });
});

$('deleteTodoBtn').addEventListener('click', () => {
  const t = state.editing;
  editDialog.close('cancel');
  if (t) removeTodo(t);
});

/* ================= Меню ================= */

$('menuBtn').addEventListener('click', () => $('menuDialog').showModal());
$('bellBtn').addEventListener('click', () => setNotify(!state.notify));
$('notifToggle').addEventListener('change', (e) => setNotify(e.target.checked));

// клик извън листа го затваря
for (const dlg of [editDialog, $('menuDialog')]) {
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close('cancel'); });
}

updateBell();

// обновява „преди N мин“ всяка минута
setInterval(() => { if (state.todos.length) render(); }, 60_000);

/* ================= Service worker ================= */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('firebase-messaging-sw.js').catch((err) => console.warn(err));
}
