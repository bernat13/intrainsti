import { UIHelpers } from '../UIHelpers.js';

export class SuperadminModule {
    constructor(container, supabaseService, user) {
        this.container = container;
        this.supabaseService = supabaseService;
        this.user = user;

        this.institutes = [];
        this.superAdmins = [];

        this.render();
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header bg-dark text-white p-4 rounded mb-4">
                <h2><i class="fas fa-user-shield me-2"></i>Panel de Superadministrador</h2>
                <p class="text-white-50">Gestión global de institutos y administradores del sistema</p>
            </div>

            <ul class="nav nav-tabs mb-4" id="superadminTabs" role="tablist">
                <li class="nav-item">
                    <button class="nav-link active" id="institutes-tab" data-bs-toggle="tab" data-bs-target="#institutes-content" type="button">
                        <i class="fas fa-university me-2"></i>Institutos
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" id="admins-tab" data-bs-toggle="tab" data-bs-target="#admins-content" type="button">
                        <i class="fas fa-users-cog me-2"></i>Superadmins
                    </button>
                </li>
            </ul>

            <div class="tab-content">
                <!-- Institutes Tab -->
                <div class="tab-pane fade show active" id="institutes-content">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="card-title fw-bold">Listado de Institutos</h5>
                                <button class="btn btn-outline-primary btn-sm" id="btn-refresh-institutes">
                                    <i class="fas fa-sync-alt"></i> Actualizar
                                </button>
                            </div>
                            <div class="table-responsive" id="institutes-table-container">
                                <div class="text-center py-5">
                                    <div class="spinner-border text-primary" role="status"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Superadmins Tab -->
                <div class="tab-pane fade" id="admins-content">
                    <div class="card shadow-sm">
                        <div class="card-body">
                             <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="card-title fw-bold">Gestionar Superadministradores</h5>
                                <button class="btn btn-success btn-sm" id="btn-add-superadmin">
                                    <i class="fas fa-plus me-2"></i>Añadir Superadmin
                                </button>
                            </div>
                            <div class="table-responsive" id="superadmins-table-container">
                                <div class="text-center py-5">
                                    <div class="spinner-border text-primary" role="status"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Bind events
        document.getElementById('institutes-tab').addEventListener('shown.bs.tab', () => this.loadInstitutes());
        document.getElementById('admins-tab').addEventListener('shown.bs.tab', () => this.loadSuperAdmins());

        document.getElementById('btn-refresh-institutes').addEventListener('click', () => this.loadInstitutes());
        document.getElementById('btn-add-superadmin').addEventListener('click', () => this.openAddSuperAdminModal());

        // Initial Load
        this.loadInstitutes();
    }

    async loadInstitutes() {
        const container = document.getElementById('institutes-table-container');
        try {
            this.institutes = await this.supabaseService.getAllInstitutesAdmin();
            this.renderInstitutesTable();
        } catch (error) {
            console.error(error);
            container.innerHTML = `<div class="alert alert-danger">Error al cargar institutos: ${error.message}</div>`;
        }
    }

    renderInstitutesTable() {
        const container = document.getElementById('institutes-table-container');
        if (this.institutes.length === 0) {
            UIHelpers.showEmptyState(container, 'No hay institutos registrados');
            return;
        }

        container.innerHTML = `
            <table class="table table-hover align-middle">
                <thead>
                    <tr>
                        <th>Estado</th>
                        <th>Nombre</th>
                        <th>Admin Email</th>
                        <th>Usuarios</th>
                        <th>Fecha Registro</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.institutes.map(inst => {
            let statusBadge = '';
            switch (inst.status) {
                case 'active': statusBadge = '<span class="badge bg-success">Activo</span>'; break;
                case 'pending': statusBadge = '<span class="badge bg-warning text-dark">Pendiente</span>'; break;
                case 'suspended': statusBadge = '<span class="badge bg-danger">Suspendido</span>'; break;
                default: statusBadge = `<span class="badge bg-secondary">${inst.status}</span>`;
            }

            return `
                            <tr>
                                <td>${statusBadge}</td>
                                <td class="fw-bold">${UIHelpers.escapeHtml(inst.name)}</td>
                                <td>${UIHelpers.escapeHtml(inst.admin_email)}</td>
                                <td>${inst.userCount || 0}</td>
                                <td>${UIHelpers.formatDate(inst.created_at)}</td>
                                <td>
                                    ${inst.status === 'pending' ? `
                                        <button class="btn btn-sm btn-success btn-validate-inst" data-id="${inst.id}">
                                            <i class="fas fa-check"></i> Validar
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger btn-reject-inst" data-id="${inst.id}">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    ` : inst.status === 'active' ? `
                                        <button class="btn btn-sm btn-outline-warning btn-suspend-inst" data-id="${inst.id}">
                                            <i class="fas fa-ban"></i> Suspender
                                        </button>
                                    ` : `
                                        <button class="btn btn-sm btn-outline-success btn-reactivate-inst" data-id="${inst.id}">
                                            <i class="fas fa-undo"></i> Reactivar
                                        </button>
                                    `}
                                    <button class="btn btn-sm btn-danger ms-2 btn-delete-inst" data-id="${inst.id}" title="Eliminar definitivamente">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        `;

        // Bind Action Buttons
        container.querySelectorAll('.btn-validate-inst').forEach(btn => {
            btn.addEventListener('click', () => this.updateStatus(btn.dataset.id, 'active'));
        });
        container.querySelectorAll('.btn-reject-inst').forEach(btn => {
            btn.addEventListener('click', () => this.updateStatus(btn.dataset.id, 'rejected'));
        });
        container.querySelectorAll('.btn-suspend-inst').forEach(btn => {
            btn.addEventListener('click', () => this.updateStatus(btn.dataset.id, 'suspended'));
        });
        container.querySelectorAll('.btn-reactivate-inst').forEach(btn => {
            btn.addEventListener('click', () => this.updateStatus(btn.dataset.id, 'active'));
        });
        container.querySelectorAll('.btn-delete-inst').forEach(btn => {
            btn.addEventListener('click', () => this.handleDeleteInstitute(btn.dataset.id));
        });
    }

    async handleDeleteInstitute(id) {
        if (!await UIHelpers.confirm('¿ATENCIÓN: Estás a punto de ELIMINAR este instituto y TODOS sus datos (usuarios, tickets, historial)?\n\nEsta acción NO se puede deshacer.')) return;

        try {
            await this.supabaseService.deleteInstitute(id); // Ensure this method exists in Service
            UIHelpers.showToast('Instituto eliminado correctamente', 'success');
            this.loadInstitutes();
        } catch (error) {
            console.error(error);
            UIHelpers.showToast('Error al eliminar: ' + error.message, 'error');
        }
    }

    async updateStatus(id, newStatus) {
        if (!await UIHelpers.confirm(`¿Cambiar estado del instituto a "${newStatus}"?`)) return;

        try {
            await this.supabaseService.updateInstituteStatus(id, newStatus);
            UIHelpers.showToast('Estado actualizado', 'success');
            this.loadInstitutes();
        } catch (error) {
            console.error(error);
            UIHelpers.showToast('Error al actualizar estado', 'error');
        }
    }

    // ==================== SUPERADMINS ====================

    async loadSuperAdmins() {
        const container = document.getElementById('superadmins-table-container');
        try {
            this.superAdmins = await this.supabaseService.getSuperAdmins();
            this.renderSuperAdminsTable();
        } catch (error) {
            console.error(error);
            container.innerHTML = `<div class="alert alert-danger">Error al cargar superadmins</div>`;
        }
    }

    renderSuperAdminsTable() {
        const container = document.getElementById('superadmins-table-container');
        container.innerHTML = `
            <table class="table table-hover align-middle">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Email</th>
                        <th>Último Acceso</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.superAdmins.map(u => `
                        <tr>
                            <td>
                                <div class="d-flex align-items-center">
                                    <div class="bg-primary text-white rounded-circle me-2 d-flex align-items-center justify-content-center" style="width:32px;height:32px;">
                                        ${(u.display_name || u.email || '?')[0].toUpperCase()}
                                    </div>
                                    <span class="fw-bold">${UIHelpers.escapeHtml(u.display_name || 'Sin nombre')}</span>
                                </div>
                            </td>
                            <td>${UIHelpers.escapeHtml(u.email)}</td>
                            <td>${UIHelpers.formatDate(u.last_login)}</td>
                            <td>
                                ${u.email === this.user.email ? '<span class="badge bg-secondary">Tú</span>' : `
                                    <button class="btn btn-sm btn-outline-danger btn-remove-super" data-email="${u.email}">
                                        <i class="fas fa-trash"></i> Eliminar
                                    </button>
                                `}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
         `;

        container.querySelectorAll('.btn-remove-super').forEach(btn => {
            btn.addEventListener('click', () => this.toggleSuperAdmin(btn.dataset.email, false));
        });
    }

    openAddSuperAdminModal() {
        const email = prompt("Introduce el email del usuario a promover a Superadmin:");
        if (email) {
            this.toggleSuperAdmin(email, true);
        }
    }

    async toggleSuperAdmin(email, isSuper) {
        if (!email) return;
        const action = isSuper ? "promover" : "revocar permisos a";
        if (!await UIHelpers.confirm(`¿Seguro que quieres ${action} ${email}?`)) return;

        try {
            await this.supabaseService.setSuperAdmin(email, isSuper);
            UIHelpers.showToast(`Permisos de Superadmin ${isSuper ? 'concedidos' : 'revocados'}`, 'success');
            this.loadSuperAdmins();
        } catch (error) {
            console.error(error);
            UIHelpers.showToast(error.message || 'Error al actualizar permisos', 'error');
        }
    }
}
