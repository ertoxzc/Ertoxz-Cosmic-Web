// ==========================================
// 0. BLOKIR KLIK KANAN DAN SHORTCUT
// ==========================================
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
    (e.ctrlKey && e.key.toUpperCase() === 'U')
  ) e.preventDefault();
});

// ==========================================
// 1. HELPERS
// ==========================================
function showMessage(text, color = '#ff5252') {
  const authMsg = document.getElementById('authMsg');
  if (authMsg) {
    authMsg.textContent = text;
    authMsg.style.color = color;
  } else {
    alert(text);
  }
}

async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ==========================================
// 2. CLOUDFLARE TURNSTILE
// ==========================================
let turnstileToken = '';
let turnstileWidgetId = null;
let turnstileInitStarted = false;

function initTurnstile() {
  const widget = document.getElementById('turnstile-widget');
  if (!widget || turnstileWidgetId !== null || turnstileInitStarted) return;
  if (!window.turnstile) { setTimeout(initTurnstile, 300); return; }

  turnstileInitStarted = true;
  try {
    turnstileWidgetId = window.turnstile.render(widget, {
      sitekey: '0x4AAAAAAFnAJIwM99RNb_C_',
      callback: token => { turnstileToken = token; },
      'expired-callback': () => { turnstileToken = ''; },
      'error-callback': code => {
        turnstileToken = '';
        console.error('Turnstile error:', code);
        showMessage('CAPTCHA bermasalah. Muat ulang halaman.', '#ff5252');
      }
    });
  } catch (err) {
    turnstileInitStarted = false;
    console.error('Gagal merender Turnstile:', err);
  }
}

function resetTurnstile() {
  turnstileToken = '';
  if (window.turnstile && turnstileWidgetId !== null) {
    try { window.turnstile.reset(turnstileWidgetId); } catch (_) {}
  }
}

function waitForTurnstileToken(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (turnstileToken) return resolve(turnstileToken);
    const start = Date.now();
    const timer = setInterval(() => {
      if (turnstileToken) { clearInterval(timer); resolve(turnstileToken); }
      else if (Date.now() - start >= timeout) {
        clearInterval(timer);
        reject(new Error('Selesaikan CAPTCHA terlebih dahulu.'));
      }
    }, 200);
  });
}

window.addEventListener('load', initTurnstile);

// ==========================================
// 3. SIDEBAR
// ==========================================
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const openBtn = document.getElementById('openBtn');
const closeBtn = document.getElementById('closeBtn');

if (openBtn) openBtn.addEventListener('click', () => {
  sidebar?.classList.add('active');
  overlay?.classList.add('active');
});

function closeSidebar() {
  sidebar?.classList.remove('active');
  overlay?.classList.remove('active');
}
if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
if (overlay) overlay.addEventListener('click', closeSidebar);

// ==========================================
// 4. LOGIN
// ==========================================
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');
const emailInput = document.getElementById('emailInput');
const passInput = document.getElementById('passInput');

if (btnLogin) {
  btnLogin.addEventListener('click', async () => {
    const email = emailInput?.value.trim();
    const password = passInput?.value;
    if (!email || !password) return showMessage('Email dan password wajib diisi!');

    btnLogin.disabled = true;
    showMessage('Memeriksa CAPTCHA...', '#5dade2');

    let token;
    try { token = await waitForTurnstileToken(); }
    catch (err) { showMessage(err.message); btnLogin.disabled = false; return; }

    showMessage('Memproses login...', '#5dade2');

    try {
      const { response, data } = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, captchaToken: token })
      });

      if (!response.ok) throw new Error(data.error || 'Login gagal');

      showMessage('Login berhasil! Mengalihkan...', '#2ecc71');
      setTimeout(() => { window.location.href = '/dashboard.html'; }, 800);
    } catch (err) {
      console.error('Login gagal:', err);
      showMessage('Gagal Login: ' + err.message);
      resetTurnstile();
    } finally {
      btnLogin.disabled = false;
    }
  });
}

// ==========================================
// 5. REGISTER
// ==========================================
if (btnRegister) {
  btnRegister.addEventListener('click', async () => {
    const email = emailInput?.value.trim();
    const password = passInput?.value;
    if (!email || !password) return showMessage('Email dan password wajib diisi!');

    btnRegister.disabled = true;
    showMessage('Memeriksa CAPTCHA...', '#5dade2');

    let token;
    try { token = await waitForTurnstileToken(); }
    catch (err) { showMessage(err.message); btnRegister.disabled = false; return; }

    showMessage('Memproses pendaftaran...', '#5dade2');

    try {
      const { response, data } = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, captchaToken: token })
      });

      if (!response.ok) throw new Error(data.error || 'Pendaftaran gagal');
      showMessage('Pendaftaran berhasil! Silakan cek email untuk verifikasi.', '#2ecc71');
    } catch (err) {
      console.error('Pendaftaran gagal:', err);
      showMessage('Gagal daftar: ' + err.message);
    } finally {
      resetTurnstile();
      btnRegister.disabled = false;
    }
  });
}

// ==========================================
// 6. SESSION CHECK (FIX ROUTING VERCEL)
// ==========================================
async function checkAuthSession() {
  const path = window.location.pathname;
  const isIndexPage = path === '/' || path.includes('index.html');

  const { response } = await apiFetch('/api/auth/session');
  const session = response.ok ? true : null;

  if (!session && !isIndexPage) {
    window.location.href = '/index.html';
    return null;
  }
  if (session && isIndexPage) {
    window.location.href = '/dashboard.html';
    return null;
  }
  return session;
}

// ==========================================
// 7. LOGOUT
// ==========================================
window.logoutApp = async function () {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); }
  catch (err) { console.error('Logout gagal:', err); }
  window.location.href = '/index.html';
};

// ==========================================
// 8. DASHBOARD DATA
// ==========================================
async function loadDashboardData() {
  const licenseContainer = document.getElementById('licenseContainer');
  if (!licenseContainer) return;

  licenseContainer.innerHTML = '<p style="color:#5dade2;text-align:center;padding:20px;">Memuat data script...</p>';

  try {
    const { response, data } = await apiFetch('/api/dashboard');
    if (!response.ok) throw new Error(data.error || 'Gagal memuat dashboard');

    const { profile, scripts } = data;

    const userNameEl = document.querySelector('.user-name');
    const hwidEl = document.querySelector('.hwid-text');
    const userTierBadge = document.getElementById('userTierBadge');

    if (userNameEl) userNameEl.textContent = profile.username;
    if (hwidEl) hwidEl.textContent = profile.hwid || 'Belum Terikat';
    if (userTierBadge) {
      userTierBadge.textContent = profile.role.toUpperCase();
      let badgeClass = 'badge-free';
      const r = profile.role.toLowerCase();
      if (r === 'vip' || r === 'member') badgeClass = 'badge-vip';
      else if (r === 'dev') badgeClass = 'badge-licensed';
      userTierBadge.className = `badge ${badgeClass}`;
    }

    licenseContainer.innerHTML = '';
    if (!scripts || scripts.length === 0) {
      licenseContainer.innerHTML = '<p style="color:#a9c2d4;text-align:center;padding:20px;">Kamu belum memiliki akses script apa pun.</p>';
      return;
    }

    scripts.forEach(s => {
      const isFree = s.is_free === true;
      const badgeClass = isFree ? 'badge-free' : 'badge-vip';
      const tierText = isFree ? 'FREE' : 'VIP';
      const statusText = s.owned ? 'LICENSED' : 'ACTIVE';

      const card = document.createElement('div');
      card.className = 'license-card';
      card.innerHTML = `
        <div class="license-details">
          <h3>${escapeHtml(s.name || 'Script Tidak Bernama')}</h3>
          <span class="sub-text">${escapeHtml(s.description || 'Script Cosmic Engine')} | v${escapeHtml(s.version || '1.0')}</span>
        </div>
        <div class="license-tags">
          <span class="badge ${badgeClass}">${tierText}</span>
          <span class="badge badge-licensed">${statusText}</span>
        </div>`;
      licenseContainer.appendChild(card);
    });
  } catch (err) {
    console.error('Gagal memuat dashboard:', err);
    licenseContainer.innerHTML = `<p style="color:#ff5252;text-align:center;padding:20px;">Error: ${err.message}</p>`;
  }
}

// ==========================================
// 9. ADMIN DATA
// ==========================================
async function loadAdminData() {
  const adminUserContainer = document.getElementById('adminUserContainer');
  if (!adminUserContainer) return;

  try {
    const { response, data } = await apiFetch('/api/admin/users');

    if (response.status === 403) {
      document.body.innerHTML = `
        <h1 style="color:#ff5252;text-align:center;margin-top:100px;">
          403 FORBIDDEN: AKSES KHUSUS DEVELOPER
        </h1>`;
      setTimeout(() => { window.location.href = '/dashboard.html'; }, 1500);
      return;
    }

    if (!response.ok) throw new Error(data.error || 'Gagal memuat data admin');

    const totalUsers = document.getElementById('statTotalUsers');
    const totalLicenses = document.getElementById('statTotalLicenses');
    if (totalUsers) totalUsers.textContent = data.totalUsers;
    if (totalLicenses) totalLicenses.textContent = data.totalLicenses;

    adminUserContainer.innerHTML = '';
    if (!data.users || data.users.length === 0) {
      adminUserContainer.innerHTML = '<p style="color:#a9c2d4;text-align:center;padding:20px;">Belum ada pengguna.</p>';
      return;
    }

    data.users.forEach(user => {
      const roleColor = user.role === 'dev' ? '#ff5252' : '#5dade2';
      const card = document.createElement('div');
      card.className = 'license-card';
      card.innerHTML = `
        <div class="license-details">
          <h3>${escapeHtml(user.username || 'Tanpa Username')}</h3>
          <span class="sub-text">
            HWID: ${escapeHtml(user.hwid || 'Belum Terikat')} | Role: 
            <b style="color:${roleColor}">${escapeHtml((user.role || 'free').toUpperCase())}</b>
          </span>
        </div>
        <div class="license-tags">
          <span class="badge badge-active">ID: ${escapeHtml((user.id || '').substring(0, 8))}...</span>
        </div>`;
      adminUserContainer.appendChild(card);
    });
  } catch (err) {
    console.error('Gagal memuat data admin:', err);
    adminUserContainer.innerHTML = '<p style="color:#ff5252;text-align:center;">Gagal memuat data admin.</p>';
  }
}

// ==========================================
// 10. INIT (FIX ROUTING VERCEL)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  const session = await checkAuthSession();
  if (!session) return;

  const path = window.location.pathname;
  if (path.includes('admin')) await loadAdminData();
  else if (path.includes('dashboard')) await loadDashboardData();
});
