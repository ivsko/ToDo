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
  setDoc
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';


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
    await createUserWithEmailAndPassword(auth, email.value, password.value);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') alert('Този email вече е регистриран');
    else alert('Грешка при регистрация');
  }
};


// AUTH STATE
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('todo-section').style.display = 'block';

    document.getElementById('user-info').innerText = `Логнат като: ${user.email}`;

    loadTodos();
  }
});
document.getElementById('filterCategory').onchange = loadTodos;


// ADD TODO
document.getElementById('addTodoBtn').onclick = async () => {
  const text = document.getElementById('newTodo').value.trim();
  const category = document.getElementById('category').value;

  if (!text) return;

  await addDoc(collection(db, 'todos'), {
    text,
    category,
    createdBy: auth.currentUser.uid,
    createdByEmail: auth.currentUser.email,
    created: Date.now(),
    done: false,
  });

  document.getElementById('newTodo').value = '';
};


// LOAD TODOS (with filter)
function loadTodos() {
  const list = document.getElementById('todo-list');
  const filter = document.getElementById('filterCategory').value;

  let q;

  if (filter === 'all') {
    q = query(collection(db, 'todos'), orderBy('created', 'desc'));
  } else {
    q = query(
      collection(db, 'todos'),
      where('category', '==', filter),
      orderBy('created', 'desc')
    );
  }

  onSnapshot(q, (snapshot) => {
    list.innerHTML = '';
    let counter = 1;

    snapshot.forEach((docSnap) => {
      const todo = docSnap.data();

      const card = document.createElement('div');
      card.className = 'card';
      card.classList.add(todo.done ? 'todo-done' : 'todo-undone');

      card.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:5px;">
          <div style="display:flex; align-items:center; gap:10px; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:10px; flex:1;">
              <span style="font-weight:bold; width:25px;">${counter}.</span>
              <input type="checkbox" ${todo.done ? 'checked' : ''} onchange="toggleDone('${docSnap.id}', this.checked)">
              <span style="text-decoration:${todo.done ? 'line-through' : 'none'}; flex:1;">
                ${todo.text}
              </span>
            </div>

            <button class="editBtn" onclick="editTodo('${docSnap.id}', '${todo.text.replace(/'/g, "\\'")}')">✎</button>
            <button class="deleteBtn" onclick="deleteTodo('${docSnap.id}')">✖</button>
          </div>

          <span style="font-size:12px; color:#444;">Категория: ${todo.category}</span>
          <span style="font-size:12px; color:#666;">Създадено от: ${todo.createdByEmail}</span>
        </div>
      `;

      list.appendChild(card);
      counter++;
    });
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


// NOTIFICATIONS
document.getElementById('notifyBtn').onclick = async () => {
  try {
    const token = await getToken(messaging, {
      vapidKey: 'BO4LLlmZj9NT6Ze89zXDPZVZmemDMGczIX4qUyHpIFKS8HzNzkr0LwKjIUGiQJTgD9LbC32P22BMYfbs3ebau0w',
    });

    if (!token) {
      alert('Потребителят отказа известия');
      return;
    }

    await setDoc(doc(db, "fcmTokens", auth.currentUser.uid), {
      token,
      email: auth.currentUser.email
    });

    alert('Известията са разрешени');
  } catch (err) {
    console.error(err);
  }
};
