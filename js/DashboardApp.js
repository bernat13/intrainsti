import { SupabaseService } from './SupabaseService.js';
import { Router } from './Router.js';
import { UIHelpers } from './UIHelpers.js';

// Import modules
import { DashboardModule } from './modules/DashboardModule.js';
import { CalendarModule } from './modules/CalendarModule.js';
import { AnnouncementsModule } from './modules/AnnouncementsModule.js';
import { TicketsTicModule } from './modules/TicketsTicModule.js';
import { TicketsMaintenanceModule } from './modules/TicketsMaintenanceModule.js';
import { Tickets3DModule } from './modules/Tickets3DModule.js';
import { SUMModule } from './modules/SUMModule.js';
import { LaptopCartsModule } from './modules/LaptopCartsModule.js';
import { AdminModule } from './modules/AdminModule.js';
import { DepartmentsModule } from './modules/DepartmentsModule.js';
import { MyDepartmentModule } from './modules/MyDepartmentModule.js';
import { HelpModule } from './modules/HelpModule.js';
import { DualModule } from './modules/DualModule.js';
import { SuperadminModule } from './modules/SuperadminModule.js';
import { ProfileModule } from './modules/ProfileModule.js';
import { InstituteSettingsModule } from './modules/InstituteSettingsModule.js';

class DashboardApp {
    constructor() {
        this.supabaseService = new SupabaseService();
        this.router = new Router();
        this.user = null;
        this.userRoles = [];
        this.isAdmin = false;
        this.currentInstitute = null;

        this.init();
    }

    async init() {
        // 1. Check Auth
        this.supabaseService.onAuthStateChange(async (user) => {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }

            this.user = user;

            // 2. Check Institute Context
            // 2. Check Auth & Superadmin
            const isSuperAdmin = await this.supabaseService.isSuperAdmin();
            const isSuperAdminRoute = window.location.hash === '#/superadmin';
            const storedInstituteId = localStorage.getItem('selectedInstituteId');

            if (!storedInstituteId) {
                // If no institute, allow ONLY superadmin route for superadmins
                if (isSuperAdmin && isSuperAdminRoute) {
                    this.currentInstitute = null;
                    this.userRoles = [];
                    this.isAdmin = true; // Superadmin is admin
                    this.moduleConfig = {}; // No module config without institute
                } else {
                    window.location.href = 'index.html';
                    return;
                }
            } else {
                // Institute Flow
                try {
                    const institute = await this.supabaseService.getInstituteDetails(storedInstituteId);
                    if (!institute) throw new Error("Institute not found");

                    this.supabaseService.setInstitute(institute);
                    this.currentInstitute = institute;

                    // Update Navbar Brand
                    const brand = document.querySelector('.navbar-brand');
                    if (brand) brand.innerHTML = `<i class="fas fa-school me-2"></i>${UIHelpers.escapeHtml(institute.name)}`;

                    // Load Roles
                    const member = await this.supabaseService.getInstituteMember(user.id, storedInstituteId);
                    this.userRoles = member.roles || [];
                    this.isAdmin = this.userRoles.includes('director') || this.userRoles.includes('admin');

                    // Check Pending Status
                    if (this.currentInstitute.status === 'pending' && !isSuperAdmin) {
                        document.getElementById('main-content').innerHTML = `
                        <div class="container py-5 text-center">
                            <div class="display-1 text-warning mb-4"><i class="fas fa-clock"></i></div>
                            <h1 class="mb-4">Instituto Pendiente de Validación</h1>
                            <p class="lead text-muted mb-4">
                                Tu solicitud para <strong>${UIHelpers.escapeHtml(this.currentInstitute.name)}</strong> está en revisión.
                            </p>
                            <a href="index.html" class="btn btn-outline-primary">Volver al inicio</a>
                        </div>`;
                        return;
                    }

                    // Load Config
                    this.moduleConfig = await this.supabaseService.getModuleConfig() || {};

                } catch (e) {
                    console.error("Invalid institute", e);
                    localStorage.removeItem('selectedInstituteId');
                    // If superadmin on superadmin route, recover? No, simpler to just fail back.
                    if (isSuperAdmin && isSuperAdminRoute) {
                        this.currentInstitute = null;
                        this.moduleConfig = {};
                    } else {
                        window.location.href = 'index.html';
                        return;
                    }
                }
            }

            this.setupUI();
            this.setupRouter();
            this.setupEventListeners();
            this.applyModuleConfig();
            this.router.start();
        });
    }

    setupUI() {
        // Update user display name
        const displayName = this.user.displayName || this.user.email.split('@')[0];
        const nameEl = document.getElementById('user-display-name');
        if (nameEl) nameEl.textContent = displayName;

        const desktopNameEl = document.getElementById('user-display-name-desktop');
        if (desktopNameEl) desktopNameEl.textContent = displayName;

        // Show admin menu if admin
        if (this.isAdmin) {
            document.getElementById('admin-menu-header').classList.remove('d-none');
            document.getElementById('admin-menu').classList.remove('d-none');
        }

        // Show superadmin menu
        this.supabaseService.isSuperAdmin().then(isSuper => {
            if (isSuper) {
                // Check if link already exists
                if (!document.getElementById('nav-superadmin')) {
                    const navContainer = document.querySelector('#sidebar .position-sticky');
                    if (navContainer) {
                        const saHeader = document.createElement('h6');
                        saHeader.className = 'sidebar-heading px-3 mt-4 mb-1 text-muted';
                        saHeader.innerHTML = '<span>SUPERADMIN</span>';

                        const saUl = document.createElement('ul');
                        saUl.className = 'nav flex-column mb-2';
                        saUl.innerHTML = `
                            <li class="nav-item">
                                <a class="nav-link" href="#/superadmin" id="nav-superadmin">
                                    <i class="fas fa-user-shield me-2"></i> Panel Superadmin
                                </a>
                            </li>
                        `;
                        // Insert at top
                        navContainer.insertBefore(saUl, navContainer.firstChild);
                        navContainer.insertBefore(saHeader, navContainer.firstChild);
                    }
                }

                // Header Button
                const navUl = document.querySelector('header .navbar-nav');
                if (navUl && !document.getElementById('header-sa-btn')) {
                    const li = document.createElement('li');
                    li.className = 'nav-item text-nowrap me-2';

                    const btn = document.createElement('a');
                    btn.id = 'header-sa-btn';
                    btn.href = '#/superadmin';
                    btn.className = 'btn btn-warning btn-sm fw-bold text-dark';
                    btn.innerHTML = '<i class="fas fa-user-shield me-1"></i> Superadmin';

                    li.appendChild(btn);
                    navUl.insertBefore(li, navUl.firstChild);
                }
            }
        });

        // Update active nav link on route change
        this.updateActiveNavLink();
        window.addEventListener('hashchange', () => this.updateActiveNavLink());
    }

    applyModuleConfig() {
        if (!this.moduleConfig) return;

        // Map config keys to routes/links
        const mapping = {
            'calendario': '#/calendario',
            'anuncios': '#/anuncios',
            'tickets_tic': '#/tickets-tic',
            'tickets_maintenance': '#/tickets-mantenimiento',
            'tickets_3d': '#/tickets-3d',
            'dual': '#/dual',
            'sum': '#/reserva-sum',
            'carts': '#/reserva-carros'
        };

        for (const [key, href] of Object.entries(mapping)) {
            let isVisible = false;
            const state = this.moduleConfig[key];

            if (state === 'active' || state === true || state === undefined) {
                isVisible = true;
            } else if (state === 'testers') {
                isVisible = this.userRoles.includes('tester');
            }
            // inactive is false by default

            const link = document.querySelector(`.sidebar .nav-link[href="${href}"]`);
            if (link) {
                const li = link.closest('li');
                if (isVisible) {
                    li.classList.remove('d-none');
                } else {
                    li.classList.add('d-none');
                }
            }
        }
    }

    updateActiveNavLink() {
        const currentHash = window.location.hash || '#/dashboard';

        // Update Layout based on route
        this.updateLayout(currentHash);

        // Remove active class from all links
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // Add active class to current route
        const activeLink = document.querySelector(`.sidebar .nav-link[href="${currentHash}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    updateLayout(hash) {
        const sidebar = document.getElementById('sidebar');
        const main = document.querySelector('main');
        const brand = document.querySelector('.navbar-brand');

        if (hash === '#/superadmin') {
            // Superadmin Layout: Full width, no sidebar
            if (sidebar) sidebar.classList.add('d-none');

            if (main) {
                main.classList.remove('col-md-9', 'ms-sm-auto', 'col-lg-10');
                main.classList.add('col-12');
            }

            // Optional: Change brand or hide institute specific info
            if (this.currentInstitute) {
                // If we have an institute context but are in superadmin, maybe hide specific institute nav items?
                // But sidebar is hidden, so that's covered.
            } else {
                // If no institute context, ensure brand says "Intranet" or "Superadmin"
                if (brand) brand.innerHTML = `<i class="fas fa-user-shield me-2"></i>Panel Superadmin`;
            }

        } else {
            // Normal Layout
            if (sidebar) sidebar.classList.remove('d-none');

            if (main) {
                main.classList.remove('col-12');
                main.classList.add('col-md-9', 'ms-sm-auto', 'col-lg-10');
            }

            // Restore Brand if we have an institute
            if (this.currentInstitute && brand) {
                brand.innerHTML = `<i class="fas fa-school me-2"></i>${UIHelpers.escapeHtml(this.currentInstitute.name)}`;
            }
        }
    }

    setupRouter() {
        const mainContent = document.getElementById('main-content');
        const config = this.moduleConfig || {};

        // Helper to check access
        const checkAccess = (moduleKey, factory) => {
            const state = config[moduleKey];
            let allowed = false;

            if (state === 'active' || state === true || state === undefined) {
                allowed = true;
            } else if (state === 'testers') {
                allowed = this.userRoles.includes('tester');
            } else if (state === 'active' && moduleKey === 'dual') {
                // Dual module specific role check even if active
                // Or maybe we treat it as 'active' but only show if have role?
                // Plan said: "Visible ONLY to users with the equipo_dual role".
                // If config says 'active', maybe we still restrict it hard?
                // Or we rely on the config being set to specific logic?
                // Let's implement hard check here for safety + config
                allowed = this.userRoles.includes('equipo_dual') || this.isAdmin;
            }

            if (!allowed) {
                // If disabled, show message
                mainContent.innerHTML = `
                    <div class="alert alert-warning m-4">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Este módulo no está habilitado actualmente para tu usuario.
                    </div>
                `;
                return { destroy: () => { } }; // Dummy module
            }
            return factory();
        };

        // Register routes
        this.router.register('/dashboard', () => {
            return new DashboardModule(mainContent, this.supabaseService, this.user, this.userRoles, this.isAdmin, this.moduleConfig);
        });

        this.router.register('/calendario', () => {
            return checkAccess('calendario', () => new CalendarModule(mainContent, this.supabaseService, this.user, this.isAdmin, this.userRoles, this.moduleConfig));
        });

        this.router.register('/anuncios', () => {
            return checkAccess('anuncios', () => new AnnouncementsModule(mainContent, this.supabaseService, this.user, this.userRoles, this.isAdmin));
        });

        this.router.register('/tickets-tic', () => {
            return checkAccess('tickets_tic', () => new TicketsTicModule(mainContent, this.supabaseService, this.user, this.userRoles, this.isAdmin));
        });

        this.router.register('/tickets-mantenimiento', () => {
            return checkAccess('tickets_maintenance', () => new TicketsMaintenanceModule(mainContent, this.supabaseService, this.user, this.userRoles, this.isAdmin));
        });

        this.router.register('/tickets-3d', () => {
            return checkAccess('tickets_3d', () => new Tickets3DModule(mainContent, this.supabaseService, this.user, this.userRoles, this.isAdmin));
        });

        this.router.register('/dual', () => {
            return checkAccess('dual', () => new DualModule(mainContent, this.supabaseService, this.user, this.userRoles));
        });

        this.router.register('/reserva-sum', () => {
            return checkAccess('sum', () => new SUMModule(mainContent, this.supabaseService, this.user, this.userRoles, this.isAdmin));
        });

        this.router.register('/reserva-carros', () => {
            return checkAccess('carts', () => new LaptopCartsModule(mainContent, this.supabaseService, this.user, this.userRoles, this.isAdmin));
        });


        if (this.isAdmin) {
            this.router.register('/admin', () => {
                return new AdminModule(mainContent, this.supabaseService, this.user);
            });

            this.router.register('/departamentos', () => {
                return new DepartmentsModule(mainContent, this.supabaseService, this.user, this.isAdmin);
            });

            this.router.register('/settings', () => {
                return new InstituteSettingsModule(mainContent, this.supabaseService, this.user, this.isAdmin);
            });
        }

        this.router.register('/superadmin', async () => {
            const isSuper = await this.supabaseService.isSuperAdmin();
            if (isSuper) {
                return new SuperadminModule(mainContent, this.supabaseService, this.user);
            } else {
                window.location.hash = '#/dashboard';
                return { destroy: () => { } };
            }
        });

        // Department Head Route
        if (this.userRoles.includes('jefe_departamento')) {
            this.router.register('/mi-departamento', () => {
                return new MyDepartmentModule(mainContent, this.supabaseService, this.user);
            });
            // Show link in sidebar
            const deptLink = document.getElementById('nav-my-dept');
            if (deptLink) deptLink.closest('li').classList.remove('d-none');
        }

        // Help Route
        this.router.register('/ayuda', () => {
            return new HelpModule(mainContent, this.supabaseService, this.user, this.userRoles, this.moduleConfig);
        });
    }

    setupEventListeners() {
        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.supabaseService.logout();
        });

        // Profile & Navigation
        const profileModule = new ProfileModule(this.supabaseService, this.user);

        const btnProfile = document.getElementById('btn-my-profile');
        if (btnProfile) btnProfile.addEventListener('click', () => profileModule.showProfileModal());

        const btnAbout = document.getElementById('btn-about');
        if (btnAbout) btnAbout.addEventListener('click', () => profileModule.showAboutModal());

        const btnSwitch = document.getElementById('btn-switch-institute');
        if (btnSwitch) btnSwitch.addEventListener('click', async () => {
            if (await UIHelpers.confirm('¿Quieres volver a la selección de instituto? Esto cerrará la sesión actual en este centro.', 'Cambiar Instituto')) {
                localStorage.removeItem('selectedInstituteId');
                window.location.href = 'index.html';
            }
        });

        // Sidebar Toggles
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const toggleBtn = document.getElementById('sidebar-toggle');

        const closeSidebar = () => {
            if (sidebar) sidebar.classList.remove('show');
            if (overlay) overlay.classList.remove('show');
        };

        const openSidebar = () => {
            if (sidebar) sidebar.classList.add('show');
            if (overlay) overlay.classList.add('show');
        };

        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (sidebar && sidebar.classList.contains('show')) {
                    closeSidebar();
                } else {
                    openSidebar();
                }
            });
        }

        if (overlay) {
            overlay.addEventListener('click', closeSidebar);
        }

        // Auto-close on navigation (mobile)
        window.addEventListener('hashchange', () => {
            if (window.innerWidth < 768) {
                closeSidebar();
            }
        });
    }
}

// Initialize app
new DashboardApp();
