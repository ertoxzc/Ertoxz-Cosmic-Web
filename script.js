// ==========================================
// 1. INISIALISASI SUPABASE CLIENT
// ==========================================
const SUPABASE_URL = 'URL_SUPABASE_KAMU'; // Ganti dengan URL Supabase Anda
const SUPABASE_KEY = 'ANON_KEY_SUPABASE_KAMU'; // Ganti dengan Anon Key Supabase Anda

let supabaseClient;
try {
    if (window.supabase && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("Supabase Client berhasil dibuat.");
    } else {
        console.error("Library Supabase CDN belum dimuat di file HTML.");
    }
} catch (error) {
    console.error("GAGAL: URL atau Key Supabase tidak valid.", error);
}

function showMessage(text, color) {
    const authMsg = document.getElementById('authMsg');
    if (authMsg) {
        authMsg.textContent = text;
        authMsg.style.color = color;
    } else {
        alert(text);
    }
}

// ==========================================
// 2. LOGIKA UI & SIDEBAR
// ==========================================
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const openBtn = document.getElementById('openBtn');
const closeBtn = document.getElementById('closeBtn');

if (openBtn) {
    openBtn.addEventListener('click', () => {
        if (sidebar) sidebar.classList.add('active');
        if (overlay) overlay.classList.add('active');
    });
}

const closeSidebar = () => {
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
};

if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
if (overlay) overlay.addEventListener('click', closeSidebar);

// ==========================================
// 3. AUTENTIKASI (LOGIN & REGISTER)
// ==========================================
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');
const emailInput = document.getElementById('emailInput');
const passInput = document.getElementById('passInput');

if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        if (!supabaseClient) return showMessage('Error: Masukkan URL Supabase asli di script.js!', '#ff5252');
        
        const email = emailInput?.value;
        const password = passInput?.value;

        if (!email || !password) {
            return showMessage('Email dan Password wajib diisi!', '#ff5252');
        }

        showMessage('Memproses login...', '#5dade2');
        
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            showMessage('Login berhasil! Mengalihkan...', '#2ecc71');
            setTimeout(() => window.location.href = 'dashboard.html', 800);
        } catch (error) {
            showMessage('Gagal Login: ' + error.message, '#ff5252');
        }
    });
}

if (btnRegister) {
    btnRegister.addEventListener('click', async () => {
        if (!supabaseClient) return showMessage('Error: Masukkan URL Supabase asli di script.js!', '#ff5252');
        
        const email = emailInput?.value;
        const password = passInput?.value;

        if (!email || !password) {
            return showMessage('Email dan Password wajib diisi!', '#ff5252');
        }

        showMessage('Mendaftarkan akun...', '#5dade2');
        
        try {
            const { data, error } = await supabaseClient.auth.signUp({ email, password });
            if (error) throw error;
            
            showMessage('Pendaftaran berhasil! Silakan klik Login.', '#2ecc71');
        } catch (error) {
            showMessage('Gagal Daftar: ' + error.message, '#ff5252');
        }
    });
}

// ==========================================
// 4. PROTEKSI HALAMAN & LOGOUT GLOBAL
// ==========================================
async function checkAuthSession() {
    if (!supabaseClient) return null;
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    const currentPage = window.location.pathname.split('/').pop();

    if (!session && currentPage !== 'index.html' && currentPage !== '') {
        window.location.href = 'index.html';
    } else if (session && (currentPage === 'index.html' || currentPage === '')) {
        window.location.href = 'dashboard.html';
    }

    return session;
}

window.logoutApp = async function() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    window.location.href = 'index.html';
};

// ==========================================
// 5. RENDER DATA DASHBOARD (TANPA SLUG & STATUS TER-UPDATE)
// ==========================================
async function loadDashboardData(session) {
    const licenseContainer = document.getElementById('licenseContainer');
    if (!licenseContainer) return;

    if (!supabaseClient) {
        licenseContainer.innerHTML = '<p style="color: #ff5252; text-align: center;">Konfigurasi Supabase bermasalah.</p>';
        return;
    }

    const user = session.user;
    const userNameEl = document.querySelector('.user-name');
    const hwidEl = document.querySelector('.hwid-text');
    const userTierBadge = document.getElementById('userTierBadge');

    try {
        // Ambil data profile user (username & hwid)
        const { data: profileData } = await supabaseClient
            .from('profiles')
            .select('username, hwid')
            .eq('id', user.id)
            .single();

        if (profileData) {
            if (userNameEl) userNameEl.textContent = profileData.username || user.email.split('@')[0];
            if (hwidEl) hwidEl.textContent = profileData.hwid || 'Belum Terikat';
        } else if (userNameEl) {
            userNameEl.textContent = user.email.split('@')[0];
        }

        // Ambil semua script yang enabled dari tabel 'scripts'
        const { data: allScripts, error: scriptErr } = await supabaseClient
            .from('scripts')
            .select('*')
            .eq('enabled', true);

        if (scriptErr) throw scriptErr;

        // Ambil lisensi aktif milik user dari tabel 'licence_keys'
        const { data: userLicenses, error: licenseErr } = await supabaseClient
            .from('licence_keys')
            .select('script_id')
            .eq('user_id', user.id)
            .eq('revoked', false);

        if (licenseErr) throw licenseErr;

        licenseContainer.innerHTML = '';
        const ownedScriptIds = userLicenses ? userLicenses.map(lic => lic.script_id) : [];
        let renderedCount = 0;

        // Tentukan status badge user (VIP jika memiliki minimal 1 script VIP berlisensi)
        const hasVip = (allScripts || []).some(s => !s.is_free && ownedScriptIds.includes(s.id));
        if (userTierBadge) {
            userTierBadge.textContent = hasVip ? 'VIP' : 'FREE';
            userTierBadge.className = hasVip ? 'badge badge-vip' : 'badge badge-free';
        }

        (allScripts || []).forEach(scriptData => {
            const isFree = scriptData.is_free === true;
            const isOwned = ownedScriptIds.includes(scriptData.id);

            // Render hanya jika script gratis atau user punya lisensinya
            if (isFree || isOwned) {
                renderedCount++;
                const badgeClass = isFree ? 'badge-free' : 'badge-vip';
                const tierText = isFree ? 'FREE' : 'VIP';
                const statusText = isOwned ? 'LICENSED' : 'ACTIVE';
                
                // Slug disembunyikan dari tampilan web
                const scriptCard = `
                    <div class="license-card">
                        <div class="license-details">
                            <h3>${scriptData.name}</h3>
                            <span class="sub-text">${scriptData.description || 'Script Cosmic Engine'} | v${scriptData.version || '1.0'}</span>
                        </div>
                        <div class="license-tags">
                            <span class="badge ${badgeClass}">${tierText}</span>
                            <span class="badge badge-licensed">${statusText}</span>
                        </div>
                    </div>
                `;
                licenseContainer.innerHTML += scriptCard;
            }
        });

        if (renderedCount === 0) {
            licenseContainer.innerHTML = '<p style="color: #a9c2d4; text-align: center; padding: 20px;">Kamu belum memiliki script apapun.</p>';
        }
    } catch (error) {
        licenseContainer.innerHTML = '<p style="color: #ff5252; text-align: center;">Gagal memuat data dari database.</p>';
        console.error("Dashboard Load Error:", error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await checkAuthSession();
    if (session) {
        loadDashboardData(session);
    }
});
