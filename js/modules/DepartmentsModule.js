import { UIHelpers } from '../UIHelpers.js';

export class DepartmentsModule {
    constructor(container, supabaseService, user, isAdmin) {
        this.container = container;
        this.supabaseService = supabaseService;
        this.user = user;
        this.isAdmin = isAdmin;

        // Check permission: Admin only
        if (!this.isAdmin) {
            this.container.innerHTML = '<div class="alert alert-danger">Acceso denegado. Solo administradores.</div>';
            return;
        }

        this.departments = [];
        this.users = [];

        this.render();
    }

    async render() {
        this.container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2><i class="fas fa-building me-2"></i>Gestión de Departamentos</h2>
                <button class="btn btn-primary" id="btn-new-dept">
                    <i class="fas fa-plus me-2"></i>Nuevo Departamento
                </button>
            </div>
            <div id="departments-list-container" class="position-relative">
                <!-- Loading or List -->
            </div>
        `;

        document.getElementById('btn-new-dept').addEventListener('click', () => this.showEditModal());

        this.loadDepartments();
    }

    async loadDepartments() {
        const container = document.getElementById('departments-list-container');
        UIHelpers.showLoading(container);

        try {
            const [departments, users] = await Promise.all([
                this.supabaseService.getAllDepartments(),
                this.supabaseService.getAllUsers()
            ]);

            this.departments = departments;
            this.users = users;

            this.renderList(container);
        } catch (error) {
            console.error('Error loading departments:', error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar datos</div>';
        }
    }

    renderList(container) {
        if (this.departments.length === 0) {
            UIHelpers.showEmptyState(container, 'No hay departamentos registrados', 'building');
            return;
        }

        container.innerHTML = `
            <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
                ${this.departments.map(dept => {
            const memberCount = this.users.filter(u => u.department === dept.id).length;
            return `
                        <div class="col">
                            <div class="card h-100 shadow-sm ${!dept.active ? 'bg-light text-muted border-secondary' : ''}">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-start mb-2">
                                        <h5 class="card-title fw-bold mb-0 text-truncate" title="${UIHelpers.escapeHtml(dept.name)}">
                                            ${UIHelpers.escapeHtml(dept.name)}
                                        </h5>
                                        ${!dept.active ? '<span class="badge bg-secondary">Inactivo</span>' : ''}
                                    </div>
                                    <p class="text-muted small mb-2">${UIHelpers.escapeHtml(dept.code || 'Sin código')}</p>
                                    
                                    <div class="d-flex align-items-center mb-3">
                                        <i class="fas fa-users me-2 text-primary"></i>
                                        <span class="fw-bold fs-5 me-1">${memberCount}</span>
                                        <span class="text-muted small">miembros</span>
                                    </div>

                                    <button class="btn btn-outline-primary w-100 btn-edit-dept" data-id="${dept.id}">
                                        <i class="fas fa-edit me-2"></i>Editar y Miembros
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;

        container.querySelectorAll('.btn-edit-dept').forEach(btn => {
            btn.addEventListener('click', () => {
                const dept = this.departments.find(d => d.id === btn.dataset.id);
                this.showEditModal(dept);
            });
        });
    }

    showEditModal(department = null) {
        const isEdit = !!department;
        const modalId = 'modal-dept-edit';

        // Remove existing if any
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = modalId;
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${isEdit ? 'Editar Departamento' : 'Nuevo Departamento'}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="dept-form" class="mb-4">
                            <div class="row g-3">
                                <div class="col-md-8">
                                    <label class="form-label">Nombre</label>
                                    <input type="text" class="form-control" id="dept-name" value="${UIHelpers.escapeHtml(department?.name || '')}" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Código</label>
                                    <input type="text" class="form-control" id="dept-code" value="${UIHelpers.escapeHtml(department?.code || '')}">
                                </div>
                            </div>
                            <div class="form-check mt-3">
                                <input class="form-check-input" type="checkbox" id="dept-active" ${!department || department.active ? 'checked' : ''}>
                                <label class="form-check-label" for="dept-active">Departamento Activo</label>
                            </div>
                        </form>

                        ${isEdit ? `
                            <hr>
                            <h6 class="fw-bold mb-3">Miembros del Departamento</h6>
                            
                            <div class="input-group mb-3">
                                <select class="form-select" id="select-add-member">
                                    <option value="">Seleccionar usuario para añadir...</option>
                                    <!-- Options filled dynamically -->
                                </select>
                                <button class="btn btn-success" id="btn-add-member" type="button">
                                    <i class="fas fa-plus"></i> Añadir
                                </button>
                            </div>

                            <div class="list-group" id="dept-members-list">
                                <!-- Members filled dynamically -->
                            </div>
                        ` : '<div class="alert alert-info">Guarda el departamento para gestionar sus miembros.</div>'}
                    </div>
                    <div class="modal-footer justify-content-between">
                        ${isEdit ? `
                            <button type="button" class="btn btn-outline-danger" id="btn-delete-dept">
                                <i class="fas fa-trash me-2"></i>Eliminar (Desactivar)
                            </button>
                        ` : '<div></div>'}
                        <div>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="btn-save-dept">
                                ${isEdit ? 'Guardar Cambios' : 'Crear Departamento'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        if (isEdit) {
            this.renderMembersList(department.id);
            this.populateAddMemberSelect(department.id);

            document.getElementById('btn-add-member').addEventListener('click', async () => {
                const select = document.getElementById('select-add-member');
                const userId = select.value;
                if (!userId) return;

                try {
                    await this.supabaseService.updateUserDepartment(userId, department.id);
                    // Refresh users locally for UI speed or reload all?
                    // Better verify by reloading users list
                    // For simplicity, let's update local user object and re-render
                    const user = this.users.find(u => u.uid === userId);
                    if (user) user.department = department.id;

                    this.renderMembersList(department.id);
                    this.populateAddMemberSelect(department.id);
                    UIHelpers.showToast('Miembro añadido', 'success');
                    this.renderList(document.getElementById('departments-list-container')); // update count in main list
                } catch (e) {
                    console.error(e);
                    UIHelpers.showToast('Error al añadir miembro', 'error');
                }
            });

            document.getElementById('btn-delete-dept').addEventListener('click', async () => {
                if (await UIHelpers.confirm('¿Seguro que quieres eliminar (desactivar) este departamento?')) {
                    await this.supabaseService.deleteDepartment(department.id);
                    bsModal.hide();
                    this.loadDepartments();
                    UIHelpers.showToast('Departamento eliminado', 'success');
                }
            });
        }

        document.getElementById('btn-save-dept').addEventListener('click', async () => {
            const name = document.getElementById('dept-name').value;
            const code = document.getElementById('dept-code').value;
            const active = document.getElementById('dept-active').checked;

            if (!name) {
                UIHelpers.showToast('El nombre es obligatorio', 'warning');
                return;
            }

            try {
                if (isEdit) {
                    await this.supabaseService.updateDepartment(department.id, { name, code, active });
                    // Update local
                    department.name = name;
                    department.code = code;
                    department.active = active;
                } else {
                    await this.supabaseService.createDepartment({ name, code, active });
                }
                bsModal.hide();
                this.loadDepartments();
                UIHelpers.showToast('Departamento guardado', 'success');
            } catch (e) {
                console.error(e);
                UIHelpers.showToast('Error al guardar', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    renderMembersList(deptId) {
        const list = document.getElementById('dept-members-list');
        const members = this.users.filter(u => u.department === deptId);

        if (members.length === 0) {
            list.innerHTML = '<div class="text-center text-muted p-3">No hay miembros asignados</div>';
            return;
        }

        list.innerHTML = members.map(user => `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <div class="fw-bold">${UIHelpers.escapeHtml(user.displayName || user.email)}</div>
                    <div class="small text-muted">${UIHelpers.escapeHtml(user.email)}</div>
                </div>
                <button class="btn btn-sm btn-outline-danger btn-remove-member" data-uid="${user.uid}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        list.querySelectorAll('.btn-remove-member').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (await UIHelpers.confirm('¿Quitar a este usuario del departamento?')) {
                    const uid = btn.dataset.uid;
                    try {
                        await this.supabaseService.updateUserDepartment(uid, null);
                        // Update local
                        const user = this.users.find(u => u.uid === uid);
                        if (user) user.department = null;

                        this.renderMembersList(deptId);
                        this.populateAddMemberSelect(deptId);
                        UIHelpers.showToast('Miembro eliminado', 'success');
                        this.renderList(document.getElementById('departments-list-container'));
                    } catch (e) {
                        console.error(e);
                        UIHelpers.showToast('Error al quitar miembro', 'error');
                    }
                }
            });
        });
    }

    populateAddMemberSelect(deptId) {
        const select = document.getElementById('select-add-member');
        // Users NOT in this department. Optionally, only those with NO department?
        // User might want to move someone from one dept to another. So list all who are NOT in current.
        const candidates = this.users
            .filter(u => u.department !== deptId)
            .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));

        select.innerHTML = '<option value="">Seleccionar usuario para añadir...</option>' +
            candidates.map(u => `
                <option value="${u.uid}">
                    ${UIHelpers.escapeHtml(u.displayName || u.email)} ${u.department ? '(En otro dpto)' : '(Sin dpto)'}
                </option>
            `).join('');
    }
}
