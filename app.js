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

const email = document.getElementById('email');
const password = document.getElementById('password');

loginBtn.onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
  } catch {
    await createUserWithEmailAndPassword(auth, email.value, password.value);
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
    user: auth.currentUser.email,
    created: Date.now(),
    done: false,
  });

  document.getElementById('newTodo').value = '';
};

function loadTodos() {
  const list = document.getElementById('todo-list');
  const q = query(collection(db, 'todos'), orderBy('created', 'desc'));

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

      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-weight:bold; width:25px;">${counter}.</span>
            <input type="checkbox" ${todo.done ? 'checked' : ''} onchange="toggleDone('${docSnap.id}', this.checked)">
            <span style="text-decoration:${todo.done ? 'line-through' : 'none'};">${todo.text}</span>
          </div>
          <button class="deleteBtn" onclick="deleteTodo('${docSnap.id}')">✖</button>
        </div>
      `;

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
