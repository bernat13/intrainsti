import { SupabaseService } from './SupabaseService.js';
import { UIHelpers } from './UIHelpers.js';

// Initialize Services
const supabaseService = new SupabaseService();
let currentUser = null;

// DOM Elements
const loginContainer = document.getElementById('main-container');
const loginPrompt = document.getElementById('login-prompt');
const instituteSelection = document.getElementById('institute-selection');
const instituteRegistration = document.getElementById('institute-registration');
const instituteList = document.getElementById('institute-list');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');
const authBtn = document.getElementById('auth-btn');
const authBtnMain = document.getElementById('auth-btn-main'); // Google btn
const instituteNameDisplay = document.getElementById('institute-name-display');

// Registration Form
const registerForm = document.getElementById('register-form');
const btnShowRegister = document.getElementById('btn-show-register');
const btnCancelRegister = document.getElementById('btn-cancel-register');

// Event Listeners
if (authBtn) authBtn.addEventListener('click', handleAuthAction);
if (authBtnMain) authBtnMain.addEventListener('click', handleAuthAction);
if (btnShowRegister) btnShowRegister.addEventListener('click', showRegistration);
if (btnCancelRegister) btnCancelRegister.addEventListener('click', showSelection);
if (registerForm) registerForm.addEventListener('submit', handleRegistration);

// Check Auth State
supabaseService.onAuthStateChange(async (user) => {
    currentUser = user;
    if (user) {
        // Ensure profile exists in DB (Fallback for trigger)
        await supabaseService.ensureUserDocExists(user);

        updateUIForLogin(user);
        await handlePostLogin(user);
    } else {
        updateUIForLogout();
    }
});

async function handleAuthAction() {
    if (currentUser) {
        await supabaseService.logout();
    } else {
        try {
            await supabaseService.login();
        } catch (error) {
            console.error("Login failed:", error);
            UIHelpers.showToast("Error al iniciar sesión: " + error.message, 'error');
        }
    }
}

function updateUIForLogin(user) {
    if (authBtn) {
        authBtn.innerHTML = '<i class="fas fa-sign-out-alt me-1"></i> Cerrar Sesión';
        authBtn.classList.replace('btn-light', 'btn-outline-light');
    }
    if (userEmailSpan) userEmailSpan.textContent = user.email;
    if (userInfo) userInfo.classList.remove('d-none');

    // Hide initial login prompt
    if (loginPrompt) loginPrompt.classList.add('d-none');
}

function updateUIForLogout() {
    if (authBtn) {
        authBtn.innerHTML = '<i class="fab fa-google me-1"></i> Iniciar Sesión';
        authBtn.classList.replace('btn-outline-light', 'btn-light');
    }
    if (userInfo) userInfo.classList.add('d-none');
    if (instituteNameDisplay) instituteNameDisplay.classList.add('d-none');

    // Show Login Prompt
    if (loginPrompt) loginPrompt.classList.remove('d-none');
    if (instituteSelection) instituteSelection.classList.add('d-none');
    if (instituteRegistration) instituteRegistration.classList.add('d-none');
}

async function handlePostLogin(user) {
    try {
        // Check Superadmin
        const isSuper = await supabaseService.isSuperAdmin(user.id);
        console.log("DEBUG: User ID:", user.id, "Is Superadmin:", isSuper);

        // 1. Selector Card Button
        const saBtnCard = document.getElementById('superadmin-access');
        if (saBtnCard) {
            if (isSuper) saBtnCard.classList.remove('d-none');
            else saBtnCard.classList.add('d-none');
        }

        // 2. Navbar Button
        const saBtnNav = document.getElementById('admin-btn');
        if (saBtnNav) {
            if (isSuper) {
                saBtnNav.classList.remove('d-none');
                // Ensure it has navigation logic if it doesn't align with an anchor tag
                saBtnNav.onclick = () => window.location.href = 'dashboard.html#/superadmin';
            } else {
                saBtnNav.classList.add('d-none');
            }
        }

        // 1. Get user's institutes (with retry for latency)
        let institutes = [];
        for (let i = 0; i < 3; i++) {
            institutes = await supabaseService.getMyInstitutes(user.id);
            if (institutes.length > 0) break;
            await new Promise(r => setTimeout(r, 1000)); // Wait 1s
        }

        if (institutes.length === 0) {
            // No institutes found -> Show Selection/Registration (Registration mainly)
            showSelection();
            if (instituteList) instituteList.innerHTML = '<div class="alert alert-warning">No perteneces a ningún instituto registrado. Puedes registrar uno nuevo o esperar a que se procese tu invitación.</div>';
        } else {
            // ALWAYS show selection list, even if only 1
            renderInstituteList(institutes);
            showSelection();
        }
    } catch (error) {
        console.error("Error fetching institutes:", error);
        if (instituteList) instituteList.innerHTML = '<div class="alert alert-danger">Error al cargar institutos.</div>';
    }
}

function renderInstituteList(institutes) {
    if (!instituteList) return;
    instituteList.innerHTML = institutes.map(inst => {
        let statusBadge = '';
        let itemClass = 'list-group-item-action';
        let clickHandler = `data-id="${inst.id}"`;
        let icon = '<i class="fas fa-chevron-right text-muted"></i>';

        if (inst.status === 'pending') {
            statusBadge = '<span class="badge bg-warning text-dark ms-2">Pendiente de Validación</span>';
            itemClass = 'list-group-item-light text-muted'; // Greyed out
            icon = '<i class="fas fa-hourglass-half text-warning"></i>';
        } else if (inst.status === 'suspended') {
            statusBadge = '<span class="badge bg-danger ms-2">Suspendido</span>';
            itemClass = 'list-group-item-danger';
            icon = '<i class="fas fa-ban text-danger"></i>';
        }

        return `
        <a href="#" class="list-group-item d-flex justify-content-between align-items-center ${itemClass}" ${clickHandler}>
            <div>
                <h5 class="mb-1">${UIHelpers.escapeHtml(inst.name)} ${statusBadge}</h5>
                <small class="${inst.status === 'pending' ? 'text-muted' : ''}">${UIHelpers.escapeHtml(inst.domain || 'Sin dominio')}</small>
            </div>
            ${icon}
        </a>
    `}).join('');

    instituteList.querySelectorAll('a').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const selected = institutes.find(i => i.id === el.dataset.id);

            if (selected.status === 'pending') {
                UIHelpers.showToast("Este instituto está pendiente de validación. Espera a que un administrador lo apruebe.", 'warning');
                return;
            }
            if (selected.status === 'suspended') {
                UIHelpers.showToast("Este instituto ha sido suspendido.", 'error');
                return;
            }

            selectInstitute(selected);
        });
    });
}

function showSelection() {
    if (loginPrompt) loginPrompt.classList.add('d-none');
    if (instituteSelection) instituteSelection.classList.remove('d-none');
    if (instituteRegistration) instituteRegistration.classList.add('d-none');
}

function showRegistration() {
    if (instituteSelection) instituteSelection.classList.add('d-none');
    if (instituteRegistration) instituteRegistration.classList.remove('d-none');
}

async function handleRegistration(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const domain = document.getElementById('reg-domain').value; // Currently unused in backend insert but good to have

    try {
        await supabaseService.registerInstitute(name, currentUser.email);
        UIHelpers.showToast("Solicitud enviada. Pendiente de aprobación.", 'success');
        showSelection();
        // Refresh?
        handlePostLogin(currentUser);
    } catch (error) {
        console.error("Registration error:", error);
        UIHelpers.showToast("Error al registrar: " + error.message, 'error');
    }
}

async function selectInstitute(institute) {
    console.log("Selected institute:", institute);
    supabaseService.setInstitute(institute);

    // Redirect to dashboard with institute context (or just dashboard.html and it reads from localStorage)
    window.location.href = 'dashboard.html';
}
