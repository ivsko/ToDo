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

// LOGOUT
document.getElementById('logoutBtn').onclick = async () => {
  await signOut(auth);
  location.reload();
};

// LOGIN
const email = document.getElementById('email');
const password = document.getElementById('password');

document.getElementById('loginBtn').onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
  } catch (err) {
    if (err.code === 'auth/user-not-found') alert('Няма такъв потребител');
    else if (err.code === 'auth/wrong-password') alert('Грешна парола');
    else alert('Грешка при вход');
  }
};

// REGISTER
document.getElementById('registerBtn').onclick = async () => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.value, password.value);

    // създаваме user документ без familyId (ще го добавим по-късно)
    await setDoc(doc(db, 'users', cred.user.uid), {
      email: cred.user.email,
      familyId: null,
      created: Date.now()
    });
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') alert('Този email вече е регистриран');
    else alert('Грешка при регистрация');
  }
};

// AUTH STATE
onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('todo-section').style.display = 'block';

    document.getElementById('user-info').innerText = `Логнат като: ${user.email}`;

    // зареждаме familyId от users/{uid}
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      currentFamilyId = userSnap.data().familyId || null;
    } else {
      // ако няма документ, създаваме
      await setDoc(userRef, {
        email: user.email,
        familyId: null,
        created: Date.now()
      });
      currentFamilyId = null;
    }

    // ако има familyId – зареждаме задачите
    if (currentFamilyId) {
      loadTodos();
    } else {
      // няма семейство – показваме само UI за създаване/присъединяване
      document.getElementById('todo-list').innerHTML =
        '<div class="card">Нямаш избрано семейство. Създай или се присъедини към семейство.</div>';
    }
  }
});

document.getElementById('filterCategory').onchange = () => {
  if (currentFamilyId) loadTodos();
};

// CREATE FAMILY
document.getElementById('createFamilyBtn').onclick = async () => {
  if (!auth.currentUser) return;

  // генерираме код
  const familyId = 'FAM-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  // записваме в families
  await setDoc(doc(db, 'families', familyId), {
    createdBy: auth.currentUser.uid,
    created: Date.now()
  });

  // записваме в user профила
  await updateDoc(doc(db, 'users', auth.currentUser.uid), {
    familyId
  });

  currentFamilyId = familyId;

  // показваме кода само на теб
  document.getElementById('familyCodeBox').style.display = 'block';
  document.getElementById('familyCode').innerText = familyId;

  alert('Семейството е създадено!');
  loadTodos();
};

// JOIN FAMILY
document.getElementById('joinFamilyBtn').onclick = async () => {
  if (!auth.currentUser) return;

  const codeInput = document.getElementById('joinFamilyInput');
  const code = codeInput.value.trim();

  if (!code) {
    alert('Въведи код');
    return;
  }

  const famRef = doc(db, 'families', code);
  const famSnap = await getDoc(famRef);

  if (!famSnap.exists()) {
    alert('Невалиден код');
    return;
  }

  await updateDoc(doc(db, 'users', auth.currentUser.uid), {
    familyId: code
  });

  currentFamilyId = code;
  alert('Присъедини се успешно!');
  loadTodos();
};

// ADD TODO
document.getElementById('addTodoBtn').onclick = async () => {
  const text = document.getElementById('newTodo').value.trim();
  const category = document.getElementById('category').value;

  if (!text) return;
  if (!currentFamilyId) {
    alert('Първо създай или се присъедини към семейство.');
    return;
  }

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

// LOAD TODOS (with filter + family)
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

      const todo = {
        ...data,
        category: data.category || 'Ремонт'
      };

      const card = document.createElement('div');
      card.className = 'card';
      card.classList.add(todo.done ? 'todo-done' : 'todo-undone');

      card.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:5px;">
          <div class="todo-row">
            <div class="todo-left">
              <span class="todo-index">${counter}.</span>
              <input type="checkbox" ${todo.done ? 'checked' : ''} onchange="toggleDone('${docSnap.id}', this.checked)">
              <span class="todo-text" style="text-decoration:${todo.done ? 'line-through' : 'none'};">
                ${todo.text}
              </span>
            </div>
            <div class="todo-right">
              <button class="editBtn" onclick="editTodo('${docSnap.id}', '${todo.text.replace(/'/g, "\\'")}')">✎</button>
              <button class="deleteBtn" onclick="deleteTodo('${docSnap.id}')">✖</button>
            </div>
          </div>
          <div class="todo-meta">
            Категория: ${todo.category}<br>
            Създадено от: ${todo.createdByEmail}
          </div>
        </div>
      `;

      list.appendChild(card);
      counter++;
    });

    if (counter === 1) {
      list.innerHTML = '<div class="card">Няма задачи за това семейство.</div>';
    }
  });
}

// TOGGLE DONE
window.toggleDone = async (id, value) => {
  await updateDoc(doc(db, 'todos', id), { done: value });
};

// DELETE TODO
window.deleteTodo = async (id) => {
  if (!confirm('Сигурен ли си, че искаш да изтриеш задачата?')) return;
  await deleteDoc(doc(db, 'todos', id));
};

// EDIT TODO
window.editTodo = async (id, oldText) => {
  const newText = prompt('Редактирай задачата:', oldText);
  if (!newText || newText.trim() === '') return;
  await updateDoc(doc(db, 'todos', id), { text: newText.trim() });
};

// NOTIFICATIONS (ако държиш бутона notifyBtn)
const notifyBtn = document.getElementById('notifyBtn');
if (notifyBtn) {
  notifyBtn.onclick = async () => {
    try {
      const token = await getToken(messaging, {
        vapidKey: 'BO4LLlmZj9NT6Ze89zXDPZVZmemDMGczIX4qUyHpIFKS8HzNzkr0LwKjIUGiQJTgD9LbC32P22BMYfbs3ebau0w',
      });

      if (!token) {
        alert('Потребителят отказа известия');
        return;
      }

      await setDoc(doc(db, 'fcmTokens', auth.currentUser.uid), {
        token,
        email: auth.currentUser.email
      });

      alert('Известията са разрешени');
    } catch (err) {
      console.error(err);
    }
  };
}
