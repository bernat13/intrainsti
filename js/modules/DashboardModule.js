import { UIHelpers } from '../UIHelpers.js';

export class DashboardModule {
    constructor(container, firebaseService, user, userRoles, isAdmin, moduleConfig) {
        this.container = container;
        this.firebaseService = firebaseService;
        this.user = user;
        this.userRoles = userRoles;
        this.isAdmin = isAdmin;
        this.moduleConfig = moduleConfig || {};

        this.render();
    }

    isModuleVisible(key) {
        const state = this.moduleConfig[key];
        // Default to true if undefined (legacy/transition)
        if (state === 'active' || state === true || state === undefined) return true;
        if (state === 'testers') return this.userRoles.includes('tester');
        return false;
    }

    async render() {
        this.container.innerHTML = `
            <div class="welcome-banner mb-5 p-4 rounded-3 shadow-sm text-white">
                <div class="d-flex align-items-center justify-content-between">
                    <div>
                        <h1 class="display-5 fw-bold mb-2">Bienvenido/a</h1>
                        <p class="lead mb-0 opacity-75">Panel de gestión de la Intranet IES Antonio Machado</p>
                    </div>
                    <div class="d-none d-md-block opacity-50">
                        <i class="fas fa-th-large fa-4x"></i>
                    </div>
                </div>
            </div>

            <h5 class="mb-4 fw-bold text-secondary text-uppercase ls-1"><i class="fas fa-layer-group me-2"></i>Módulos Disponibles</h5>
            <div class="row g-4 mb-5" id="modules-grid">
                <!-- Module cards will be loaded here -->
                <div class="col-12 text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                </div>
            </div>

            <div class="row g-4">
                <div class="col-md-6" id="widget-announcements">
                    <!-- Announcements Widget -->
                </div>
                <div class="col-md-6" id="widget-tickets">
                    <!-- Tickets Widget -->
                </div>
            </div>
        `;

        await this.loadModulesGrid();

        // Load widgets if visible
        if (this.isModuleVisible('anuncios')) {
            await this.loadRecentAnnouncementsWrapper();
        }

        const showTickets = this.isModuleVisible('tickets_tic') || this.isModuleVisible('tickets_maintenance');
        if (showTickets) {
            await this.loadMyTicketsWrapper();
        }
    }

    async loadModulesGrid() {
        const grid = document.getElementById('modules-grid');
        if (!grid) return;

        const allModules = [
            { key: 'calendario', title: 'Calendario', icon: 'calendar-alt', color: 'primary', link: '#/calendario', desc: 'Consulta eventos y días de libre disposición' },
            { key: 'anuncios', title: 'Anuncios', icon: 'bullhorn', color: 'info', link: '#/anuncios', desc: 'Noticias y comunicados' },
            { key: 'tickets_tic', title: 'Peticiones TIC', icon: 'laptop', color: 'warning', link: '#/tickets-tic', desc: 'Soporte técnico informático' },
            { key: 'tickets_maintenance', title: 'Peticiones Mantenimiento', icon: 'tools', color: 'danger', link: '#/tickets-mantenimiento', desc: 'Reparaciones e infraestructura' },
            { key: 'tickets_3d', title: 'Peticiones 3D', icon: 'cube', color: 'success', link: '#/tickets-3d', desc: 'Peticiones de impresión' },
            { key: 'sum', title: 'Reserva SUM', icon: 'building', color: 'secondary', link: '#/reserva-sum', desc: 'Salón de Actos' },
            { key: 'carts', title: 'Carros Portátiles', icon: 'shopping-cart', color: 'dark', link: '#/reserva-carros', desc: 'Reserva de equipos' }
        ];

        // Filter visible modules
        const visibleModules = allModules.filter(m => this.isModuleVisible(m.key));

        if (visibleModules.length === 0) {
            grid.innerHTML = '<div class="col-12"><div class="alert alert-info">No hay módulos habilitados para tu usuario.</div></div>';
            return;
        }

        // Fetch stats where needed
        const stats = {};
        try {
            // Parallel fetch for known stats
            const promises = [];
            const pKeys = [];

            if (visibleModules.some(m => m.key === 'tickets_tic')) {
                promises.push(this.firebaseService.getTickets('tic', this.user.uid, this.userRoles));
                pKeys.push('tic');
            }
            if (visibleModules.some(m => m.key === 'tickets_maintenance')) {
                promises.push(this.firebaseService.getTickets('maintenance', this.user.uid, this.userRoles));
                pKeys.push('mnt');
            }
            if (visibleModules.some(m => m.key === 'anuncios')) {
                promises.push(this.firebaseService.getAnnouncements(this.userRoles));
                pKeys.push('ann');
            }

            if (promises.length > 0) {
                const results = await Promise.all(promises);
                results.forEach((res, index) => {
                    const k = pKeys[index];
                    if (k === 'tic' || k === 'mnt') {
                        // Count open tickets
                        stats[k] = res.filter(t => t.status === 'abierto' || t.status === 'en_progreso').length;
                    } else if (k === 'ann') {
                        stats[k] = res.length;
                    }
                });
            }
        } catch (e) {
            console.error("Error fetching dashboard stats", e);
        }

        // Render Cards
        grid.innerHTML = visibleModules.map(m => {
            let badgeHtml = '';

            if (m.key === 'tickets_tic' && stats.tic !== undefined) {
                badgeHtml = `<span class="badge bg-white text-${m.color} rounded-pill px-3">${stats.tic}</span>`;
            } else if (m.key === 'tickets_maintenance' && stats.mnt !== undefined) {
                badgeHtml = `<span class="badge bg-white text-${m.color} rounded-pill px-3">${stats.mnt}</span>`;
            } else if (m.key === 'anuncios' && stats.ann !== undefined) {
                badgeHtml = `<span class="badge bg-white text-${m.color} rounded-pill px-3">${stats.ann}</span>`;
            }

            return `
                <div class="col-12 col-md-6 col-lg-4 col-xl-3">
                    <a href="${m.link}" class="text-decoration-none text-dark">
                        <div class="card module-card h-100 border-0 shadow-sm hover-float overflow-hidden">
                            <div class="card-body p-4 position-relative">
                                <div class="module-icon-bg bg-${m.color} bg-opacity-10 position-absolute end-0 top-0 mt-n3 me-n3 rounded-circle d-flex align-items-center justify-content-center" style="width: 100px; height: 100px; opacity: 0.3;">
                                    <i class="fas fa-${m.icon} fa-3x text-${m.color}"></i>
                                </div>
                                <div class="d-flex align-items-center mb-3">
                                    <div class="icon-box rounded-3 bg-${m.color} text-white shadow-sm me-3 d-flex align-items-center justify-content-center" style="width: 48px; height: 48px;">
                                        <i class="fas fa-${m.icon} fa-lg"></i>
                                    </div>
                                    <h5 class="fw-bold mb-0 text-dark">${m.title}</h5>
                                </div>
                                <p class="text-muted small mb-3 position-relative" style="z-index:1;">${m.desc}</p>
                                
                                ${badgeHtml ? `
                                <div class="mt-auto pt-3 border-top position-relative" style="z-index:1;">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <small class="text-uppercase fw-bold text-${m.color}" style="font-size: 0.7rem;">Actividad</small>
                                        <div class="bg-${m.color} text-white rounded-pill px-2 py-1 small fw-bold" style="font-size: 0.75rem;">
                                            ${stats[m.key === 'tickets_tic' ? 'tic' : m.key === 'tickets_maintenance' ? 'mnt' : 'ann']}
                                        </div>
                                    </div>
                                </div>` : ''}
                            </div>
                        </div>
                    </a>
                </div>
            `;
        }).join('');
    }

    async loadRecentAnnouncementsWrapper() {
        const container = document.getElementById('widget-announcements');
        container.innerHTML = `
            <div class="card shadow-sm h-100">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0"><i class="fas fa-bullhorn me-2"></i>Últimos Anuncios</h5>
                </div>
                <div class="card-body" id="recent-announcements">
                    <div class="spinner-border text-primary" role="status"></div>
                </div>
            </div>
        `;
        await this.loadRecentAnnouncements();
    }

    async loadMyTicketsWrapper() {
        const container = document.getElementById('widget-tickets');
        container.innerHTML = `
             <div class="card shadow-sm h-100">
                <div class="card-header bg-warning">
                    <h5 class="mb-0"><i class="fas fa-ticket-alt me-2"></i>Mis Peticiones Abiertas</h5>
                </div>
                <div class="card-body" id="my-tickets">
                    <div class="spinner-border text-warning" role="status"></div>
                </div>
            </div>
        `;
        await this.loadMyTickets();
    }

    async loadRecentAnnouncements() {
        const container = document.getElementById('recent-announcements');
        if (!container) return; // Should exist if wrapper called

        try {
            const announcements = await this.firebaseService.getAnnouncements(this.userRoles);
            const recent = announcements.slice(0, 3);

            if (recent.length === 0) {
                UIHelpers.showEmptyState(container, 'No hay anuncios recientes', 'bullhorn');
                return;
            }

            container.innerHTML = recent.map(ann => `
                <div class="border-bottom pb-2 mb-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1">${ann.title}</h6>
                            <small class="text-muted">
                                <i class="fas fa-user me-1"></i>${ann.authorName} • 
                                ${UIHelpers.formatDateShort(ann.createdAt)}
                            </small>
                        </div>
                        ${UIHelpers.getPriorityBadge(ann.priority || 'normal')}
                    </div>
                </div>
            `).join('');

            container.innerHTML += `
                <a href="#/anuncios" class="btn btn-sm btn-outline-primary mt-2">
                    Ver todos <i class="fas fa-arrow-right ms-1"></i>
                </a>
            `;
        } catch (error) {
            console.error('Error loading announcements:', error);
            container.innerHTML = '<p class="text-danger">Error al cargar anuncios</p>';
        }
    }

    async loadMyTickets() {
        const container = document.getElementById('my-tickets');
        if (!container) return;

        try {
            let myOpenTickets = [];

            if (this.isModuleVisible('tickets_tic')) {
                const ticketsTic = await this.firebaseService.getTickets('tic', this.user.uid, this.userRoles);
                myOpenTickets.push(...ticketsTic.filter(t => t.requestedBy === this.user.uid && (t.status === 'abierto' || t.status === 'en_progreso')));
            }

            if (this.isModuleVisible('tickets_maintenance')) {
                const ticketsMnt = await this.firebaseService.getTickets('maintenance', this.user.uid, this.userRoles);
                myOpenTickets.push(...ticketsMnt.filter(t => t.requestedBy === this.user.uid && (t.status === 'abierto' || t.status === 'en_progreso')));
            }

            if (myOpenTickets.length === 0) {
                UIHelpers.showEmptyState(container, 'No tienes peticiones abiertas', 'check-circle');
                return;
            }

            container.innerHTML = myOpenTickets.slice(0, 5).map(ticket => `
                <div class="border-bottom pb-2 mb-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1">
                                <span class="badge bg-secondary me-1">${ticket.ticketNumber}</span>
                                ${ticket.title}
                            </h6>
                            <small class="text-muted">
                                ${UIHelpers.formatDateShort(ticket.createdAt)}
                            </small>
                        </div>
                        ${UIHelpers.getStatusBadge(ticket.status)}
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error loading tickets:', error);
            container.innerHTML = '<p class="text-danger">Error al cargar tickets</p>';
        }
    }

    destroy() {
        // Cleanup if needed
    }
}
