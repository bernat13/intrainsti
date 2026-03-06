import { UIHelpers } from '../UIHelpers.js';

export class TicketsMaintenanceModule {
    constructor(container, supabaseService, user, userRoles, isAdmin) {
        this.container = container;
        this.supabaseService = supabaseService;
        this.user = user;
        this.userRoles = userRoles;
        this.isAdmin = isAdmin;
        this.canManage = userRoles.includes('equipo_mantenimiento');
        this.canApprove = userRoles.includes('equipo_directivo');

        // Global function to view/manage ticket
        window.viewTicketMaintenance = async (ticketId) => {
            const ticket = this.tickets ? this.tickets.find(t => t.id === ticketId) : null;
            if (!ticket) {
                UIHelpers.showToast('Error: Incidencia no encontrada', 'error');
                return;
            }

            const isMntTeam = this.canManage; // Equipo Mantenimiento
            const isDirector = this.canApprove; // Director/Directivo
            const isPending = ticket.status === 'pendiente_validacion';
            const isRejected = ticket.status === 'rechazado';

            // Maintenance Team can edit ONLY if NOT pending and NOT rejected (approved)
            const canEdit = isMntTeam && !isPending && !isRejected;

            const users = await this.supabaseService.getAllUsers();

            // Filter users for assignment (only equipo_mantenimiento)
            const mntUsers = users.filter(u => u.roles && u.roles.includes('equipo_mantenimiento'));

            // Build assignee options
            const assigneeOptions = mntUsers.map(u =>
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
                            <h5 class="modal-title">
                                <i class="fas fa-tools me-2"></i>${ticket.ticketNumber} - ${UIHelpers.escapeHtml(ticket.title)}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${isPending ? `
                                <div class="alert alert-warning d-flex align-items-center mb-3">
                                    <i class="fas fa-clock me-2"></i>
                                    <div>Esta petición está pendiente de validar por Dirección.</div>
                                </div>
                            ` : ''}
                            ${isRejected ? `
                                <div class="alert alert-secondary d-flex align-items-center mb-3">
                                    <i class="fas fa-ban me-2"></i>
                                    <div>Esta petición ha sido rechazada.</div>
                                </div>
                            ` : ''}

                            <div class="row">
                                <div class="col-md-8">
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-bold text-uppercase">Descripción Original</label>
                                        <div class="p-3 bg-light rounded border">${UIHelpers.escapeHtml(ticket.description)}</div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-bold text-uppercase">Ubicación</label>
                                        <div class="fw-bold">${UIHelpers.escapeHtml(ticket.location || 'No especificada')}</div>
                                    </div>

                                    ${ticket.comments ? `
                                        <div class="mb-4">
                                            <label class="form-label text-muted small fw-bold text-uppercase">Notas Anteriores (Legacy)</label>
                                            <div class="p-3 bg-white border rounded text-secondary fst-italic">${UIHelpers.escapeHtml(ticket.comments)}</div>
                                        </div>
                                    ` : ''}

                                    <div class="mb-3">
                                        <label class="form-label fw-bold"><i class="fas fa-history me-2"></i>Historial de Actividad</label>
                                        <div class="p-3 bg-white border rounded" style="max-height: 400px; overflow-y: auto;">
                                            ${renderHistory(ticket.history)}
                                        </div>
                                    </div>

                                    ${canEdit || (!isPending && !isRejected && ticket.status !== 'cerrado') ? `
                                        <div class="mt-4">
                                            <label class="form-label fw-bold">Nueva Observación</label>
                                            <textarea class="form-control" id="ticket-new-observation" rows="2" placeholder="Escribe una observación..."></textarea>
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="col-md-4">
                                    <div class="card bg-light border-0">
                                        <div class="card-body">
                                            <h6 class="card-title fw-bold mb-3">Detalles</h6>
                                            
                                            <div class="mb-2">
                                                <small class="text-muted d-block">Solicitante</small>
                                                <strong>${UIHelpers.escapeHtml(ticket.requestedByName)}</strong>
                                                <div class="small text-muted">${UIHelpers.escapeHtml((this.deptMap && this.deptMap[ticket.requestedByDepartment]) || ticket.requestedByDepartment)}</div>
                                            </div>

                                            <div class="mb-2">
                                                 <small class="text-muted d-block">Prioridad</small>
                                                 ${UIHelpers.getPriorityBadge(ticket.priority)}
                                            </div>

                                            <div class="mb-3">
                                                <label class="form-label small text-muted">Estado</label>
                                                ${canEdit ? `
                                                    <select class="form-select form-select-sm" id="ticket-status">
                                                        <option value="abierto" ${ticket.status === 'abierto' ? 'selected' : ''}>Abierto</option>
                                                        <option value="en_progreso" ${ticket.status === 'en_progreso' ? 'selected' : ''}>En Progreso</option>
                                                        <option value="resuelto" ${ticket.status === 'resuelto' ? 'selected' : ''}>Resuelto</option>
                                                        <option value="cerrado" ${ticket.status === 'cerrado' ? 'selected' : ''}>Cerrado</option>
                                                    </select>
                                                ` : `
                                                    <div>${UIHelpers.getStatusBadge(ticket.status)}</div>
                                                `}
                                            </div>

                                            ${canEdit ? `
                                                <div class="mb-3">
                                                    <label class="form-label small text-muted">Asignado a</label>
                                                    <select class="form-select form-select-sm" id="ticket-assigned">
                                                        <option value="">-- Sin Asignar --</option>
                                                        ${assigneeOptions}
                                                    </select>
                                                </div>
                                            ` : ticket.assignedTo ? `
                                                <div class="mb-3">
                                                    <small class="text-muted d-block">Asignado a</small>
                                                    <div class="d-flex align-items-center">
                                                        <i class="fas fa-user-check me-2 text-primary"></i>
                                                        <strong>${UIHelpers.escapeHtml((users.find(u => u.uid === ticket.assignedTo) || {}).displayName || 'Usuario')}</strong>
                                                    </div>
                                                </div>
                                            ` : ''}

                                            ${canEdit ? `
                                                <hr>
                                                <h6 class="fw-bold mb-2">Gestión</h6>
                                                
                                                <div class="mb-2">
                                                    <label class="form-label small text-muted">Tiempo Resolución (min)</label>
                                                    <input type="number" class="form-control form-control-sm" id="ticket-time" value="${ticket.resolutionTime || 0}">
                                                </div>

                                                <div class="mb-2">
                                                    <label class="form-label small text-muted">Coste Total (€)</label>
                                                    <input type="number" class="form-control form-control-sm" id="ticket-cost" value="${ticket.totalCost || 0}" step="0.01">
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            ${(ticket.requestedBy === this.user.uid && !ticket.assignedTo && (ticket.status === 'abierto' || ticket.status === 'pendiente_validacion')) ? `
                                <button class="btn btn-danger me-auto" id="btn-delete-ticket">
                                    <i class="fas fa-trash-alt me-2"></i>Eliminar Petición
                                </button>
                            ` : ''}
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            
                            ${isPending && isDirector ? `
                                <button type="button" class="btn btn-danger" id="btn-reject-ticket">Rechazar</button>
                                <button type="button" class="btn btn-success" id="btn-approve-ticket">Aprobar</button>
                            ` : ''}

                            ${canEdit ? `
                                <button type="button" class="btn btn-primary" id="btn-update-ticket">
                                    <i class="fas fa-save me-2"></i>Guardar Cambios
                                </button>
                            ` : (!isPending && !isRejected && ticket.status !== 'cerrado' ? `
                                <button type="button" class="btn btn-primary" id="btn-update-ticket">
                                    <i class="fas fa-comment me-2"></i>Añadir Observación
                                </button>
                            ` : '')}
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();

            // Delete Logic
            const btnDelete = document.getElementById('btn-delete-ticket');
            if (btnDelete) {
                btnDelete.addEventListener('click', async () => {
                    if (confirm('¿Estás seguro de que deseas eliminar esta petición?')) {
                        try {
                            await this.supabaseService.deleteTicket('maintenance', ticketId);
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

            // Approval Logic
            const btnApprove = document.getElementById('btn-approve-ticket');
            if (btnApprove) {
                btnApprove.addEventListener('click', async () => {
                    const updates = {
                        status: 'abierto',
                        updatedAt: new Date(),
                        updatedBy: this.user.uid,
                        newHistoryEntry: { // Using single entry backwards compat logic for simple cases or push array
                            timestamp: new Date(),
                            type: 'status',
                            userId: this.user.uid,
                            userName: this.user.displayName || this.user.email,
                            content: `Petición aprobada por dirección. Estado: Abierto`
                        }
                    };
                    await this.updateTicketStatus(ticketId, updates, bsModal);
                });
            }

            const btnReject = document.getElementById('btn-reject-ticket');
            if (btnReject) {
                btnReject.addEventListener('click', async () => {
                    const updates = {
                        status: 'rechazado',
                        updatedAt: new Date(),
                        updatedBy: this.user.uid,
                        newHistoryEntry: {
                            timestamp: new Date(),
                            type: 'status',
                            userId: this.user.uid,
                            userName: this.user.displayName || this.user.email,
                            content: `Petición rechazada por dirección.`
                        }
                    };
                    await this.updateTicketStatus(ticketId, updates, bsModal);
                });
            }

            // Update Logic
            const btnUpdate = document.getElementById('btn-update-ticket');
            if (btnUpdate) {
                btnUpdate.addEventListener('click', async () => {
                    const updates = {
                        updatedAt: new Date(),
                        updatedBy: this.user.uid
                    };

                    let newHistoryEntries = [];

                    // Observation
                    const newObservation = document.getElementById('ticket-new-observation') ? document.getElementById('ticket-new-observation').value.trim() : null;
                    if (newObservation) {
                        newHistoryEntries.push({
                            timestamp: new Date(),
                            type: 'comment',
                            userId: this.user.uid,
                            userName: this.user.displayName || this.user.email,
                            content: newObservation
                        });
                    }

                    if (canEdit) {
                        const status = document.getElementById('ticket-status').value;
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

                        const assignedTo = document.getElementById('ticket-assigned').value;
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

                        updates.resolutionTime = parseInt(document.getElementById('ticket-time').value) || 0;
                        updates.totalCost = parseFloat(document.getElementById('ticket-cost').value) || 0;
                    }

                    if (newHistoryEntries.length > 0) {
                        updates.newHistoryEntries = newHistoryEntries;
                    }

                    if (Object.keys(updates).length > 2 || newHistoryEntries.length > 0) { // Just generic check
                        await this.updateTicketStatus(ticketId, updates, bsModal);
                    } else {
                        bsModal.hide();
                    }
                });
            }

            modal.addEventListener('hidden.bs.modal', () => modal.remove());
        };

        // Helper for update
        this.updateTicketStatus = async (ticketId, updates, modalInstance) => {
            try {
                await this.supabaseService.updateTicket('maintenance', ticketId, updates);
                UIHelpers.showToast('Incidencia actualizada', 'success');
                modalInstance.hide();
                await this.loadTicketsList();
            } catch (error) {
                console.error('Error updating ticket:', error);
                UIHelpers.showToast('Error al actualizar', 'error');
            }
        };

        this.render();
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header d-flex justify-content-between align-items-center">
                <div>
                    <h2><i class="fas fa-tools me-2"></i>Peticiones Mantenimiento</h2>
                    <p class="text-muted mb-0">Sistema de peticiones de mantenimiento</p>
                </div>
                <button id="btn-new-ticket-mnt" class="btn btn-primary">
                    <i class="fas fa-plus me-2"></i>Nueva Incidencia
                </button>
            </div>

            <div id="tickets-mnt-content" class="mt-4"></div>
        `;

        if (this.canManage) {
            const headerDiv = this.container.querySelector('.module-header');
            const buttonsDiv = document.createElement('div');
            buttonsDiv.innerHTML = `
                <button id="btn-view-reports-mnt" class="btn btn-outline-primary me-2">
                    <i class="fas fa-chart-bar me-1"></i>Reportes
                </button>
             `;
            // Insert before the new ticket button if possible, or append to header
            // The header structure is: div > div(title) + button(new ticket).
            // Let's re-render header or insert nicely.
            // Actually, re-rendering the whole header in the initial render is cleaner, 
            // but let's just replace the button part in the initial render string in previous step?
            // No, I can't change previous step easily. I'll modify the render method now.
        }

        // Re-injecting improved render method to include Reports button cleanly
        this.container.innerHTML = `
            <div class="module-header d-flex justify-content-between align-items-center">
                <div>
                    <h2><i class="fas fa-tools me-2"></i>Peticiones Mantenimiento</h2>
                    <p class="text-muted mb-0">Sistema de peticiones de mantenimiento</p>
                </div>
                <div>
                    ${this.canManage ? `
                        <button id="btn-view-reports-mnt" class="btn btn-outline-primary me-2">
                            <i class="fas fa-chart-bar me-1"></i>Reportes
                        </button>
                    ` : ''}
                    <button id="btn-new-ticket-mnt" class="btn btn-primary">
                        <i class="fas fa-plus me-2"></i>Nueva Petición
                    </button>
                </div>
            </div>

            <div id="tickets-mnt-content" class="mt-4"></div>
        `;

        document.getElementById('btn-new-ticket-mnt').addEventListener('click', () => this.showCreateTicketModal());

        if (this.canManage) {
            document.getElementById('btn-view-reports-mnt').addEventListener('click', () => this.toggleView());
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
        const container = document.getElementById('tickets-mnt-content');
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

            const tickets = await this.supabaseService.getTickets('maintenance', this.user.uid, this.userRoles, userDept);
            this.tickets = tickets;

            if (tickets.length === 0) {
                UIHelpers.showEmptyState(container, 'No hay peticiones de mantenimiento', 'tools');
                return;
            }

            // Group tickets by status for Kanban
            const validationTickets = tickets.filter(t => t.status === 'pendiente_validacion');
            const openTickets = tickets.filter(t => t.status === 'abierto');
            const inProgressTickets = tickets.filter(t => t.status === 'en_progreso');
            const completedTickets = tickets.filter(t => t.status === 'resuelto' || t.status === 'cerrado' || t.status === 'rechazado');

            container.innerHTML = `
                <div class="row g-3">
                    <div class="col-md-3">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-header bg-primary text-white fw-bold d-flex justify-content-between align-items-center">
                                <span><i class="fas fa-search me-2"></i>Por Validar</span>
                                <span class="badge bg-white text-primary rounded-pill">${validationTickets.length}</span>
                            </div>
                            <div class="card-body p-2" style="max-height: 70vh; overflow-y: auto;">
                                ${this.renderTicketsList(validationTickets, true)}
                            </div>
                        </div>
                    </div>

                    <div class="col-md-3">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-header bg-danger text-white fw-bold d-flex justify-content-between align-items-center">
                                <span><i class="fas fa-exclamation-circle me-2"></i>Abiertas</span>
                                <span class="badge bg-white text-danger rounded-pill">${openTickets.length}</span>
                            </div>
                            <div class="card-body p-2" style="max-height: 70vh; overflow-y: auto;">
                                ${this.renderTicketsList(openTickets)}
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-3">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-header bg-warning text-dark fw-bold d-flex justify-content-between align-items-center">
                                <span><i class="fas fa-spinner me-2"></i>En Progreso</span>
                                <span class="badge bg-white text-dark rounded-pill">${inProgressTickets.length}</span>
                            </div>
                            <div class="card-body p-2" style="max-height: 70vh; overflow-y: auto;">
                                ${this.renderTicketsList(inProgressTickets)}
                            </div>
                        </div>
                    </div>

                    <div class="col-md-3">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-header bg-success text-white fw-bold d-flex justify-content-between align-items-center">
                                <span><i class="fas fa-check-circle me-2"></i>Finalizadas</span>
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
            console.error('Error loading maintenance tickets:', error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar las peticiones</div>';
        }
    }

    renderTicketsList(tickets, isPending = false) {
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
                    <a href="#" class="list-group-item list-group-item-action ticket-item priority-${ticket.priority} ${isDisabled ? 'bg-light text-muted opacity-75' : ''}" 
                        onclick="event.preventDefault(); ${isDisabled ? '' : `window.viewTicketMaintenance('${ticket.id}')`}"
                        ${isDisabled ? 'style="pointer-events: none; cursor: default;"' : ''}>
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center mb-2">
                                    <span class="badge bg-secondary me-2">${ticket.ticketNumber}</span>
                                    <h6 class="mb-0">${UIHelpers.escapeHtml(ticket.title)}</h6>
                                </div>
                                <p class="mb-1 text-muted small">${UIHelpers.escapeHtml(ticket.description)}</p>
                                <div class="small text-muted">
                                    <i class="fas fa-map-marker-alt me-1"></i>${UIHelpers.escapeHtml(ticket.location || 'Sin ubicación')} 
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-user me-1"></i>${UIHelpers.escapeHtml(ticket.requestedByName)}
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-building me-1"></i>${UIHelpers.escapeHtml((this.deptMap && this.deptMap[ticket.requestedByDepartment]) || ticket.requestedByDepartment || 'Sin departamento')}
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-clock me-1"></i>${UIHelpers.formatDate(ticket.createdAt)}
                                    ${ticket.assignedTo ? `<span class="mx-2">•</span><i class="fas fa-user-check text-primary me-1"></i>${UIHelpers.escapeHtml(this.usersMap[ticket.assignedTo] || 'Asignado')}` : ''}
                                </div>
                            </div>
                            <div class="text-end ms-3">
                                ${UIHelpers.getStatusBadge(ticket.status)}
                                ${UIHelpers.getPriorityBadge(ticket.priority)}
                            </div>
                        </div>
                    </a>
                `}).join('')}
            </div>
        `;
    }

    showCreateTicketModal() {
        // Fetch all users only if this user can manage (manager role) to populate the dropdown
        // Note: For maintenance, 'canManage' is 'equipo_mantenimiento'. 
        // We probably also want 'equipo_directivo' or 'director' or 'jefe_departamento' to be able to create for others?
        // Requirement says "Una persona del equipo", implying 'equipo_mantenimiento'.
        // Assuming 'canManage' here is enough.
        this.openCreateModal();
    }

    async openCreateModal() {
        const users = this.canManage ? await this.supabaseService.getAllUsers() : [];

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-tools me-2"></i>Nueva Petición Mantenimiento</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-ticket-mnt">
                            ${this.canManage ? `
                                <div class="mb-3">
                                    <label class="form-label bg-warning-subtle px-2 py-1 rounded">Solicitante (Modo Gestión)</label>
                                    <select class="form-select" id="ticket-mnt-requester">
                                        ${users.map(u => `<option value="${u.uid}" ${u.uid === this.user.uid ? 'selected' : ''}>${UIHelpers.escapeHtml(u.displayName || u.email)} (${UIHelpers.escapeHtml(u.department || 'Sin Dept')})</option>`).join('')}
                                    </select>
                                </div>
                            ` : ''}
                            <div class="mb-3">
                                <label class="form-label">Título *</label>
                                <input type="text" class="form-control" id="ticket-mnt-title" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Descripción del problema *</label>
                                <textarea class="form-control" id="ticket-mnt-description" rows="4" required></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Ubicación *</label>
                                <input type="text" class="form-control" id="ticket-mnt-location" placeholder="Ej: Aula 201, Pasillo 1er piso" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Prioridad</label>
                                <select class="form-select" id="ticket-mnt-priority">
                                    <option value="baja">Baja</option>
                                    <option value="normal" selected>Normal</option>
                                    <option value="alta">Alta</option>
                                    <option value="urgente">Urgente</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-ticket-mnt">Crear Incidencia</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-save-ticket-mnt').addEventListener('click', async () => {
            const title = document.getElementById('ticket-mnt-title').value;
            const description = document.getElementById('ticket-mnt-description').value;
            const location = document.getElementById('ticket-mnt-location').value;
            const priority = document.getElementById('ticket-mnt-priority').value;

            if (!title || !description || !location) {
                UIHelpers.showToast('Por favor completa todos los campos', 'error');
                return;
            }

            let targetUserId = this.user.uid;
            let targetUserName = this.user.displayName || this.user.email.split('@')[0];
            let targetUserDept = null;

            if (this.canManage) {
                const requesterSelect = document.getElementById('ticket-mnt-requester');
                if (requesterSelect) {
                    const selectedUid = requesterSelect.value;
                    const selectedUser = users.find(u => u.uid === selectedUid);
                    if (selectedUser) {
                        targetUserId = selectedUser.uid;
                        targetUserName = selectedUser.displayName || selectedUser.email.split('@')[0];
                        targetUserDept = selectedUser.department;
                    }
                }
            } else {
                const userData = (await this.supabaseService.getAllUsers()).find(u => u.uid === this.user.uid);
                targetUserDept = userData?.department || 'Sin departamento';
            }

            if (!targetUserDept && !this.canManage) {
                const u = await this.supabaseService.getUser(targetUserId);
                targetUserDept = u?.department || 'Sin departamento';
            }

            try {
                const result = await this.supabaseService.createTicket({
                    type: 'maintenance',
                    title,
                    description,
                    location,
                    priority,
                    // Maintenance tickets start as 'pendiente_validacion' by default in createTicket service,
                    // but we can enforce it or assume service handles it. Service handles it.
                    // IMPORTANT: 'department' field is used for filtering.
                    department: targetUserDept || 'Sin departamento',
                    requestedBy: targetUserId,
                    requestedByName: targetUserName,
                    requestedByDepartment: targetUserDept || 'Sin departamento'
                });

                UIHelpers.showToast(`Petición ${result.ticketNumber} creada correctamente`, 'success');
                bsModal.hide();
                await this.loadTicketsList();
            } catch (error) {
                console.error('Error creating maintenance ticket:', error);
                UIHelpers.showToast('Error al crear la incidencia', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async loadReports() {
        const container = document.getElementById('tickets-mnt-content');
        container.innerHTML = `
            <div class="d-flex justify-content-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
            </div>
        `;

        try {
            // Fetch tickets using getTickets which respects roles, but for reports manager needs stats
            // Manager role is 'equipo_mantenimiento'. They see all.
            // Fetch tickets and departments
            const [allTickets, departments] = await Promise.all([
                this.supabaseService.getTickets('maintenance', this.user.uid, this.userRoles),
                this.supabaseService.getAllDepartments()
            ]);

            // Create Department Map
            const deptMap = {};
            departments.forEach(d => deptMap[d.id] = d.name);

            const schoolYearStart = UIHelpers.getSchoolYearStart();
            const tickets = allTickets.filter(t => {
                const date = t.createdAt instanceof Date ? t.createdAt : (t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt));
                return date >= schoolYearStart;
            });

            if (tickets.length === 0) {
                UIHelpers.showEmptyState(container, `No hay datos para el curso ${UIHelpers.getSchoolYearLabel()}`, 'chart-bar');
                return;
            }

            // We can reuse calculateStats from service if it's generic enough, but it was tailored for TIC.
            // Let's implement specific stats here or verify calculateStats compatibility.
            // calculateStats in FirebaseService returns { total, open, resolved, avgResolutionTime, totalCost, byDepartment, byUser }
            // Maintenance tickets also have costs (laborCost, materialCost -> totalCost).
            // So we can reuse it!
            const stats = this.supabaseService.calculateStats(tickets, 'maintenance', deptMap);

            container.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                     <h4 class="mb-0">Reporte Curso Escolar ${UIHelpers.getSchoolYearLabel()}</h4>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-md-3">
                        <div class="card text-white bg-primary h-100">
                            <div class="card-body">
                                <h6>Total Peticiones</h6>
                                <h2 class="mb-0">${stats.total}</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-danger h-100">
                            <div class="card-body">
                                <h6>Abiertos</h6>
                                <h2 class="mb-0">${stats.open}</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-success h-100">
                            <div class="card-body">
                                <h6>Resueltos</h6>
                                <h2 class="mb-0">${stats.resolved}</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-info h-100">
                            <div class="card-body">
                                <h6>Coste Total</h6>
                                <h2 class="mb-0">${UIHelpers.formatCurrency(stats.totalCost)}</h2>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-md-6">
                        <div class="card h-100">
                            <div class="card-header">
                                <h5 class="mb-0">Peticiones por Departamento</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="chart-by-department"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card h-100">
                            <div class="card-header">
                                <h5 class="mb-0">Top Usuarios</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="chart-by-user"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                 <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">Detalle por Departamento</h5>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-striped">
                                <thead>
                                    <tr>
                                        <th>Departamento</th>
                                        <th>Nº Peticiones</th>
                                        <th>Tiempo Total</th>
                                        <th>Coste Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(stats.byDepartment).map(([dept, data]) => `
                                        <tr>
                                            <td>${dept}</td>
                                            <td>${data.count}</td>
                                            <td>${UIHelpers.formatDuration(data.totalTime)}</td>
                                            <td>${UIHelpers.formatCurrency(data.totalCost)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            this.createCharts(stats);

        } catch (error) {
            console.error('Error calculating reports:', error);
            container.innerHTML = '<div class="alert alert-danger">Error al generar reportes</div>';
        }
    }

    createCharts(stats) {
        // Department chart
        const deptLabels = Object.keys(stats.byDepartment);
        const deptData = Object.values(stats.byDepartment).map(d => d.count);

        new Chart(document.getElementById('chart-by-department'), {
            type: 'bar',
            data: {
                labels: deptLabels,
                datasets: [{
                    label: 'Peticiones',
                    data: deptData,
                    backgroundColor: 'rgba(13, 110, 253, 0.6)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        // User chart
        const userEntries = Object.entries(stats.byUser).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
        const userLabels = userEntries.map(([name]) => name);
        const userData = userEntries.map(([, data]) => data.count);

        new Chart(document.getElementById('chart-by-user'), {
            type: 'bar',
            data: {
                labels: userLabels,
                datasets: [{
                    label: 'Peticiones',
                    data: userData,
                    backgroundColor: 'rgba(255, 193, 7, 0.6)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y'
            }
        });
    }

    destroy() {
        delete window.updateTicketStatus;
        delete window.approveTicket;
        delete window.rejectTicket;
    }
}
