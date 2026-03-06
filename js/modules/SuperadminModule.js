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
                <li class="nav-item">
                    <button class="nav-link" id="audit-tab" data-bs-toggle="tab" data-bs-target="#audit-content" type="button">
                        <i class="fas fa-list-alt me-2"></i>Auditoría Global
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

                <!-- Global Audit Tab -->
                <div class="tab-pane fade" id="audit-content">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="card-title fw-bold">Registro Global de Actividad</h5>
                                <button class="btn btn-sm btn-outline-secondary" id="btn-refresh-audit">
                                    <i class="fas fa-sync-alt me-2"></i>Refrescar
                                </button>
                            </div>
                            <div class="table-responsive" id="audit-table-container">
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
        document.getElementById('audit-tab').addEventListener('shown.bs.tab', () => this.loadAuditLogs());

        document.getElementById('btn-refresh-institutes').addEventListener('click', () => this.loadInstitutes());
        document.getElementById('btn-add-superadmin').addEventListener('click', () => this.openAddSuperAdminModal());
        document.getElementById('btn-refresh-audit').addEventListener('click', () => this.loadAuditLogs());

        // Initial Load
        this.loadInstitutes();
    }

    // ... (keep loadInstitutes, renderInstitutesTable, handleDeleteInstitute, openInstituteUsersModal, openRoleEditorModal, updateStatus, loadSuperAdmins, renderSuperAdminsTable, openAddSuperAdminModal, toggleSuperAdmin)

    // ==================== AUDIT ====================

    async loadAuditLogs() {
        const container = document.getElementById('audit-table-container');
        if (!container) return;

        // Simple pagination state (could be class property)
        if (!this.auditPagination) {
            this.auditPagination = { pageSize: 50, cursor: null };
        }

        container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></div>';

        try {
            const { logs } = await this.supabaseService.getGlobalLoginLogs(this.auditPagination.pageSize);

            if (logs.length === 0) {
                container.innerHTML = '<div class="alert alert-info">No hay registros de actividad recientes.</div>';
                return;
            }

            container.innerHTML = `
                <table class="table table-sm table-striped table-hover small">
                    <thead class="table-light">
                        <tr>
                            <th>Fecha</th>
                            <th>Instituto</th>
                            <th>Usuario</th>
                            <th>Email</th>
                            <th>Tipo</th>
                            <th>Detalle</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => {
                const date = log.timestamp ? new Date(log.timestamp) : new Date();
                const isSuccess = log.type === 'success';
                const badge = isSuccess
                    ? '<span class="badge bg-success">Exitoso</span>'
                    : '<span class="badge bg-danger">Fallido</span>';

                const instName = log.institutes?.name || 'Desconocido';

                return `
                                <tr>
                                    <td>${date.toLocaleString()}</td>
                                    <td><span class="badge bg-secondary">${UIHelpers.escapeHtml(instName)}</span></td>
                                    <td>${UIHelpers.escapeHtml(log.name || '-')}</td>
                                    <td>${UIHelpers.escapeHtml(log.email || '-')}</td>
                                    <td>${badge}</td>
                                    <td>${UIHelpers.escapeHtml(log.reason) || (isSuccess ? 'Login correcto' : '-')}</td>
                                </tr>
                            `;
            }).join('')}
                    </tbody>
                </table>
                <div class="text-center mt-3">
                    <small class="text-muted">Mostrando los últimos registros (Límite: ${this.auditPagination.pageSize})</small>
                </div>
            `;
        } catch (error) {
            console.error(error);
            container.innerHTML = `<div class="alert alert-danger">Error al cargar registros: ${error.message}</div>`;
        }
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
                                    <button class="btn btn-sm btn-info text-white ms-2 btn-users-inst" data-id="${inst.id}" data-name="${UIHelpers.escapeHtml(inst.name)}">
                                        <i class="fas fa-users-cog"></i> Usuarios
                                    </button>
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
        container.querySelectorAll('.btn-users-inst').forEach(btn => {
            btn.addEventListener('click', () => this.openInstituteUsersModal(btn.dataset.id, btn.dataset.name));
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

    async openInstituteUsersModal(instituteId, instituteName) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Gestión de Usuarios - ${instituteName}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div class="table-responsive" id="inst-users-container">
                           <div class="text-center py-5">
                                <div class="spinner-border text-primary" role="status"></div>
                           </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        modal.addEventListener('hidden.bs.modal', () => modal.remove());

        try {
            const members = await this.supabaseService.getInstituteMembersAdmin(instituteId);
            const container = document.getElementById('inst-users-container');

            if (members.length === 0) {
                container.innerHTML = '<div class="p-4 text-center text-muted">No hay usuarios en este instituto.</div>';
                return;
            }

            const renderTable = () => {
                container.innerHTML = `
                    <table class="table table-striped table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Usuario</th>
                                <th>Email</th>
                                <th>Roles</th>
                                <th class="text-end">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${members.map(m => `
                                <tr>
                                    <td class="fw-bold">${UIHelpers.escapeHtml(m.displayName || 'Sin nombre')}</td>
                                    <td>${UIHelpers.escapeHtml(m.email)}</td>
                                    <td>
                                        ${(m.roles || []).map(r => `<span class="badge bg-secondary me-1">${r}</span>`).join('') || '<span class="text-muted small">Sin roles</span>'}
                                    </td>
                                    <td class="text-end">
                                        <button class="btn btn-sm btn-outline-primary btn-edit-roles" data-uid="${m.uid}">
                                            <i class="fas fa-edit"></i> Roles
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                container.querySelectorAll('.btn-edit-roles').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const uid = btn.dataset.uid;
                        const member = members.find(m => m.uid === uid);
                        this.openRoleEditorModal(member, instituteId, () => {
                            // Reload members to refresh table
                            this.supabaseService.getInstituteMembersAdmin(instituteId).then(newMembers => {
                                members.splice(0, members.length, ...newMembers);
                                renderTable();
                            });
                        });
                    });
                });
            };

            renderTable();

        } catch (error) {
            console.error(error);
            document.getElementById('inst-users-container').innerHTML = `<div class="alert alert-danger m-3">Error al cargar usuarios: ${error.message}</div>`;
        }
    }

    openRoleEditorModal(user, instituteId, onSuccess) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        // Reuse the exact same UI structure as AdminModule for consistency
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Editar Roles - ${UIHelpers.escapeHtml(user.displayName || user.email)}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                         <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="sa-role-admin" value="admin"
                                ${user.roles?.includes('admin') ? 'checked' : ''}>
                            <label class="form-check-label fw-bold text-danger" for="sa-role-admin">
                                Administrador del Instituto
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="sa-role-jefe" value="jefe_departamento" 
                                ${user.roles?.includes('jefe_departamento') ? 'checked' : ''}>
                            <label class="form-check-label" for="sa-role-jefe">Jefe de Departamento</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="sa-role-tic" value="equipo_tic"
                                ${user.roles?.includes('equipo_tic') ? 'checked' : ''}>
                            <label class="form-check-label" for="sa-role-tic">Equipo TIC</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="sa-role-mnt" value="equipo_mantenimiento"
                                ${user.roles?.includes('equipo_mantenimiento') ? 'checked' : ''}>
                            <label class="form-check-label" for="sa-role-mnt">Equipo Mantenimiento</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="sa-role-3d" value="equipo_3d"
                                ${user.roles?.includes('equipo_3d') ? 'checked' : ''}>
                            <label class="form-check-label" for="sa-role-3d">Equipo Impresión 3D</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="sa-role-dual" value="equipo_dual"
                                ${user.roles?.includes('equipo_dual') ? 'checked' : ''}>
                            <label class="form-check-label" for="sa-role-dual">Equipo Dual</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="sa-role-dir" value="equipo_directivo"
                                ${user.roles?.includes('equipo_directivo') ? 'checked' : ''}>
                            <label class="form-check-label" for="sa-role-dir">Equipo Directivo</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="sa-role-director" value="director"
                                ${user.roles?.includes('director') ? 'checked' : ''}>
                            <label class="form-check-label" for="sa-role-director">Director/a</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="sa-role-tester" value="tester"
                                ${user.roles?.includes('tester') ? 'checked' : ''}>
                            <label class="form-check-label" for="sa-role-tester">Tester (Beta)</label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-roles">Guardar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        modal.addEventListener('hidden.bs.modal', () => modal.remove());

        document.getElementById('btn-save-roles').addEventListener('click', async () => {
            const roles = [];
            if (document.getElementById('sa-role-admin').checked) roles.push('admin');
            if (document.getElementById('sa-role-jefe').checked) roles.push('jefe_departamento');
            if (document.getElementById('sa-role-tic').checked) roles.push('equipo_tic');
            if (document.getElementById('sa-role-mnt').checked) roles.push('equipo_mantenimiento');
            if (document.getElementById('sa-role-3d').checked) roles.push('equipo_3d');
            if (document.getElementById('sa-role-dual').checked) roles.push('equipo_dual');
            if (document.getElementById('sa-role-dir').checked) roles.push('equipo_directivo');
            if (document.getElementById('sa-role-director').checked) roles.push('director');
            if (document.getElementById('sa-role-tester').checked) roles.push('tester');

            try {
                await this.supabaseService.updateMemberRolesAdmin(instituteId, user.uid, roles);
                UIHelpers.showToast('Roles actualizados', 'success');
                bsModal.hide();
                if (onSuccess) onSuccess();
            } catch (e) {
                console.error(e);
                UIHelpers.showToast('Error: ' + e.message, 'error');
            }
        });
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
