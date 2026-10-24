const USERS_KEY = 'local-llm-users';
const SESSION_KEY = 'local-llm-session';
const historyKey = (user) => `local-llm-history:${user}`;
const settingsKey = (user) => `local-llm-settings:${user}`;

const DEFAULT_ADMIN = { username: 'admin', password: 'admin', createdAt: Date.now(), role: 'admin' };

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function readUsers() {
  const users = readJson(USERS_KEY, {});
  return users && typeof users === 'object' && !Array.isArray(users) ? users : {};
}

export function ensureDefaultAdmin() {
  const users = readUsers();
  if (!users.admin || users.admin.password !== 'admin') {
    users.admin = { ...DEFAULT_ADMIN };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  return users;
}

export function saveUser(username, password, role = 'user') {
  const users = ensureDefaultAdmin();
  users[username] = { username, password, createdAt: Date.now(), role };
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function verifyUser(username, password) {
  const users = ensureDefaultAdmin();
  return Boolean(users[username] && users[username].password === password);
}

export function getSession() {
  const session = localStorage.getItem(SESSION_KEY);
  return session && session.trim() ? session : null;
}

export function setSession(username) {
  if (username) localStorage.setItem(SESSION_KEY, username);
  else localStorage.removeItem(SESSION_KEY);
}

export function loadHistory(user) {
  const value = readJson(historyKey(user), []);
  if (!Array.isArray(value)) return [];
  return value.filter(c => c && typeof c === 'object' && typeof c.id === 'string').map(c => ({
    id: c.id,
    title: typeof c.title === 'string' ? c.title : 'New chat',
    messages: Array.isArray(c.messages) ? c.messages.filter(m => m && typeof m === 'object').map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: typeof m.content === 'string' ? m.content : ''
    })) : [],
    createdAt: Number(c.createdAt) || Date.now(),
    updatedAt: Number(c.updatedAt) || Date.now()
  }));
}

export function saveHistory(user, chats) {
  if (!Array.isArray(chats)) return;
  localStorage.setItem(historyKey(user), JSON.stringify(chats));
}

export function loadSettings(user, defaults) {
  const value = readJson(settingsKey(user), {});
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...defaults, ...value } : { ...defaults };
}

export function saveSettings(user, settings) {
  localStorage.setItem(settingsKey(user), JSON.stringify(settings));
}
