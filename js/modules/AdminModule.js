import { UIHelpers } from '../UIHelpers.js';

export class AdminModule {
    constructor(container, supabaseService, user) {
        this.container = container;
        this.supabaseService = supabaseService;
        this.user = user;

        this.auditPagination = {
            pageSize: 20,
            currentPage: 1,
            cursors: [null] // Index 0 is null (start), Index 1 is lastDoc of page 1, etc.
        };

        this.sortState = {
            column: 'displayName',
            direction: 'asc'
        };

        this.users = [];
        this.departments = [];

        this.render();

        // Attach global functions
        window.editUser = this.openEditUserModal.bind(this);
    }

    // ... (keep openEditUserModal as is, skipping lines 21-137)
    // Wait, I can't skip lines in replace_file_content. 
    // I need to only replace the parts I want to change.
    // The previous tool call view_file output shows I can see the whole file.
    // I will use multi_replace to be precise.
    // Actually, I am using replace_file_content here, which is for single contiguous block.
    // But I need to change constructor AND loadUsers.
    // Using multi_replace_file_content is better.


    async openEditUserModal(uid) {
        const users = await this.supabaseService.getAllUsers();
        const departments = await this.supabaseService.getAllDepartments();
        const user = users.find(u => u.uid === uid);

        if (!user) return;

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-user-edit me-2"></i>Editar Usuario</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label fw-bold">${UIHelpers.escapeHtml(user.email)}</label>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Departamento</label>
                            <select class="form-select" id="user-department">
                                <option value="">Sin asignar</option>
                                ${departments.filter(d => d.active).map(dept => `
                                    <option value="${dept.id}" ${user.department === dept.id ? 'selected' : ''}>
                                        ${UIHelpers.escapeHtml(dept.name)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Roles</label>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-admin" value="admin"
                                    ${user.roles?.includes('admin') ? 'checked' : ''}
                                    ${user.uid === this.user.id ? 'disabled' : ''}>
                                <label class="form-check-label fw-bold text-danger" for="role-admin">
                                    Administrador del Instituto
                                    ${user.uid === this.user.id ? '(No puedes quitarte este permiso)' : ''}
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-jefe" value="jefe_departamento" 
                                    ${user.roles?.includes('jefe_departamento') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-jefe">Jefe de Departamento</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-tic" value="equipo_tic"
                                    ${user.roles?.includes('equipo_tic') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-tic">Equipo TIC</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-mnt" value="equipo_mantenimiento"
                                    ${user.roles?.includes('equipo_mantenimiento') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-mnt">Equipo Mantenimiento</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-3d" value="equipo_3d"
                                    ${user.roles?.includes('equipo_3d') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-3d">Equipo Impresión 3D</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-dual" value="equipo_dual"
                                    ${user.roles?.includes('equipo_dual') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-dual">Equipo Dual</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-dir" value="equipo_directivo"
                                    ${user.roles?.includes('equipo_directivo') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-dir">Equipo Directivo</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-director" value="director"
                                    ${user.roles?.includes('director') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-director">Director/a</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-tester" value="tester"
                                    ${user.roles?.includes('tester') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-tester">Tester (Beta)</label>
                            </div>
                        </div>
                        <div class="alert alert-warning small">
                            <i class="fas fa-info-circle me-1"></i>
                            El rol de <strong>Administrador</strong> tiene acceso total al instituto. Úsalo con precaución.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-user">Guardar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-save-user').addEventListener('click', async () => {
            const department = document.getElementById('user-department').value || null;

            const roles = [];
            // If disabled (self-edit), we must ensure we keep the role if it was there (which it must be if we are admin)
            // Or simpler: Check the checkbox status. Disabled checkboxes are NOT submitted in standard forms, 
            // but here we are reading .checked property used in JS. Disabled inputs return their current checked state in JS DOM.
            // So .checked should be correct even if disabled.
            if (document.getElementById('role-admin').checked) roles.push('admin');
            if (document.getElementById('role-jefe').checked) roles.push('jefe_departamento');
            if (document.getElementById('role-tic').checked) roles.push('equipo_tic');
            if (document.getElementById('role-mnt').checked) roles.push('equipo_mantenimiento');
            if (document.getElementById('role-3d').checked) roles.push('equipo_3d');
            if (document.getElementById('role-dual').checked) roles.push('equipo_dual');
            if (document.getElementById('role-dir').checked) roles.push('equipo_directivo');
            if (document.getElementById('role-director').checked) roles.push('director');
            if (document.getElementById('role-tester').checked) roles.push('tester');

            try {
                await this.supabaseService.updateUserRoles(uid, roles);
                await this.supabaseService.updateUserDepartment(uid, department);

                UIHelpers.showToast('Usuario actualizado correctamente', 'success');
                bsModal.hide();
                // Refresh table instead of reload if possible, but reload is safer for now
                // this.fetchUsers(); // If I use this I don't need reload
                window.location.reload();
            } catch (error) {
                console.error('Error updating user:', error);
                UIHelpers.showToast('Error al actualizar usuario', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header">
                <h2><i class="fas fa-users-cog me-2"></i>Administración</h2>
                <p class="text-muted">Gestión de usuarios y accesos</p>
            </div>

            <ul class="nav nav-tabs mb-4" id="adminTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="users-tab" data-bs-toggle="tab" data-bs-target="#users-content" type="button" role="tab" aria-controls="users-content" aria-selected="true">
                        <i class="fas fa-users me-2"></i>Usuarios
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="modules-tab" data-bs-toggle="tab" data-bs-target="#modules-content" type="button" role="tab" aria-controls="modules-content" aria-selected="false">
                        <i class="fas fa-toggle-on me-2"></i>Módulos
                    </button>
                </li>
            </ul>

            <div class="tab-content" id="adminTabsContent">
                <!-- Users Tab -->
                <div class="tab-pane fade show active" id="users-content" role="tabpanel" aria-labelledby="users-tab">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <div class="d-flex justify-content-end mb-3 gap-2">
                                <button class="btn btn-success text-white" id="btn-add-user">
                                    <i class="fas fa-user-plus me-2"></i>Añadir Usuario
                                </button>
                                <button class="btn btn-outline-primary" id="btn-import-users">
                                    <i class="fas fa-file-import me-2"></i>Importar CSV
                                </button>
                            </div>
                            <div class="table-responsive" id="users-table-container">
                                <div class="text-center py-4">
                                    <div class="spinner-border text-primary" role="status"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modules Tab -->
                <div class="tab-pane fade" id="modules-content" role="tabpanel" aria-labelledby="modules-tab">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <h5 class="card-title fw-bold mb-3">Visibilidad de Módulos (Despliegue)</h5>
                            <div id="modules-config-container">
                                <div class="spinner-border text-primary" role="status"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.fetchUsers();
        this.loadModuleConfig();

        constnotNullContainer = this.container;
        // Delegate or attach if exists
        setTimeout(() => { // Small delay or direct check
            const addUserBtn = notNullContainer.querySelector('#btn-add-user');
            if (addUserBtn) addUserBtn.addEventListener('click', () => this.openAddUserModal());

            const importBtn = notNullContainer.querySelector('#btn-import-users');
            if (importBtn) importBtn.addEventListener('click', () => this.openImportModal());
        }, 100);

        // Attach global for delete
        window.removeUser = this.removeUser.bind(this);
    }

    async openAddUserModal() {
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-user-plus me-2"></i>Añadir Usuario</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted small">
                            Introduce el email del usuario. Si ya está registrado en la plataforma, se añadirá al instituto.
                            Si no, se creará una invitación pendiente y se unirá automáticamente cuando se registre.
                        </p>
                        <div class="mb-3">
                            <label class="form-label">Email</label>
                            <input type="email" class="form-control" id="new-user-email" placeholder="usuario@email.com">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Departamento (Opcional)</label>
                            <select class="form-select" id="new-user-department">
                                <option value="">Sin asignar</option>
                                ${this.departments.filter(d => d.active).map(dept => `
                                    <option value="${dept.id}">${UIHelpers.escapeHtml(dept.name)}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="mb-3">
                             <label class="form-label">Roles Iniciales</label>
                             <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="new-role-admin" value="admin">
                                <label class="form-check-label text-danger" for="new-role-admin">Administrador</label>
                             </div>
                             <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="new-role-teacher" value="teacher" checked disabled>
                                <label class="form-check-label" for="new-role-teacher">Profesor (Por defecto)</label>
                             </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-confirm-add-user">Añadir</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const btnConfirm = document.getElementById('btn-confirm-add-user');
        const emailInput = document.getElementById('new-user-email');

        // Focus email
        modal.addEventListener('shown.bs.modal', () => emailInput.focus());

        btnConfirm.addEventListener('click', async () => {
            const email = emailInput.value.trim();
            const department = document.getElementById('new-user-department').value || null;
            const isAdmin = document.getElementById('new-role-admin').checked;

            if (!email) {
                alert("Por favor, introduce un email.");
                return;
            }

            const roles = []; // 'teacher' is default, explicit roles added here
            if (isAdmin) roles.push('admin');

            try {
                btnConfirm.disabled = true;
                btnConfirm.textContent = "Procesando...";

                // Check if user exists
                const profile = await this.supabaseService.getProfileByEmail(email);

                if (profile) {
                    // User exists, add normally
                    await this.supabaseService.addInstituteMember(profile.id, roles, department);
                    UIHelpers.showToast(`Usuario ${profile.display_name || email} añadido correctamente.`, 'success');
                } else {
                    // User does not exist, add to pending
                    await this.supabaseService.addPendingMembership(email, roles, department);
                    UIHelpers.showToast(`Invitación creada para ${email}. Se unirá automáticamente al registrarse.`, 'warning');
                }

                bsModal.hide();
                this.fetchUsers(); // Refresh list

            } catch (error) {
                console.error(error);
                let msg = error.message;
                if (msg.includes('ya es miembro')) msg = "El usuario ya es miembro del instituto.";
                alert("Error: " + msg);
            } finally {
                btnConfirm.disabled = false;
                btnConfirm.textContent = "Añadir";
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async openImportModal() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Importar Usuarios (CSV)</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted small">
                            Sube un archivo CSV con una columna <code>email</code>. 
                            El sistema buscará los usuarios en la plataforma y los añadirá al instituto.
                            Los usuarios que no existan serán ignorados.
                        </p>
                        <textarea class="form-control mb-3" id="csv-paste" rows="5" placeholder="O pega aquí los emails (uno por línea o separados por comas)"></textarea>
                        
                        <div class="alert alert-info d-none" id="import-results"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-primary" id="btn-process-import">Procesar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const btnProcess = document.getElementById('btn-process-import');
        const resultsDiv = document.getElementById('import-results');

        btnProcess.addEventListener('click', async () => {
            const text = document.getElementById('csv-paste').value;
            // Simple parsing: extract emails
            const emails = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);

            if (!emails || emails.length === 0) {
                alert('No se encontraron emails válidos.');
                return;
            }

            btnProcess.disabled = true;
            btnProcess.textContent = 'Procesando...';
            resultsDiv.classList.remove('d-none');
            resultsDiv.textContent = `Procesando ${emails.length} emails...`;

            let added = 0;
            let failed = 0;
            let skipped = 0; // Already exists usually throws error but we handle it

            for (const email of [...new Set(emails)]) { // Unique
                try {
                    const profile = await this.supabaseService.getProfileByEmail(email);
                    if (profile) {
                        await this.supabaseService.addInstituteMember(profile.id);
                        added++;
                    } else {
                        failed++; // Not found
                    }
                } catch (e) {
                    if (e.message.includes('ya es miembro')) {
                        skipped++;
                    } else {
                        console.error(e);
                        failed++;
                    }
                }
            }

            resultsDiv.innerHTML = `
                <strong>Proceso completado:</strong><br>
                Añadidos: ${added}<br>
                Ya existían: ${skipped}<br>
                No encontrados (no registrados): ${failed}
             `;
            btnProcess.textContent = 'Procesar';
            btnProcess.disabled = false;

            if (added > 0) this.fetchUsers();
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async removeUser(uid, isPending = false) {
        const msg = isPending
            ? '¿Estás seguro de que quieres cancelar esta invitación?'
            : '¿Estás seguro de que quieres eliminar a este usuario del instituto?';

        if (!confirm(msg)) return;

        try {
            if (isPending) {
                await this.supabaseService.removePendingMembership(uid);
                UIHelpers.showToast('Invitación cancelada', 'success');
            } else {
                await this.supabaseService.removeInstituteMember(uid);
                UIHelpers.showToast('Usuario eliminado', 'success');
            }
            this.fetchUsers();
        } catch (e) {
            UIHelpers.showToast('Error al eliminar: ' + e.message, 'error');
        }
    }

    async loadModuleConfig() {
        // Ensure container exists initially
        const container = document.getElementById('modules-config-container');
        if (!container) return;

        try {
            const config = await this.supabaseService.getModuleConfig();

            // Verify container is still in the DOM after async call
            if (!container.isConnected) return;

            const modulesList = [
                { id: 'calendario', label: 'Calendario' },
                { id: 'anuncios', label: 'Tablón de Anuncios' },
                { id: 'tickets_tic', label: 'Peticiones TIC' },
                { id: 'tickets_maintenance', label: 'Peticiones Mantenimiento' },
                { id: 'tickets_3d', label: 'Peticiones 3D' },
                { id: 'dual', label: 'Gestión Dual' },
                { id: 'sum', label: 'Reserva Salón de Actos / SUM' },
                { id: 'carts', label: 'Reserva Carros Portátiles' }
                // departments is hidden from here as it's admin internal
            ];

            container.innerHTML = `
                <div class="row g-3">
                    ${modulesList.map(mod => `
                        <div class="col-md-6">
                            <div class="p-3 border rounded bg-light">
                                <label class="form-label fw-bold mb-2" for="select-${mod.id}">${mod.label}</label>
                                <select class="form-select module-select" id="select-${mod.id}" data-module="${mod.id}">
                                    <option value="active" ${config[mod.id] === 'active' || config[mod.id] === true ? 'selected' : ''}>Visible (Todos)</option>
                                    <option value="inactive" ${config[mod.id] === 'inactive' || config[mod.id] === false ? 'selected' : ''}>Oculto (Nadie)</option>
                                    <option value="testers" ${config[mod.id] === 'testers' ? 'selected' : ''}>Solo Testers</option>
                                </select>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-3 text-end">
                    <button class="btn btn-primary" id="btn-save-modules">
                        <i class="fas fa-save me-2"></i>Guardar Cambios
                    </button>
                </div>
            `;

            const saveBtn = container.querySelector('#btn-save-modules');
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    const newConfig = { ...config };
                    container.querySelectorAll('.module-select').forEach(el => {
                        newConfig[el.dataset.module] = el.value;
                    });

                    try {
                        await this.supabaseService.updateModuleConfig(newConfig);
                        UIHelpers.showToast('Configuración de módulos actualizada', 'success');
                        // Reload to apply changes (sidebar needs refresh)
                        setTimeout(() => window.location.reload(), 1500);
                    } catch (e) {
                        console.error(e);
                        UIHelpers.showToast('Error al guardar configuración', 'error');
                    }
                });
            }

        } catch (e) {
            console.error('Error loading module config:', e);
            if (container && container.isConnected) {
                container.innerHTML = '<div class="alert alert-danger">Error al cargar configuración</div>';
            }
        }
    }

    async fetchUsers() {
        const container = document.getElementById('users-table-container');
        if (!container) return;

        try {
            this.users = await this.supabaseService.getAllUsers();

            // Try identifying pending members (graceful fail if table missing)
            try {
                const pending = await this.supabaseService.getPendingMemberships();
                const pendingUsers = pending.map(p => ({
                    uid: p.id, // ID from pending table
                    email: p.email,
                    displayName: 'Usuario Pendiente',
                    roles: p.roles,
                    department: p.department,
                    isAdmin: p.roles && p.roles.includes('admin'),
                    isPending: true
                }));
                this.users = [...this.users, ...pendingUsers];
            } catch (err) {
                console.warn("Could not fetch pending memberships (Table might be missing):", err);
            }

            this.departments = await this.supabaseService.getAllDepartments();

            // Check connectivity after async
            if (document.getElementById('users-table-container')) {
                this.renderUserTable();
            }

        } catch (error) {
            console.error('Error loading users:', error);
            const currentContainer = document.getElementById('users-table-container');
            if (currentContainer) {
                currentContainer.innerHTML = '<div class="alert alert-danger">Error al cargar usuarios</div>';
            }
        }
    }

    renderUserTable() {
        const container = document.getElementById('users-table-container');
        if (!container) return;

        // Sort users
        const sortedUsers = [...this.users].sort((a, b) => {
            const valA = this.getSortValue(a, this.sortState.column);
            const valB = this.getSortValue(b, this.sortState.column);

            if (valA < valB) return this.sortState.direction === 'asc' ? -1 : 1;
            if (valA > valB) return this.sortState.direction === 'asc' ? 1 : -1;
            return 0;
        });

        // Helper to generate header with sort arrow
        const renderHeader = (col, label) => {
            let icon = '';
            if (this.sortState.column === col) {
                icon = this.sortState.direction === 'asc'
                    ? '<i class="fas fa-sort-up ms-1"></i>'
                    : '<i class="fas fa-sort-down ms-1"></i>';
            }
            return `
                <th style="cursor: pointer;" class="sortable-header" data-column="${col}">
                    ${label} ${icon}
                </th>
            `;
        };

        container.innerHTML = `
            <table class="table table-striped table-hover">
                <thead>
                    <tr>
                        ${renderHeader('displayName', 'Usuario')}
                        ${renderHeader('email', 'Email')}
                        ${renderHeader('department', 'Departamento')}
                        ${renderHeader('roles', 'Roles')}
                        <th>Último Acceso</th>
                        ${renderHeader('isAdmin', 'Admin')}
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedUsers.map(user => this.renderUserRow(user, this.departments)).join('')}
                </tbody>
            </table>
        `;

        // Add event listeners to headers
        container.querySelectorAll('.sortable-header').forEach(th => {
            th.addEventListener('click', () => {
                this.handleSort(th.dataset.column);
            });
        });
    }

    handleSort(column) {
        if (this.sortState.column === column) {
            this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortState.column = column;
            this.sortState.direction = 'asc';
        }
        this.renderUserTable();
    }

    getSortValue(user, column) {
        if (column === 'department') {
            return this.getDepartmentName(user.department, this.departments).toLowerCase();
        }
        if (column === 'roles') {
            // Sort by roles (just stringifying them for simple sort, or could count them)
            return (user.roles || []).join(', ').toLowerCase();
        }
        if (column === 'displayName') {
            return (user.displayName || user.email.split('@')[0]).toLowerCase();
        }
        const val = user[column];
        if (typeof val === 'string') return val.toLowerCase();
        return val;
    }

    async loadAuditLogs(direction = 'first') {
        const container = document.getElementById('audit-table-container');
        if (!container) return;

        container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';

        try {
            if (direction === 'first') {
                this.auditPagination.currentPage = 1;
                this.auditPagination.cursors = [null];
            } else if (direction === 'next') {
                this.auditPagination.currentPage++;
            } else if (direction === 'prev' && this.auditPagination.currentPage > 1) {
                this.auditPagination.currentPage--;
            }

            // Get the cursor for the current page request
            const currentCursor = this.auditPagination.cursors[this.auditPagination.currentPage - 1];

            const result = await this.supabaseService.getLoginLogs(this.auditPagination.pageSize, currentCursor);

            // Check connectivity after await
            if (!container.isConnected) return;

            const logs = result.logs;

            // Store cursor for next page if we have results
            if (result.lastVisible) {
                this.auditPagination.cursors[this.auditPagination.currentPage] = result.lastVisible;
            }

            if (logs.length === 0 && this.auditPagination.currentPage > 1) {
                container.innerHTML = '<div class="alert alert-info">No hay más registros.</div>';
                // Decrease page count to keep state consistent?
                this.auditPagination.currentPage--;
                // Re-render prev page? For now let's just show controls to go back
            }

            if (logs.length === 0 && this.auditPagination.currentPage === 1) {
                container.innerHTML = '<div class="alert alert-info">No hay registros de actividad.</div>';
                return;
            }

            container.innerHTML = `
                <table class="table table-sm table-striped table-hover small">
                    <thead class="table-light">
                        <tr>
                            <th>Fecha y Hora</th>
                            <th>Usuario / Email</th>
                            <th>Tipo</th>
                            <th>Detalle</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => {
                const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                const isSuccess = log.type === 'success';
                const badge = isSuccess
                    ? '<span class="badge bg-success">Exitoso</span>'
                    : '<span class="badge bg-danger">Fallido</span>';

                return `
                                <tr>
                                    <td>${date.toLocaleString()}</td>
                                    <td>
                                        <span class="fw-bold">${UIHelpers.escapeHtml(log.email)}</span>
                                        ${log.name && log.name !== log.email ? `<div class="text-muted small">${UIHelpers.escapeHtml(log.name)}</div>` : ''}
                                    </td>
                                    <td>${badge}</td>
                                    <td>${UIHelpers.escapeHtml(log.reason) || (isSuccess ? 'Login correcto' : '-')}</td>
                                </tr>
                            `;
            }).join('')}
                    </tbody>
                </table>
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <button class="btn btn-sm btn-outline-secondary" id="audit-prev" ${this.auditPagination.currentPage === 1 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-left me-1"></i> Anterior
                    </button>
                    <span class="text-muted small">Página ${this.auditPagination.currentPage}</span>
                    <button class="btn btn-sm btn-outline-secondary" id="audit-next" ${logs.length < this.auditPagination.pageSize ? 'disabled' : ''}>
                        Siguiente <i class="fas fa-chevron-right ms-1"></i>
                    </button>
                </div>
            `;

            const prevBtn = container.querySelector('#audit-prev');
            if (prevBtn) prevBtn.addEventListener('click', () => this.loadAuditLogs('prev'));

            const nextBtn = container.querySelector('#audit-next');
            if (nextBtn) nextBtn.addEventListener('click', () => this.loadAuditLogs('next'));

        } catch (error) {
            console.error('Error loading audit logs:', error);
            if (container && container.isConnected) {
                container.innerHTML = '<div class="alert alert-danger">Error al cargar registros</div>';
            }
        }
    }

    renderUserRow(user, departments) {
        const rolesBadges = (user.roles || []).map(role =>
            `<span class="badge bg-info me-1">${UIHelpers.getRoleDisplayName(role)}</span>`
        ).join('');

        const statusLabel = user.isPending
            ? '<span class="badge bg-warning text-dark me-2">Invitado</span>'
            : '';

        const editBtn = user.isPending
            ? `<button class="btn btn-sm btn-outline-secondary" disabled title="No se puede editar una invitación pendiente"><i class="fas fa-edit"></i></button>`
            : `<button class="btn btn-sm btn-outline-primary" onclick="window.editUser('${user.uid}')"><i class="fas fa-edit"></i> Editar</button>`;

        const lastLogin = user.lastLogin ? UIHelpers.formatDate(user.lastLogin) : '<span class="text-muted small">Nunca</span>';

        return `
            <tr class="${user.isPending ? 'table-light text-muted' : ''}">
                <td>
                    ${statusLabel}
                    ${UIHelpers.escapeHtml(user.displayName || user.email.split('@')[0])}
                </td>
                <td>${UIHelpers.escapeHtml(user.email)}</td>
                <td>${UIHelpers.escapeHtml(this.getDepartmentName(user.department, departments))}</td>
                <td>${rolesBadges || '<span class="text-muted">Sin roles</span>'}</td>
                <td>${lastLogin}</td>
                <td>${user.isAdmin ? '<span class="badge bg-warning">Sí</span>' : '<span class="text-muted">No</span>'}</td>
                <td>
                    ${editBtn}
                    <button class="btn btn-sm btn-outline-danger ms-1" onclick="window.removeUser('${user.uid}', ${user.isPending || false})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    getDepartmentName(deptId, departments) {
        if (!deptId) return '<span class="text-muted">Sin asignar</span>';
        const dept = departments.find(d => d.id === deptId);
        return dept ? dept.name : deptId;
    }

    destroy() {
        delete window.editUser;
        delete window.removeUser;
    }
}
