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
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
document.getElementById('logoutBtn').onclick = async () => {
  await signOut(auth);
  location.reload();
};
const email = document.getElementById('email');
const password = document.getElementById('password');
document.getElementById('loginBtn').onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      alert('Няма такъв потребител');
    } else if (err.code === 'auth/wrong-password') {
      alert('Грешна парола');
    } else {
      alert('Грешка при вход');
    }
  }
};
document.getElementById('registerBtn').onclick = async () => {
  try {
    await createUserWithEmailAndPassword(auth, email.value, password.value);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      alert('Този email вече е регистриран');
    } else {
      alert('Грешка при регистрация');
    }
  }
};
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('todo-section').style.display = 'block';
    loadTodos();
  }
});
document.getElementById('addTodoBtn').onclick = async () => {
  const text = document.getElementById('newTodo').value.trim();
  if (!text) return;
  await addDoc(collection(db, 'todos'), {
    text,
    createdBy: auth.currentUser.uid,
    createdByEmail: auth.currentUser.email,
    created: Date.now(),
    done: false,
  });
  document.getElementById('newTodo').value = '';
};
function loadTodos() {
  const user = auth.currentUser; // <-- използва auth от firebase.js
  if (!user) {
    console.log('Няма логнат потребител');
    return;
  }
  const list = document.getElementById('todo-list');
  const q = query(
    collection(db, 'todos'),
    where('createdBy', '==', user.uid),
    orderBy('created', 'desc')
  );
  onSnapshot(q, (snapshot) => {
    list.innerHTML = '';
    let counter = 1;
    snapshot.forEach((docSnap) => {
      const todo = docSnap.data();
      const card = document.createElement('div');
      card.className = 'card';
      if (!todo.done) {
        card.classList.add('todo-undone');
      } else {
        card.classList.add('todo-done');
      }
      card.innerHTML = ` <div style="display:flex; flex-direction:column; gap:5px;"> <div style="display:flex; align-items:center; gap:10px; justify-content:space-between;"> <div style="display:flex; align-items:center; gap:10px; flex:1;"> <span style="font-weight:bold; width:25px;">${counter}.</span> <input type="checkbox" ${
        todo.done ? 'checked' : ''
      } onchange="toggleDone('${
        docSnap.id
      }', this.checked)"> <span style="text-decoration:${
        todo.done ? 'line-through' : 'none'
      }; flex:1;"> ${
        todo.text
      } </span> </div> <button class="editBtn" onclick="editTodo('${
        docSnap.id
      }', '${todo.text.replace(
        /'/g,
        "\\'"
      )}')">✎</button> <button class="deleteBtn" onclick="deleteTodo('${
        docSnap.id
      }')">✖</button> </div> <span style="font-size:12px; color:#666;">Създадено от: ${
        todo.createdByEmail
      }</span> </div> `;
      list.appendChild(card);
      counter++;
    });
  });
}
window.toggleDone = async (id, value) => {
  await updateDoc(doc(db, 'todos', id), { done: value });
};
window.deleteTodo = async (id) => {
  if (!confirm('Сигурен ли си, че искаш да изтриеш задачата?')) return;
  await deleteDoc(doc(db, 'todos', id));
};

window.editTodo = async (id, oldText) => {
  const newText = prompt('Редактирай задачата:', oldText);
  if (!newText || newText.trim() === '') return;
  await updateDoc(doc(db, 'todos', id), { text: newText.trim() });
};

document.getElementById('notifyBtn').onclick = async () => {
  try {
    const token = await getToken(messaging, {
      vapidKey:
        'BO4LLlmZj9NT6Ze89zXDPZVZmemDMGczIX4qUyHpIFKS8HzNzkr0LwKjIUGiQJTgD9LbC32P22BMYfbs3ebau0w',
    });
    if (!token) {
      alert('Потребителят отказа известия');
      return;
    }
    console.log('FCM Token:', token);
    alert('Известията са разрешени');
  } catch (err) {
    console.error('Грешка при разрешаване на известия:', err);
    alert('Не успях да разреша известия');
  }
};
