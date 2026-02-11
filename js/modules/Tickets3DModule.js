import { UIHelpers } from '../UIHelpers.js';

export class Tickets3DModule {
    constructor(container, supabaseService, user, userRoles, isAdmin) {
        this.container = container;
        this.supabaseService = supabaseService;
        this.user = user;
        this.userRoles = userRoles;
        this.isAdmin = isAdmin;
        this.canManage = userRoles.includes('equipo_3d');

        this.currentView = 'list'; // 'list' or 'reports'

        window.manage3DTicket = (id) => this.openManageModal(id);

        this.render();
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header d-flex justify-content-between align-items-center">
                <div>
                    <h2><i class="fas fa-cube me-2"></i>Peticiones 3D</h2>
                    <p class="text-muted mb-0">Gestión de impresiones y consumo de material</p>
                </div>
                <div>
                    ${this.canManage ? `
                        <button id="btn-view-reports" class="btn btn-outline-primary me-2">
                            <i class="fas fa-chart-bar me-1"></i>Reportes
                        </button>
                    ` : ''}
                    <button id="btn-new-ticket" class="btn btn-primary">
                        <i class="fas fa-plus me-2"></i>Nueva Petición
                    </button>
                </div>
            </div>

            <div id="tickets-content" class="mt-4"></div>
        `;

        document.getElementById('btn-new-ticket').addEventListener('click', () => this.showCreateTicketModal());

        if (this.canManage) {
            document.getElementById('btn-view-reports').addEventListener('click', () => this.toggleView());
        }

        await this.loadTicketsList();
    }

    toggleView() {
        this.currentView = this.currentView === 'list' ? 'reports' : 'list';
        if (this.currentView === 'reports') {
            this.loadReports();
        } else {
            this.loadTicketsList();
        }
    }

    async loadTicketsList() {
        const container = document.getElementById('tickets-content');
        UIHelpers.showLoading(container);

        try {
            const [users, departments] = await Promise.all([
                this.supabaseService.getAllUsers(),
                this.supabaseService.getAllDepartments()
            ]);

            this.usersMap = {};
            users.forEach(u => this.usersMap[u.uid] = u.displayName || u.email);

            this.deptMap = {};
            departments.forEach(d => this.deptMap[d.id] = d.name);

            const userData = users.find(u => u.uid === this.user.uid);
            const userDept = userData ? userData.department : null;

            const tickets = await this.supabaseService.getTickets('3d', this.user.uid, this.userRoles, userDept);

            if (tickets.length === 0) {
                UIHelpers.showEmptyState(container, 'No hay peticiones registradas', 'cube');
                return;
            }

            // Group tickets by status
            const openTickets = tickets.filter(t => t.status === 'abierto');
            const printingTickets = tickets.filter(t => t.status === 'en_progreso');
            const completedTickets = tickets.filter(t => t.status === 'resuelto' || t.status === 'cerrado');

            container.innerHTML = `
                <div class="row g-3">
                    <div class="col-md-4">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-header bg-danger text-white fw-bold d-flex justify-content-between align-items-center">
                                <span><i class="fas fa-exclamation-circle me-2"></i>Pendientes</span>
                                <span class="badge bg-white text-danger rounded-pill">${openTickets.length}</span>
                            </div>
                            <div class="card-body p-2" style="max-height: 70vh; overflow-y: auto;">
                                ${this.renderTicketsList(openTickets)}
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-header bg-warning text-dark fw-bold d-flex justify-content-between align-items-center">
                                <span><i class="fas fa-cube me-2"></i>Imprimiendo</span>
                                <span class="badge bg-white text-dark rounded-pill">${printingTickets.length}</span>
                            </div>
                            <div class="card-body p-2" style="max-height: 70vh; overflow-y: auto;">
                                ${this.renderTicketsList(printingTickets)}
                            </div>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-header bg-success text-white fw-bold d-flex justify-content-between align-items-center">
                                <span><i class="fas fa-check-circle me-2"></i>Completados</span>
                                <span class="badge bg-white text-success rounded-pill">${completedTickets.length}</span>
                            </div>
                            <div class="card-body p-2" style="max-height: 70vh; overflow-y: auto;">
                                ${this.renderTicketsList(completedTickets)}
                            </div>
                        </div>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error loading tickets:', error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar las peticiones</div>';
        }
    }

    renderTicketsList(tickets) {
        if (tickets.length === 0) {
            return '<p class="text-muted text-center py-4">No hay peticiones en esta categoría</p>';
        }

        return `
            <div class="list-group">
                ${tickets.map(ticket => {
            const isOwner = ticket.requestedBy === this.user.uid;
            const canEdit = this.canManage; // Team member
            const canView = isOwner || canEdit;
            const isDisabled = !canView;

            return `
                    <div class="list-group-item ticket-item priority-${ticket.priority} ${isDisabled ? 'bg-light text-muted opacity-75' : ''}"
                        ${isDisabled ? 'style="pointer-events: none; cursor: default;"' : `onclick="window.manage3DTicket('${ticket.id}')"`}>
                        <div class="d-flex justify-content-between align-items-start">

                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center mb-2">
                                    <span class="badge bg-secondary me-2">${ticket.ticketNumber}</span>
                                    <h6 class="mb-0">${UIHelpers.escapeHtml(ticket.title)}</h6>
                                </div>
                                <p class="mb-1 text-muted small">${UIHelpers.escapeHtml(ticket.description)}</p>
                                <div class="small text-muted mb-2">
                                    <i class="fas fa-link me-1"></i><a href="${UIHelpers.escapeHtml(ticket.stlUrl || '#')}" target="_blank">${ticket.stlUrl ? 'Ver Archivo STL' : 'Sin archivo'}</a>
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-layer-group me-1"></i>${ticket.filamentUsed || 0}g
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-clock me-1"></i>${ticket.printTime || 0} min
                                </div>
                                <div class="small text-muted">
                                    <i class="fas fa-user me-1"></i>${UIHelpers.escapeHtml(ticket.requestedByName)} 
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-building me-1"></i>${UIHelpers.escapeHtml((this.deptMap && this.deptMap[ticket.requestedByDepartment]) || ticket.requestedByDepartment)}
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-calendar me-1"></i>${UIHelpers.formatDate(ticket.createdAt)}
                                    ${ticket.assignedTo ? `<span class="mx-2">•</span><i class="fas fa-user-check text-primary me-1"></i>${UIHelpers.escapeHtml(this.usersMap[ticket.assignedTo] || 'Asignado')}` : ''}
                                </div>
                            </div>
                            <div class="text-end ms-3">
                                ${UIHelpers.getStatusBadge(ticket.status)}
                                ${UIHelpers.getPriorityBadge(ticket.priority)}
                                ${this.canManage ? `
                                    <div class="mt-2">
                                        <button class="btn btn-sm btn-outline-primary" onclick="window.manage3DTicket('${ticket.id}')">
                                            Gestionar
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;
    }

    showCreateTicketModal() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-cube me-2"></i>Nueva Petición 3D</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-ticket-3d">
                            <div class="mb-3">
                                <label class="form-label">Título *</label>
                                <input type="text" class="form-control" id="ticket-title" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Descripción / Instrucciones *</label>
                                <textarea class="form-control" id="ticket-description" rows="3" required></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Enlace al STL/Diseño (Drive, Thingiverse, URL...) *</label>
                                <input type="url" class="form-control" id="ticket-stl" placeholder="https://..." required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Prioridad</label>
                                <select class="form-select" id="ticket-priority">
                                    <option value="normal" selected>Normal</option>
                                    <option value="alta">Alta</option>
                                    <option value="urgente">Urgente</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-ticket">Crear Petición</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-save-ticket').addEventListener('click', async () => {
            const title = document.getElementById('ticket-title').value;
            const description = document.getElementById('ticket-description').value;
            const stlUrl = document.getElementById('ticket-stl').value;
            const priority = document.getElementById('ticket-priority').value;

            if (!title || !description || !stlUrl) {
                UIHelpers.showToast('Por favor completa todos los campos obligatorios', 'error');
                return;
            }

            try {
                const users = await this.supabaseService.getAllUsers();
                const userData = users.find(u => u.uid === this.user.uid);
                const userDepartment = userData?.department || 'Sin departamento';

                const result = await this.supabaseService.createTicket('3d', {
                    title,
                    description,
                    priority,
                    stlUrl
                }, this.user.uid, this.user.displayName || this.user.email.split('@')[0], userDepartment);

                UIHelpers.showToast(`Petición ${result.ticketNumber} creada correctamente`, 'success');
                bsModal.hide();
                await this.loadTicketsList();
            } catch (error) {
                console.error('Error creating ticket:', error);
                UIHelpers.showToast('Error al crear la petición', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async openManageModal(ticketId) {
        // Implementation for managing 3d ticket (add filament, time, photo, update status)
        const tickets = await this.supabaseService.getTickets('3d', this.user.uid, this.userRoles);
        const ticket = tickets.find(t => t.id === ticketId);

        if (!ticket) return;

        const users = await this.supabaseService.getAllUsers();

        // Filter users for assignment (only equipo_3d)
        const team3dUsers = users.filter(u => u.roles && u.roles.includes('equipo_3d'));

        // Build assignee options
        const assigneeOptions = team3dUsers.map(u =>
            `<option value="${u.uid}" ${ticket.assignedTo === u.uid ? 'selected' : ''}>${UIHelpers.escapeHtml(u.displayName || u.email)}</option>`
        ).join('');

        const modal = document.createElement('div');
        modal.className = 'modal fade';

        // Generate History HTML
        const renderHistory = (history) => {
            if (!history || history.length === 0) return '<div class="text-muted small">Sin historial</div>';

            return history.sort((a, b) => (b.timestamp?.seconds || b.timestamp) - (a.timestamp?.seconds || a.timestamp)).map(h => {
                const date = h.timestamp instanceof Date ? h.timestamp : (h.timestamp.toDate ? h.timestamp.toDate() : new Date(h.timestamp));
                let icon = 'circle';
                let color = 'secondary';

                if (h.type === 'creation') { icon = 'plus-circle'; color = 'primary'; }
                if (h.type === 'status') { icon = 'exchange-alt'; color = 'info'; }
                if (h.type === 'comment') { icon = 'comment'; color = 'warning'; }
                if (h.type === 'assignment') { icon = 'user-check'; color = 'success'; }

                return `
                    <div class="d-flex mb-3">
                        <div class="me-3">
                            <div class="bg-light rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                <i class="fas fa-${icon} text-${color}"></i>
                            </div>
                        </div>
                        <div>
                            <div class="small text-muted mb-1">
                                <span class="fw-bold text-dark">${UIHelpers.escapeHtml(h.userName || 'Usuario')}</span> • ${UIHelpers.formatDate(date)} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div>${UIHelpers.escapeHtml(h.content)}</div>
                        </div>
                    </div>
                    `;
            }).join('');
        };

        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Gestionar Petición 3D</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                         <div class="row">
                            <div class="col-md-7">
                                <div class="mb-3">
                                    <label class="form-label small text-muted">Descripción</label>
                                    <div class="p-3 bg-light rounded">${UIHelpers.escapeHtml(ticket.description)}</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small text-muted">URL STL</label>
                                    <div><a href="${UIHelpers.escapeHtml(ticket.stlUrl)}" target="_blank">${UIHelpers.escapeHtml(ticket.stlUrl)}</a></div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label fw-bold"><i class="fas fa-history me-2"></i>Historial</label>
                                    <div class="p-3 bg-white border rounded" style="max-height: 300px; overflow-y: auto;">
                                        ${renderHistory(ticket.history)}
                                    </div>
                                </div>
                                
                                <div class="mt-3">
                                    <label class="form-label fw-bold">Nueva Observación</label>
                                    <textarea class="form-control" id="ticket-new-observation" rows="2" placeholder="Escribe una observación..."></textarea>
                                </div>
                            </div>
                            <div class="col-md-5">
                                <div class="card bg-light border-0">
                                    <div class="card-body">
                                        <h6 class="fw-bold mb-3">Control</h6>
                                        <div class="mb-3">
                                            <label class="form-label">Estado</label>
                                            <select class="form-select" id="manage-status" ${!this.canManage ? 'disabled' : ''}>
                                                <option value="abierto" ${ticket.status === 'abierto' ? 'selected' : ''}>Pendiente</option>
                                                <option value="en_progreso" ${ticket.status === 'en_progreso' ? 'selected' : ''}>Imprimiendo</option>
                                                <option value="resuelto" ${ticket.status === 'resuelto' ? 'selected' : ''}>Completado</option>
                                                <option value="cerrado" ${ticket.status === 'cerrado' ? 'selected' : ''}>Cerrado</option>
                                            </select>
                                        </div>
                                        <div class="mb-3">
                                             <label class="form-label">Asignado a</label>
                                             <select class="form-select" id="manage-assigned" ${!this.canManage ? 'disabled' : ''}>
                                                 <option value="">-- Sin Asignar --</option>
                                                 ${assigneeOptions}
                                             </select>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label">Filamento consumido (g)</label>
                                            <input type="number" class="form-control" id="manage-filament" value="${ticket.filamentUsed || 0}" ${!this.canManage ? 'disabled' : ''}>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label">Tiempo (min)</label>
                                            <input type="number" class="form-control" id="manage-time" value="${ticket.printTime || 0}" ${!this.canManage ? 'disabled' : ''}>
                                        </div>
                                         <div class="mb-3">
                                            <label class="form-label">URL Foto Resultado</label>
                                            <input type="url" class="form-control" id="manage-photo" value="${ticket.imageUrl || ''}" placeholder="http://..." ${!this.canManage ? 'disabled' : ''}>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        ${(ticket.requestedBy === this.user.uid && !ticket.assignedTo && ticket.status === 'abierto') ? `
                            <button class="btn btn-danger me-auto" id="btn-delete-ticket">
                                <i class="fas fa-trash-alt me-2"></i>Eliminar Petición
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-update-ticket">
                            ${this.canManage ? 'Actualizar' : 'Añadir Observación'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const btnDelete = document.getElementById('btn-delete-ticket');
        if (btnDelete) {
            btnDelete.addEventListener('click', async () => {
                if (confirm('¿Estás seguro de que deseas eliminar esta petición?')) {
                    try {
                        await this.supabaseService.deleteTicket('3d', ticketId);
                        UIHelpers.showToast('Petición eliminada', 'success');
                        bsModal.hide();
                        await this.loadTicketsList();
                    } catch (error) {
                        console.error('Error deleting ticket:', error);
                        UIHelpers.showToast('Error al eliminar la petición', 'error');
                    }
                }
            });
        }

        document.getElementById('btn-update-ticket').addEventListener('click', async () => {
            const status = document.getElementById('manage-status').value;
            const assignedTo = document.getElementById('manage-assigned').value;
            const filamentUsed = parseFloat(document.getElementById('manage-filament').value) || 0;
            const printTime = parseFloat(document.getElementById('manage-time').value) || 0;
            const imageUrl = document.getElementById('manage-photo').value;

            try {
                const updates = {
                    updatedAt: new Date(),
                    updatedBy: this.user.uid,
                    filamentUsed,
                    printTime,
                    imageUrl,
                    printedBy: this.user.uid,
                    printedByName: this.user.displayName || this.user.email.split('@')[0]
                };

                let newHistoryEntries = [];

                // Observation
                const newObservation = document.getElementById('ticket-new-observation').value.trim();
                if (newObservation) {
                    newHistoryEntries.push({
                        timestamp: new Date(),
                        type: 'comment',
                        userId: this.user.uid,
                        userName: this.user.displayName || this.user.email,
                        content: newObservation
                    });
                }

                if (status !== ticket.status) {
                    updates.status = status;
                    newHistoryEntries.push({
                        timestamp: new Date(),
                        type: 'status',
                        userId: this.user.uid,
                        userName: this.user.displayName || this.user.email,
                        content: `Estado cambiado de ${ticket.status} a ${status}`
                    });
                }

                if (assignedTo !== ticket.assignedTo) {
                    updates.assignedTo = assignedTo;
                    const newUser = users.find(u => u.uid === assignedTo);
                    const newUserName = newUser ? (newUser.displayName || newUser.email) : 'Sin asignar';
                    newHistoryEntries.push({
                        timestamp: new Date(),
                        type: 'assignment',
                        userId: this.user.uid,
                        userName: this.user.displayName || this.user.email,
                        content: `Asignado a ${newUserName}`
                    });
                }

                if (newHistoryEntries.length > 0) {
                    updates.newHistoryEntries = newHistoryEntries;
                }

                // If only updated technical data (filament/time) without status change, we might want to log it? 
                // Currently user request only mentions "status changes and written observations". 
                // So I will only log those. Tech data updates are just regular updates.

                // Only send update if meaningful change or forced? 
                // For simplified UX, always update if button clicked.

                await this.supabaseService.updateTicket('3d', ticketId, updates);

                UIHelpers.showToast('Petición actualizada', 'success');
                bsModal.hide();
                await this.loadTicketsList();
            } catch (error) {
                console.error(error);
                UIHelpers.showToast('Error al actualizar', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async loadReports() {
        const container = document.getElementById('tickets-content');
        container.innerHTML = `
            <div class="d-flex justify-content-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
            </div>
        `;

        try {
            // Get all tickets and departments
            const [allTickets, departments] = await Promise.all([
                this.supabaseService.getTickets('3d', this.user.uid, this.userRoles),
                this.supabaseService.getAllDepartments()
            ]);

            // Create Department Map (ID -> Name)
            const deptMap = {};
            departments.forEach(d => deptMap[d.id] = d.name);

            // Filter by School Year
            const schoolYearStart = UIHelpers.getSchoolYearStart();
            const tickets = allTickets.filter(t => {
                const date = t.createdAt instanceof Date ? t.createdAt : (t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt));
                return date >= schoolYearStart;
            });

            if (tickets.length === 0) {
                UIHelpers.showEmptyState(container, `No hay datos para el curso ${UIHelpers.getSchoolYearLabel()}`, 'chart-bar');
                return;
            }

            // Calculations
            let totalFilament = 0;
            let totalTime = 0;
            const statusCounts = { abierto: 0, en_progreso: 0, resuelto: 0, cerrado: 0 };
            const deptStats = {}; // { DeptName: { count: 0, filament: 0, time: 0 } }

            tickets.forEach(t => {
                const filament = (t.filamentUsed || 0);
                const time = (t.printTime || 0);

                totalFilament += filament;
                totalTime += time;

                // Status counts
                if (statusCounts[t.status] !== undefined) {
                    statusCounts[t.status]++;
                }

                // Department stats
                const deptId = t.requestedByDepartment || 'Sin Dept';
                const deptName = deptMap[deptId] || deptId; // Use name if found, else ID

                if (!deptStats[deptName]) deptStats[deptName] = { count: 0, filament: 0, time: 0 };
                deptStats[deptName].count++;
                deptStats[deptName].filament += filament;
                deptStats[deptName].time += time;
            });

            // Pass simplified structure for charts
            const deptCounts = {};
            Object.keys(deptStats).forEach(dept => deptCounts[dept] = deptStats[dept].count);

            // Render Report UI
            container.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                     <h4 class="mb-0">Reporte Curso Escolar ${UIHelpers.getSchoolYearLabel()}</h4>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-md-3">
                        <div class="card shadow-sm border-0 h-100 bg-primary text-white">
                            <div class="card-body text-center">
                                <h6 class="card-title fw-light">Total Peticiones</h6>
                                <h2 class="display-6 fw-bold mb-0">${tickets.length}</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card shadow-sm border-0 h-100 bg-success text-white">
                            <div class="card-body text-center">
                                <h6 class="card-title fw-light">Filamento Total</h6>
                                <h2 class="display-6 fw-bold mb-0">${totalFilament.toFixed(1)} <small class="fs-6">g</small></h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card shadow-sm border-0 h-100 bg-info text-white">
                            <div class="card-body text-center">
                                <h6 class="card-title fw-light">Tiempo Impresión</h6>
                                <h2 class="display-6 fw-bold mb-0">${(totalTime / 60).toFixed(1)} <small class="fs-6">h</small></h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card shadow-sm border-0 h-100 bg-warning text-dark">
                            <div class="card-body text-center">
                                <h6 class="card-title fw-light">Pendientes</h6>
                                <h2 class="display-6 fw-bold mb-0">${statusCounts['abierto']}</h2>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-md-6">
                        <div class="card shadow-sm h-100">
                            <div class="card-header bg-white">
                                <h5 class="card-title mb-0">Estado de Peticiones</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="chart-status"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card shadow-sm h-100">
                            <div class="card-header bg-white">
                                <h5 class="card-title mb-0">Peticiones por Departamento</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="chart-dept"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card shadow-sm">
                    <div class="card-header bg-white">
                        <h5 class="card-title mb-0">Desglose por Departamento</h5>
                    </div>
                    <div class="card-body">
                         <div class="table-responsive">
                            <table class="table table-striped table-hover align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th>Departamento</th>
                                        <th class="text-center">Peticiones</th>
                                        <th class="text-end">Filamento (g)</th>
                                        <th class="text-end">Tiempo (h)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(deptStats)
                    .sort(([, a], [, b]) => b.filament - a.filament)
                    .map(([dept, data]) => `
                                        <tr>
                                            <td class="fw-medium">${dept}</td>
                                            <td class="text-center">${data.count}</td>
                                            <td class="text-end">${data.filament.toFixed(1)}</td>
                                            <td class="text-end">${(data.time / 60).toFixed(1)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            // Draw Charts
            this.renderCharts(statusCounts, deptCounts);

        } catch (error) {
            console.error('Error calculating reports:', error);
            container.innerHTML = '<div class="alert alert-danger">Error al generar reportes</div>';
        }
    }

    renderCharts(statusCounts, deptCounts) {
        // Status Chart
        new Chart(document.getElementById('chart-status'), {
            type: 'doughnut',
            data: {
                labels: ['Pendiente', 'Imprimiendo', 'Completado', 'Cerrado'],
                datasets: [{
                    data: [
                        statusCounts['abierto'],
                        statusCounts['en_progreso'],
                        statusCounts['resuelto'],
                        statusCounts['cerrado']
                    ],
                    backgroundColor: ['#dc3545', '#ffc107', '#198754', '#6c757d']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });

        // Department Chart
        const deptLabels = Object.keys(deptCounts);
        const deptData = Object.values(deptCounts);

        new Chart(document.getElementById('chart-dept'), {
            type: 'bar',
            data: {
                labels: deptLabels,
                datasets: [{
                    label: 'Peticiones',
                    data: deptData,
                    backgroundColor: '#0d6efd'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
    }

    destroy() {
        // Remove the global function when the module is destroyed
        delete window.manage3DTicket;
    }
}


