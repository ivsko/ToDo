import { auth, db, messaging } from './firebase.js';
import { getToken } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging.js';

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
  getDoc
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

let currentFamilyId = null;

/* ---------------- LOGIN ---------------- */
document.getElementById('loginBtn').onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
  } catch (err) {
    alert('Грешка при вход');
  }
};

/* ---------------- REGISTER ---------------- */
document.getElementById('registerBtn').onclick = async () => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.value, password.value);

    await setDoc(doc(db, 'users', cred.user.uid), {
      email: cred.user.email,
      familyId: null,
      created: Date.now()
    });

  } catch (err) {
    alert('Грешка при регистрация');
  }
};

/* ---------------- LOGOUT ---------------- */
document.getElementById('logoutBtn').onclick = async () => {
  await signOut(auth);
  location.reload();
};

/* ---------------- AUTH STATE ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('todo-section').style.display = 'block';
  document.getElementById('user-info').innerText = `Логнат като: ${user.email}`;

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    currentFamilyId = userSnap.data().familyId || null;
  }

  updateFamilyUI();

  if (currentFamilyId) loadTodos();
});

/* ---------------- FAMILY UI ---------------- */
function updateFamilyUI() {
  const notJoined = document.getElementById("familyNotJoined");
  const joined = document.getElementById("familyJoined");
  const codeBox = document.getElementById("familyCode");

  if (!currentFamilyId) {
    notJoined.style.display = "block";
    joined.style.display = "none";
  } else {
    notJoined.style.display = "none";
    joined.style.display = "block";
    codeBox.innerText = currentFamilyId;
  }
}

/* ---------------- CREATE FAMILY ---------------- */
document.getElementById('createFamilyBtn').onclick = async () => {
  const familyId = 'FAM-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  await setDoc(doc(db, 'families', familyId), {
    createdBy: auth.currentUser.uid,
    created: Date.now()
  });

  await updateDoc(doc(db, 'users', auth.currentUser.uid), {
    familyId
  });

  currentFamilyId = familyId;
  updateFamilyUI();
  loadTodos();

  alert("Семейството е създадено!");
};

/* ---------------- JOIN FAMILY ---------------- */
document.getElementById('joinFamilyBtn').onclick = async () => {
  const code = document.getElementById('joinFamilyInput').value.trim();
  if (!code) return alert("Въведи код");

  const famSnap = await getDoc(doc(db, 'families', code));
  if (!famSnap.exists()) return alert("Невалиден код");

  await updateDoc(doc(db, 'users', auth.currentUser.uid), {
    familyId: code
  });

  currentFamilyId = code;
  updateFamilyUI();
  loadTodos();

  alert("Присъедини се успешно!");
};

/* ---------------- ADD TODO ---------------- */
document.getElementById('addTodoBtn').onclick = async () => {
  const text = document.getElementById('newTodo').value.trim();
  const category = document.getElementById('category').value;

  if (!text) return;
  if (!currentFamilyId) return alert("Първо се присъедини към семейство");

  await addDoc(collection(db, 'todos'), {
    text,
    category,
    familyId: currentFamilyId,
    createdBy: auth.currentUser.uid,
    createdByEmail: auth.currentUser.email,
    created: Date.now(),
    done: false,
  });

  document.getElementById('newTodo').value = '';
};

/* ---------------- LOAD TODOS ---------------- */
function loadTodos() {
  if (!currentFamilyId) return;

  const list = document.getElementById('todo-list');
  const filter = document.getElementById('filterCategory').value;

  let q;

  if (filter === 'all') {
    q = query(
      collection(db, 'todos'),
      where('familyId', '==', currentFamilyId),
      orderBy('created', 'desc')
    );
  } else {
    q = query(
      collection(db, 'todos'),
      where('familyId', '==', currentFamilyId),
      where('category', '==', filter),
      orderBy('created', 'desc')
    );
  }

  onSnapshot(q, (snapshot) => {
    list.innerHTML = '';
    let counter = 1;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const card = document.createElement('div');
      card.className = 'card';
      card.classList.add(data.done ? 'todo-done' : 'todo-undone');

      card.innerHTML = `
        <div class="todo-row">
          <div class="todo-left">
            <span class="todo-index">${counter}.</span>
            <input type="checkbox" ${data.done ? 'checked' : ''} onchange="toggleDone('${docSnap.id}', this.checked)">
            <span class="todo-text">${data.text}</span>
          </div>
          <div class="todo-right">
            <button class="editBtn" onclick="editTodo('${docSnap.id}', '${data.text.replace(/'/g, "\\'")}')">✎</button>
            <button class="deleteBtn" onclick="deleteTodo('${docSnap.id}')">✖</button>
          </div>
        </div>
        <div class="todo-meta">
          Категория: ${data.category}<br>
          Създадено от: ${data.createdByEmail}
        </div>
      `;

      list.appendChild(card);
      counter++;
    });

    if (counter === 1) {
      list.innerHTML = '<div class="card">Няма задачи.</div>';
    }
  });
}

/* ---------------- TOGGLE DONE ---------------- */
window.toggleDone = async (id, value) => {
  await updateDoc(doc(db, 'todos', id), { done: value });
};

/* ---------------- DELETE TODO ---------------- */
window.deleteTodo = async (id) => {
  if (!confirm("Сигурен ли си?")) return;
  await deleteDoc(doc(db, 'todos', id));
};

/* ---------------- EDIT TODO ---------------- */
window.editTodo = async (id, oldText) => {
  const newText = prompt("Редактирай:", oldText);
  if (!newText) return;
  await updateDoc(doc(db, 'todos', id), { text: newText });
};
