/*
 * Уроци на децата и плащания с квитанции.
 *
 * Квитанциите се смаляват в браузъра (до ~1600 px, JPEG) и се пазят в облака,
 * в отделна колекция receipts. Списъкът зарежда само малка миниатюра; цялата
 * снимка се тегли едва когато я отвориш. Нищо не се записва в паметта на телефона.
 */
import {
  collection, addDoc, onSnapshot, query, where, updateDoc, doc, deleteDoc, getDoc, setDoc, writeBatch,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

const MAX_RECEIPT = 650 * 1024; // байта след смаляване; документът във Firestore е до 1 MiB
const KID_COLORS = ['#E07A1F', '#2D6BE4', '#14967F', '#D6455D', '#7457E8', '#C28A0E'];
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const PRICE_TYPES = { month: 'на месец', lesson: 'на урок', once: 'еднократно' };

const ICON = {
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M19 19v2H6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chevL: '<path d="M15 18l-6-6 6-6"/>',
  chevR: '<path d="M9 18l6-6-6-6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};
const svg = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
export const lessonsIcon = ICON.book;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const thisMonth = () => monthOf(new Date());
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); return monthOf(new Date(y, m - 1 + n, 1)); };
const monthName = (ym) => { const [y, m] = ym.split('-').map(Number); return new Intl.DateTimeFormat('bg-BG', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1)); };
const monthShort = (ym) => { const [y, m] = ym.split('-').map(Number); return new Intl.DateTimeFormat('bg-BG', { month: 'long' }).format(new Date(y, m - 1, 1)); };
const dayLabel = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Intl.DateTimeFormat('bg-BG', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d)); };
const money = (n) => `${(Math.round((+n || 0) * 100) / 100).toFixed(2).replace('.', ',')} €`;
const kb = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.round(bytes / 1024)} KB`);
const weekday = () => ((new Date().getDay() + 6) % 7) + 1; // 1 = понеделник

/* ================= Обработка на квитанции ================= */

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

function toJpeg(img, maxSide, quality) {
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

const dataBytes = (dataUrl) => Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

/** Връща { kind, data, thumb, size, original } или хвърля грешка с разбираемо съобщение. */
export async function prepareReceipt(file) {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_RECEIPT) throw new Error(`PDF файлът е ${kb(file.size)}, а може до ${kb(MAX_RECEIPT)}. Снимай квитанцията или направи екранна снимка.`);
    return { kind: 'pdf', data: await readAsDataUrl(file), thumb: '', size: file.size, original: file.size };
  }
  let img;
  try {
    img = await loadImage(file);
  } catch {
    throw new Error('Не мога да отворя този файл. Избери снимка (JPG, PNG) или PDF.');
  }
  // Постепенно по-малко, докато влезе в лимита. Текстът на квитанция остава четлив.
  const steps = [[1600, 0.72], [1400, 0.62], [1200, 0.55], [1000, 0.5]];
  let data = '';
  for (const [side, q] of steps) {
    data = toJpeg(img, side, q);
    if (dataBytes(data) <= MAX_RECEIPT) break;
  }
  if (dataBytes(data) > MAX_RECEIPT) throw new Error('Снимката е твърде голяма дори след смаляване.');
  return { kind: 'image', data, thumb: toJpeg(img, 160, 0.6), size: dataBytes(data), original: file.size };
}

/* ================= Модул ================= */

export function createLessons({ db, $, toast, getUser, onChange }) {
  const st = {
    familyId: null,
    kids: [], lessons: [], payments: [],
    unsub: [],
    tab: 'lessons',
    kidFilter: 'all',
    month: thisMonth(),
    editLesson: null,     // урокът в листа или {} за нов
    lessonDraft: null,
    editPayment: null,
    paymentDraft: null,
    receipt: null,        // нова квитанция, още незаписана
    removeReceipt: false,
    confirmDelete: null,
  };

  /* ---------- Данни ---------- */

  function stop() {
    st.unsub.forEach((u) => u());
    st.unsub = [];
    st.kids = []; st.lessons = []; st.payments = [];
  }

  function start(familyId) {
    stop();
    st.familyId = familyId;
    if (!familyId) return;
    const listen = (name, key) => st.unsub.push(onSnapshot(
      query(collection(db, name), where('familyId', '==', familyId)),
      (snap) => {
        st[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        render();
        onChange?.();
      },
      (err) => {
        console.error(err);
        toast({ text: 'Уроците не се заредиха', sub: 'Публикувай новите правила във Firebase. Виж README.', duration: 7000 });
      },
    ));
    listen('kids', 'kids');
    listen('lessons', 'lessons');
    listen('payments', 'payments');
  }

  const kidOf = (id) => st.kids.find((k) => k.id === id);
  const lessonOf = (id) => st.lessons.find((l) => l.id === id);
  const kidsSorted = () => [...st.kids].sort((a, b) => (a.created || 0) - (b.created || 0));
  const paidFor = (lesson, ym) => st.payments.some((p) => p.lessonId === lesson.id && p.period === ym);
  const lessonsSorted = () => [...st.lessons].sort((a, b) =>
    (kidsSorted().findIndex((k) => k.id === a.kidId) - kidsSorted().findIndex((k) => k.id === b.kidId))
    || String(a.title).localeCompare(String(b.title), 'bg'));

  /** Колко месечни урока още не са платени за текущия месец (за броя на началния екран). */
  function unpaidCount() {
    const ym = thisMonth();
    return st.lessons.filter((l) => l.active !== false && l.priceType === 'month' && !paidFor(l, ym)).length;
  }

  /* ---------- Рисуване ---------- */

  function kidChip(kid, on) {
    return `<button type="button" class="chip" role="radio" aria-checked="${on}" data-kid="${esc(kid.id)}" style="--c:${esc(kid.color)}"><span class="dot"></span>${esc(kid.name)}</button>`;
  }

  function scheduleText(l) {
    const days = (l.days || []).slice().sort().map((d) => DAYS[d - 1]).join(', ');
    return [days, l.time].filter(Boolean).join(' · ');
  }

  function statusHtml(l) {
    if (l.priceType !== 'month') return '';
    const ym = thisMonth();
    return paidFor(l, ym)
      ? `<span class="pay-pill ok">Платено за ${esc(monthShort(ym))}</span>`
      : `<span class="pay-pill due">Не е платено за ${esc(monthShort(ym))}</span>`;
  }

  function lessonRow(l) {
    const kid = kidOf(l.kidId);
    const meta = [scheduleText(l), l.price ? `${money(l.price)} ${PRICE_TYPES[l.priceType] || ''}` : '', l.teacher].filter(Boolean).map(esc).join(' · ');
    return `<li><button type="button" class="lesson-row" data-lesson="${esc(l.id)}" style="--c:${esc(kid?.color || '#7C8396')}">
      <span class="list-icon">${svg('book')}</span>
      <span class="lesson-body">
        <span class="lesson-title">${esc(l.title)}${st.kidFilter === 'all' && kid ? ` <span class="lesson-kid">${esc(kid.name)}</span>` : ''}</span>
        <span class="lesson-meta">${meta}</span>
        ${statusHtml(l)}
      </span>
      ${svg('chevR').replace('<svg', '<svg class="list-chev"')}
    </button></li>`;
  }

  function paymentRow(p) {
    const l = lessonOf(p.lessonId);
    const kid = kidOf(p.kidId);
    const thumb = p.receipt
      ? (p.receipt.thumb ? `<img class="pay-thumb" src="${esc(p.receipt.thumb)}" alt="">` : `<span class="pay-thumb pdf">PDF</span>`)
      : `<span class="pay-thumb none" title="Без квитанция">${svg('receipt')}</span>`;
    const sub = [dayLabel(p.date), p.period && l?.priceType === 'month' ? `за ${monthShort(p.period)}` : '', kid?.name, p.note].filter(Boolean).map(esc).join(' · ');
    return `<li><button type="button" class="pay-row" data-payment="${esc(p.id)}">
      ${thumb}
      <span class="lesson-body"><span class="lesson-title">${esc(l?.title || 'Изтрит урок')}</span><span class="lesson-meta">${sub}</span></span>
      <span class="pay-amount">${money(p.amount)}</span>
    </button></li>`;
  }

  function render() {
    const view = $('lessonsView');
    if (!view || view.hidden) return;
    const kids = kidsSorted();
    if (st.kidFilter !== 'all' && !kidOf(st.kidFilter)) st.kidFilter = 'all';
    const byKid = (x) => st.kidFilter === 'all' || x.kidId === st.kidFilter;

    $('kidChips').innerHTML =
      `<button type="button" class="chip" role="radio" aria-checked="${st.kidFilter === 'all'}" data-kid="all">Всички</button>` +
      kids.map((k) => kidChip(k, st.kidFilter === k.id)).join('') +
      `<button type="button" class="chip chip-add" data-kid-add>${svg('plus')}Дете</button>`;

    document.querySelectorAll('#lessonTabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === st.tab)));
    $('lessonsPane').hidden = st.tab !== 'lessons';
    $('paymentsPane').hidden = st.tab !== 'payments';

    const unpaid = unpaidCount();
    $('lessonsSub').textContent = !kids.length
      ? 'Започни, като добавиш дете.'
      : unpaid ? `${unpaid} ${unpaid === 1 ? 'урок чака' : 'урока чакат'} плащане за ${monthShort(thisMonth())}` : 'Всичко за месеца е платено';

    if (st.tab === 'lessons') {
      const list = lessonsSorted().filter(byKid);
      const today = list.filter((l) => (l.days || []).includes(weekday())).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
      let html = '';
      if (!kids.length) {
        html = `<div class="empty"><div class="empty-icon">${svg('book')}</div><strong>Няма добавени деца</strong><span>Натисни „+ Дете“ горе, после добави уроците му.</span></div>`;
      } else if (!list.length) {
        html = `<div class="empty"><div class="empty-icon">${svg('book')}</div><strong>Няма уроци</strong><span>Добави първия урок с бутона отдолу.</span></div>`;
      } else {
        if (today.length) {
          html += `<h2 class="section-title">Днес</h2><ul class="list-group today-list">${today.map((l) => `<li class="today-item" style="--c:${esc(kidOf(l.kidId)?.color || '#7C8396')}"><span class="today-time">${esc(l.time || '–')}</span><span><b>${esc(l.title)}</b> <span class="muted">${esc(kidOf(l.kidId)?.name || '')}${l.place ? ' · ' + esc(l.place) : ''}</span></span></li>`).join('')}</ul>`;
        }
        const groups = st.kidFilter === 'all' ? kids : kids.filter((k) => k.id === st.kidFilter);
        for (const k of groups) {
          const own = list.filter((l) => l.kidId === k.id);
          if (!own.length) continue;
          html += `<h2 class="section-title kid-title" style="--c:${esc(k.color)}">${esc(k.name)}</h2><ul class="list-group">${own.map(lessonRow).join('')}</ul>`;
        }
      }
      $('lessonsPane').querySelector('.pane-body').innerHTML = html;
      $('addLessonBtn').disabled = !kids.length;
    } else {
      const ym = st.month;
      const pays = st.payments.filter((p) => byKid(p) && (p.date || '').startsWith(ym)).sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
      const total = pays.reduce((s, p) => s + (+p.amount || 0), 0);
      const perKid = kids.filter((k) => st.kidFilter === 'all' || k.id === st.kidFilter)
        .map((k) => ({ k, sum: pays.filter((p) => p.kidId === k.id).reduce((s, p) => s + (+p.amount || 0), 0) }))
        .filter((x) => x.sum > 0);
      const missing = st.lessons.filter((l) => byKid(l) && l.active !== false && l.priceType === 'month' && !paidFor(l, ym));
      const noReceipt = pays.filter((p) => !p.receipt).length;
      $('monthLabel').textContent = monthName(ym);
      $('nextMonth').disabled = ym >= thisMonth();
      let html = `<div class="pay-summary"><div><span class="muted small">Платено за месеца</span><b>${money(total)}</b></div>
        ${perKid.length > 1 ? `<div class="pay-kids">${perKid.map(({ k, sum }) => `<span style="--c:${esc(k.color)}"><i></i>${esc(k.name)} ${money(sum)}</span>`).join('')}</div>` : ''}
        ${noReceipt ? `<p class="muted small">${noReceipt} ${noReceipt === 1 ? 'плащане е' : 'плащания са'} без квитанция.</p>` : ''}</div>`;
      if (missing.length) {
        html += `<h2 class="section-title alert">Чакат плащане за ${esc(monthShort(ym))}</h2><ul class="list-group">${missing.map((l) => `<li><button type="button" class="lesson-row" data-pay-for="${esc(l.id)}" style="--c:${esc(kidOf(l.kidId)?.color || '#7C8396')}"><span class="list-icon">${svg('book')}</span><span class="lesson-body"><span class="lesson-title">${esc(l.title)} <span class="lesson-kid">${esc(kidOf(l.kidId)?.name || '')}</span></span><span class="lesson-meta">${l.price ? money(l.price) : ''}</span></span><span class="pay-cta">Плати</span></button></li>`).join('')}</ul>`;
      }
      html += pays.length
        ? `<h2 class="section-title">Плащания</h2><ul class="list-group">${pays.map(paymentRow).join('')}</ul>`
        : `<div class="empty"><div class="empty-icon">${svg('receipt')}</div><strong>Няма плащания за ${esc(monthShort(ym))}</strong><span>Добави плащане и снимай квитанцията.</span></div>`;
      $('paymentsPane').querySelector('.pane-body').innerHTML = html;
      $('addPaymentBtn').disabled = !st.lessons.length;
    }
  }

  /* ---------- Деца ---------- */

  function openKid(kid) {
    st.editKid = kid || null;
    $('kidName').value = kid?.name || '';
    const used = new Set(st.kids.map((k) => k.color));
    st.kidColor = kid?.color || KID_COLORS.find((c) => !used.has(c)) || KID_COLORS[0];
    renderKidColors();
    $('kidTitle').textContent = kid ? 'Промени дете' : 'Ново дете';
    $('deleteKidBtn').hidden = !kid;
    st.confirmDelete = null;
    $('deleteKidBtn').textContent = '';
    $('deleteKidBtn').innerHTML = svg('trash');
    $('kidDialog').showModal();
    setTimeout(() => $('kidName').focus(), 50);
  }

  function renderKidColors() {
    $('kidColors').innerHTML = KID_COLORS.map((c) => `<button type="button" class="color-dot" style="--c:${c}" data-color="${c}" aria-label="Цвят" aria-pressed="${c === st.kidColor}"></button>`).join('');
  }

  async function saveKid() {
    const name = $('kidName').value.trim();
    if (!name) return toast({ text: 'Въведи име на детето' });
    const data = { name, color: st.kidColor };
    $('kidDialog').close();
    try {
      if (st.editKid) await updateDoc(doc(db, 'kids', st.editKid.id), data);
      else {
        const ref = await addDoc(collection(db, 'kids'), { ...data, familyId: st.familyId, created: Date.now() });
        st.kidFilter = ref.id;
      }
    } catch (err) {
      console.error(err);
      toast({ text: 'Не успях да запиша детето', sub: 'Провери правилата във Firebase.' });
    }
  }

  async function deleteKid() {
    const k = st.editKid;
    if (!k) return;
    if (st.lessons.some((l) => l.kidId === k.id)) return toast({ text: 'Първо изтрий уроците на детето', sub: 'Така няма да се загубят плащания по погрешка.' });
    $('kidDialog').close();
    await deleteDoc(doc(db, 'kids', k.id)).catch(() => toast({ text: 'Не успях да изтрия' }));
  }

  /* ---------- Урок ---------- */

  function openLesson(l) {
    st.editLesson = l || null;
    st.confirmDelete = null;
    const kidId = l?.kidId || (st.kidFilter !== 'all' ? st.kidFilter : kidsSorted()[0]?.id);
    st.lessonDraft = { kidId, days: [...(l?.days || [])] };
    $('lessonTitle').value = l?.title || '';
    $('lessonTime').value = l?.time || '';
    $('lessonDuration').value = l?.duration || '';
    $('lessonTeacher').value = l?.teacher || '';
    $('lessonContact').value = l?.contact || '';
    $('lessonPlace').value = l?.place || '';
    $('lessonPrice').value = l?.price ?? '';
    $('lessonPriceType').value = l?.priceType || 'month';
    $('lessonNotes').value = l?.notes || '';
    $('lessonSheetTitle').textContent = l ? 'Урок' : 'Нов урок';
    $('deleteLessonBtn').hidden = !l;
    $('deleteLessonBtn').innerHTML = svg('trash');
    renderLessonSheet();
    $('lessonDialog').showModal();
    if (!l) setTimeout(() => $('lessonTitle').focus(), 50);
  }

  function renderLessonSheet() {
    const d = st.lessonDraft;
    $('lessonKids').innerHTML = kidsSorted().map((k) => kidChip(k, k.id === d.kidId)).join('');
    $('lessonDays').innerHTML = DAYS.map((name, i) => `<button type="button" class="chip day-chip" role="checkbox" aria-checked="${d.days.includes(i + 1)}" data-day="${i + 1}" style="--c:var(--primary)">${name}</button>`).join('');
    const l = st.editLesson;
    $('lessonPayBox').hidden = !l;
    if (l) {
      const pays = st.payments.filter((p) => p.lessonId === l.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
      const sum = st.payments.filter((p) => p.lessonId === l.id).reduce((s, p) => s + (+p.amount || 0), 0);
      $('lessonPays').innerHTML = pays.length ? `<ul class="list-group flat">${pays.map(paymentRow).join('')}</ul>` : '<p class="muted small">Още няма плащания.</p>';
      $('lessonPaySum').textContent = pays.length ? `Общо ${money(sum)}` : '';
    }
  }

  async function saveLesson() {
    const d = st.lessonDraft;
    const title = $('lessonTitle').value.trim();
    if (!title) return toast({ text: 'Въведи какъв е урокът', sub: 'напр. Пиано, Английски, Плуване' });
    if (!d.kidId) return toast({ text: 'Избери дете' });
    const data = {
      kidId: d.kidId, title, days: d.days.slice().sort(),
      time: $('lessonTime').value, duration: Math.max(0, +$('lessonDuration').value || 0) || null,
      teacher: $('lessonTeacher').value.trim(), contact: $('lessonContact').value.trim(), place: $('lessonPlace').value.trim(),
      price: Math.max(0, +String($('lessonPrice').value).replace(',', '.') || 0), priceType: $('lessonPriceType').value,
      notes: $('lessonNotes').value.trim(), active: true,
    };
    $('lessonDialog').close();
    try {
      if (st.editLesson) {
        await updateDoc(doc(db, 'lessons', st.editLesson.id), data);
        // плащанията следват детето, ако урокът се премести на друго дете
        if (data.kidId !== st.editLesson.kidId) {
          const b = writeBatch(db);
          st.payments.filter((p) => p.lessonId === st.editLesson.id).forEach((p) => b.update(doc(db, 'payments', p.id), { kidId: data.kidId }));
          await b.commit();
        }
      } else await addDoc(collection(db, 'lessons'), { ...data, familyId: st.familyId, created: Date.now() });
    } catch (err) {
      console.error(err);
      toast({ text: 'Не успях да запиша урока', sub: 'Провери връзката.' });
    }
  }

  async function deleteLesson() {
    const l = st.editLesson;
    if (!l) return;
    const pays = st.payments.filter((p) => p.lessonId === l.id);
    if (st.confirmDelete !== l.id) {
      st.confirmDelete = l.id;
      $('deleteLessonBtn').textContent = pays.length ? `Изтрий и ${pays.length} плащ.` : 'Потвърди';
      return;
    }
    $('lessonDialog').close();
    const b = writeBatch(db);
    b.delete(doc(db, 'lessons', l.id));
    pays.forEach((p) => { b.delete(doc(db, 'payments', p.id)); if (p.receipt) b.delete(doc(db, 'receipts', p.id)); });
    await b.commit().catch(() => toast({ text: 'Не успях да изтрия урока' }));
    toast({ text: `Урокът „${l.title}“ е изтрит` });
  }

  /* ---------- Плащане ---------- */

  function openPayment(p, lessonId) {
    st.editPayment = p || null;
    st.receipt = null;
    st.removeReceipt = false;
    st.confirmDelete = null;
    const lid = p?.lessonId || lessonId || st.lessons.find((l) => st.kidFilter === 'all' || l.kidId === st.kidFilter)?.id || st.lessons[0]?.id;
    const l = lessonOf(lid);
    $('payLesson').innerHTML = lessonsSorted().map((x) => `<option value="${esc(x.id)}">${esc(x.title)} · ${esc(kidOf(x.kidId)?.name || '')}</option>`).join('');
    $('payLesson').value = lid || '';
    $('payAmount').value = p ? p.amount : l?.price || '';
    $('payDate').value = p?.date || isoDay(new Date());
    const ym = st.tab === 'payments' ? st.month : thisMonth();
    $('payPeriod').value = p?.period || (lessonId && l && !paidFor(l, ym) ? ym : ym);
    $('payNote').value = p?.note || '';
    $('paySheetTitle').textContent = p ? 'Плащане' : 'Ново плащане';
    $('deletePaymentBtn').hidden = !p;
    $('deletePaymentBtn').innerHTML = svg('trash');
    renderPaymentSheet();
    if ($('lessonDialog').open) $('lessonDialog').close();
    $('paymentDialog').showModal();
  }

  function renderPaymentSheet() {
    const l = lessonOf($('payLesson').value);
    $('payPeriodField').hidden = l?.priceType !== 'month';
    const box = $('receiptBox');
    const existing = st.editPayment?.receipt && !st.removeReceipt ? st.editPayment.receipt : null;
    const r = st.receipt || existing;
    if (r) {
      const preview = r.kind === 'pdf' ? `<span class="pay-thumb pdf big">PDF</span>` : `<img class="receipt-preview" src="${esc(st.receipt ? st.receipt.data : r.thumb)}" alt="Квитанция">`;
      const info = st.receipt
        ? `Смалена от ${kb(st.receipt.original)} на ${kb(st.receipt.size)}`
        : `Записана квитанция, ${kb(r.size || 0)}`;
      box.innerHTML = `<div class="receipt-has">${preview}<div class="receipt-info"><span class="small">${info}</span>
        <div class="receipt-actions">${!st.receipt ? '<button type="button" class="btn btn-soft btn-sm" data-r="view">Отвори</button>' : ''}<button type="button" class="btn btn-soft btn-sm" data-r="replace">Смени</button><button type="button" class="btn btn-soft btn-sm danger" data-r="remove">Махни</button></div></div></div>`;
    } else {
      box.innerHTML = `<div class="receipt-add">
        <button type="button" class="btn btn-soft" data-r="camera">${svg('camera')}Снимай</button>
        <button type="button" class="btn btn-soft" data-r="file">${svg('file')}Избери файл</button></div>
        <p class="muted small">Снимката се смалява преди качване и не се пази в телефона.</p>`;
    }
  }

  async function onReceiptFile(file) {
    if (!file) return;
    $('receiptBox').innerHTML = '<p class="muted small">Смалявам квитанцията…</p>';
    try {
      st.receipt = await prepareReceipt(file);
      st.removeReceipt = false;
    } catch (err) {
      toast({ text: 'Квитанцията не е добавена', sub: err.message, duration: 6000 });
    }
    renderPaymentSheet();
  }

  async function savePayment() {
    const lessonId = $('payLesson').value;
    const l = lessonOf(lessonId);
    const amount = +String($('payAmount').value).replace(',', '.');
    if (!l) return toast({ text: 'Избери урок' });
    if (!(amount > 0)) return toast({ text: 'Въведи сума' });
    const date = $('payDate').value || isoDay(new Date());
    const data = {
      lessonId, kidId: l.kidId, amount: Math.round(amount * 100) / 100, date,
      period: l.priceType === 'month' ? ($('payPeriod').value || date.slice(0, 7)) : date.slice(0, 7),
      note: $('payNote').value.trim(),
    };
    const btn = $('savePaymentBtn');
    btn.disabled = true;
    btn.textContent = st.receipt ? 'Качвам…' : 'Записвам…';
    try {
      let id = st.editPayment?.id;
      if (st.receipt) data.receipt = { kind: st.receipt.kind, thumb: st.receipt.thumb, size: st.receipt.size };
      else if (st.removeReceipt) data.receipt = null;
      if (id) await updateDoc(doc(db, 'payments', id), data);
      else {
        const user = getUser();
        const ref = await addDoc(collection(db, 'payments'), { ...data, receipt: data.receipt || null, familyId: st.familyId, created: Date.now(), by: user?.uid || null });
        id = ref.id;
      }
      if (st.receipt) await setDoc(doc(db, 'receipts', id), { familyId: st.familyId, kind: st.receipt.kind, data: st.receipt.data });
      else if (st.removeReceipt) await deleteDoc(doc(db, 'receipts', id)).catch(() => {});
      $('paymentDialog').close();
      toast({ text: `Плащането е записано${st.receipt ? ' с квитанция' : ''}`, sub: `${l.title} · ${money(data.amount)}` });
      st.receipt = null;
    } catch (err) {
      console.error(err);
      toast({ text: 'Плащането не е записано', sub: err?.code === 'permission-denied' ? 'Публикувай новите правила във Firebase.' : 'Провери връзката и опитай пак.', duration: 6000 });
    } finally {
      btn.disabled = false;
      btn.textContent = 'Запази';
    }
  }

  async function deletePayment() {
    const p = st.editPayment;
    if (!p) return;
    if (st.confirmDelete !== p.id) {
      st.confirmDelete = p.id;
      $('deletePaymentBtn').textContent = 'Потвърди';
      return;
    }
    $('paymentDialog').close();
    const b = writeBatch(db);
    b.delete(doc(db, 'payments', p.id));
    if (p.receipt) b.delete(doc(db, 'receipts', p.id));
    await b.commit().catch(() => toast({ text: 'Не успях да изтрия плащането' }));
  }

  /* ---------- Преглед на квитанция ---------- */

  let viewerUrl = null;
  async function openReceipt(paymentId) {
    const body = $('receiptBody');
    body.innerHTML = '<p class="muted">Зареждам квитанцията…</p>';
    $('receiptOpen').hidden = true;
    $('receiptDialog').showModal();
    try {
      const snap = await getDoc(doc(db, 'receipts', paymentId));
      if (!snap.exists()) { body.innerHTML = '<p class="muted">Квитанцията липсва.</p>'; return; }
      const { kind, data } = snap.data();
      if (viewerUrl) URL.revokeObjectURL(viewerUrl);
      const blob = await (await fetch(data)).blob();
      viewerUrl = URL.createObjectURL(blob);
      body.innerHTML = kind === 'pdf'
        ? `<p class="muted">PDF квитанция, ${kb(blob.size)}.</p>`
        : `<img class="receipt-full" src="${viewerUrl}" alt="Квитанция">`;
      const a = $('receiptOpen');
      a.href = viewerUrl;
      a.download = `kvitanciya-${paymentId}.${kind === 'pdf' ? 'pdf' : 'jpg'}`;
      a.textContent = kind === 'pdf' ? 'Отвори PDF' : 'Свали';
      a.hidden = false;
    } catch (err) {
      console.error(err);
      body.innerHTML = '<p class="muted">Не успях да заредя квитанцията. Провери връзката.</p>';
    }
  }

  /* ---------- Събития ---------- */

  function bind() {
    $('lessonTabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (b) { st.tab = b.dataset.tab; render(); }
    });
    $('kidChips').addEventListener('click', (e) => {
      if (e.target.closest('[data-kid-add]')) return openKid(null);
      const b = e.target.closest('[data-kid]');
      if (!b) return;
      const id = b.dataset.kid;
      if (id !== 'all' && st.kidFilter === id) return openKid(kidOf(id)); // второ натискане = промяна
      st.kidFilter = id;
      render();
    });
    $('lessonsView').addEventListener('click', (e) => {
      const l = e.target.closest('[data-lesson]');
      if (l) return openLesson(lessonOf(l.dataset.lesson));
      const pf = e.target.closest('[data-pay-for]');
      if (pf) return openPayment(null, pf.dataset.payFor);
      const p = e.target.closest('[data-payment]');
      if (p) return openPayment(st.payments.find((x) => x.id === p.dataset.payment));
    });
    $('addLessonBtn').onclick = () => openLesson(null);
    $('addPaymentBtn').onclick = () => openPayment(null);
    $('prevMonth').onclick = () => { st.month = shiftMonth(st.month, -1); render(); };
    $('nextMonth').onclick = () => { st.month = shiftMonth(st.month, 1); render(); };

    $('kidColors').addEventListener('click', (e) => {
      const b = e.target.closest('[data-color]');
      if (b) { st.kidColor = b.dataset.color; renderKidColors(); }
    });
    $('saveKidBtn').onclick = saveKid;
    $('kidName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveKid(); } });
    $('deleteKidBtn').onclick = deleteKid;

    $('lessonKids').addEventListener('click', (e) => {
      const b = e.target.closest('[data-kid]');
      if (b) { st.lessonDraft.kidId = b.dataset.kid; renderLessonSheet(); }
    });
    $('lessonDays').addEventListener('click', (e) => {
      const b = e.target.closest('[data-day]');
      if (!b) return;
      const d = +b.dataset.day;
      const days = st.lessonDraft.days;
      st.lessonDraft.days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
      renderLessonSheet();
    });
    $('saveLessonBtn').onclick = saveLesson;
    $('deleteLessonBtn').onclick = deleteLesson;
    $('lessonAddPay').onclick = () => openPayment(null, st.editLesson?.id);
    $('lessonPays').addEventListener('click', (e) => {
      const p = e.target.closest('[data-payment]');
      if (p) openPayment(st.payments.find((x) => x.id === p.dataset.payment));
    });

    $('payLesson').addEventListener('change', () => {
      const l = lessonOf($('payLesson').value);
      if (l?.price && !st.editPayment) $('payAmount').value = l.price;
      renderPaymentSheet();
    });
    $('receiptBox').addEventListener('click', (e) => {
      const a = e.target.closest('[data-r]')?.dataset.r;
      if (a === 'camera') $('receiptCamera').click();
      if (a === 'file' || a === 'replace') $('receiptFile').click();
      if (a === 'remove') { st.receipt = null; st.removeReceipt = Boolean(st.editPayment?.receipt); renderPaymentSheet(); }
      if (a === 'view') openReceipt(st.editPayment.id);
    });
    for (const id of ['receiptCamera', 'receiptFile']) {
      $(id).addEventListener('change', (e) => { onReceiptFile(e.target.files[0]); e.target.value = ''; });
    }
    $('savePaymentBtn').onclick = savePayment;
    $('deletePaymentBtn').onclick = deletePayment;
    $('receiptDialog').addEventListener('close', () => { if (viewerUrl) { URL.revokeObjectURL(viewerUrl); viewerUrl = null; } });
  }

  bind();
  return { start, stop, render, unpaidCount };
}
