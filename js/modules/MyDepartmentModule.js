import { UIHelpers } from '../UIHelpers.js';

export class MyDepartmentModule {
    constructor(container, supabaseService, user) {
        this.container = container;
        this.supabaseService = supabaseService;
        this.user = user;
        this.myDepartmentId = null;

        this.render();

        window.removeMember = this.removeMember.bind(this);
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header d-flex justify-content-between align-items-center">
                <div>
                    <h2><i class="fas fa-users me-2"></i>Mi Departamento</h2>
                    <p class="text-muted mb-0">Gestiona los miembros de tu departamento</p>
                </div>
                <button id="btn-add-member" class="btn btn-primary" disabled>
                    <i class="fas fa-user-plus me-2"></i>Añadir Miembro
                </button>
            </div>

            <div class="card shadow-sm mt-4">
                <div class="card-body">
                    <h5 id="dept-name-display" class="card-title mb-4">Cargando...</h5>
                    <div id="members-list">
                        <div class="text-center py-4">
                            <div class="spinner-border text-primary" role="status"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-add-member').addEventListener('click', () => this.showAddMemberModal());
        await this.loadMyDepartment();
    }

    async loadMyDepartment() {
        try {
            // Get current user details to find dept ID
            const users = await this.supabaseService.getAllUsers();
            const currentUser = users.find(u => u.uid === this.user.uid);

            if (!currentUser || !currentUser.department) {
                this.container.innerHTML = '<div class="alert alert-warning">No tienes un departamento asignado. Contacta con el administrador.</div>';
                return;
            }

            this.myDepartmentId = currentUser.department;

            // Get department details
            const departments = await this.supabaseService.getAllDepartments();
            const myDept = departments.find(d => d.id === this.myDepartmentId);

            document.getElementById('dept-name-display').textContent = myDept ? `Departamento de ${myDept.name}` : 'Departamento Desconocido';
            document.getElementById('btn-add-member').disabled = false;

            // Filter users in this department
            const members = users.filter(u => u.department === this.myDepartmentId);
            this.renderMembersList(members);

        } catch (error) {
            console.error('Error loading department:', error);
            document.getElementById('members-list').innerHTML = '<div class="alert alert-danger">Error al cargar datos del departamento</div>';
        }
    }

    renderMembersList(members) {
        const container = document.getElementById('members-list');

        if (members.length === 0) {
            UIHelpers.showEmptyState(container, 'No hay miembros en este departamento', 'users');
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-striped table-hover align-middle">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Email</th>
                            <th>Roles</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${members.map(member => `
                            <tr>
                                <td>
                                    <div class="d-flex align-items-center">
                                        <div class="avatar-circle bg-primary text-white me-2">
                                            ${(member.displayName || member.email).charAt(0).toUpperCase()}
                                        </div>
                                        ${member.displayName || '-'}
                                    </div>
                                </td>
                                <td>${member.email}</td>
                                <td>
                                    ${(member.roles || []).map(r => `<span class="badge bg-secondary me-1">${UIHelpers.getRoleDisplayName(r)}</span>`).join('')}
                                </td>
                                <td>
                                    ${member.uid !== this.user.uid ? `
                                        <button class="btn btn-sm btn-outline-danger" onclick="window.removeMember('${member.uid}')">
                                            <i class="fas fa-user-minus"></i>
                                        </button>
                                    ` : '<span class="text-muted small">Tú</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    showAddMemberModal() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Añadir Miembro</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted">Introduce el email del usuario que quieres añadir a tu departamento. El usuario debe estar ya registrado en la plataforma.</p>
                        <div class="mb-3">
                            <label class="form-label">Email del usuario</label>
                            <input type="email" class="form-control" id="member-email" required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-confirm-add">Añadir</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-confirm-add').addEventListener('click', async () => {
            const email = document.getElementById('member-email').value;
            if (!email) return;

            try {
                // Find user by email (inefficient client side search but ok for small org)
                const users = await this.supabaseService.getAllUsers();
                const targetUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

                if (!targetUser) {
                    UIHelpers.showToast('Usuario no encontrado', 'error');
                    return;
                }

                if (targetUser.department === this.myDepartmentId) {
                    UIHelpers.showToast('El usuario ya pertenece a este departamento', 'warning');
                    return;
                }

                // Update user department
                await this.supabaseService.updateUserDepartment(targetUser.uid, this.myDepartmentId);

                UIHelpers.showToast(`${targetUser.email} añadido al departamento`, 'success');
                bsModal.hide();
                await this.loadMyDepartment();

            } catch (error) {
                console.error(error);
                UIHelpers.showToast('Error al añadir miembro', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }
    async removeMember(uid) {
        if (await UIHelpers.confirm('¿Seguro que quieres eliminar a este usuario del departamento?')) {
            try {
                await this.supabaseService.updateUserDepartment(uid, null);
                UIHelpers.showToast('Miembro eliminado del departamento', 'success');
                await this.loadMyDepartment();
            } catch (error) {
                console.error(error);
                UIHelpers.showToast('Error al eliminar miembro', 'error');
            }
        }
    }

    destroy() {
        delete window.removeMember;
    }
}
