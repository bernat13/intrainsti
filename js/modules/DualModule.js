import { UIHelpers } from '../UIHelpers.js';

export class DualModule {
    constructor(container, firebaseService, user, userRoles) {
        this.container = container;
        this.firebaseService = firebaseService;
        this.user = user;
        this.userRoles = userRoles;

        // Current view state
        this.currentView = 'companies'; // or 'students', 'config'
        this.companies = [];
        this.students = [];
        this.users = []; // For tutor selection
        this.config = { cycles: [], levels: [] };

        // State for sorting and filtering
        this.companySort = { column: 'name', direction: 'asc' };
        this.studentSort = { column: 'name', direction: 'asc' };
        this.companyFilters = {
            withStudents: false,
            firstYear: false,
            secondYear: false
        };

        this.render();
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header">
                <h2><i class="fas fa-user-graduate me-2"></i>Gestión Dual</h2>
                <p class="text-muted">Administración de empresas y alumnos de FP Dual</p>
            </div>

            <ul class="nav nav-tabs mb-4" id="dualTabs" role="tablist">
                <li class="nav-item">
                    <button class="nav-link active" id="companies-tab" data-bs-toggle="tab" data-bs-target="#companies-content" type="button">
                        <i class="fas fa-building me-2"></i>Empresas
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" id="students-tab" data-bs-toggle="tab" data-bs-target="#students-content" type="button">
                        <i class="fas fa-users me-2"></i>Alumnos
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" id="config-tab" data-bs-toggle="tab" data-bs-target="#config-content" type="button">
                        <i class="fas fa-cog me-2"></i>Configuración
                    </button>
                </li>
            </ul>

            <div class="tab-content">
                <!-- Companies Tab -->
                <div class="tab-pane fade show active" id="companies-content">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="card-title fw-bold">Listado de Empresas</h5>
                                <button class="btn btn-primary btn-sm" id="btn-add-company">
                                    <i class="fas fa-plus me-2"></i>Nueva Empresa
                                </button>
                            </div>
                            <div class="table-responsive" id="companies-table-container">
                                <div class="text-center py-4">
                                    <div class="spinner-border text-primary" role="status"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Students Tab -->
                <div class="tab-pane fade" id="students-content">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="card-title fw-bold">Alumnos Dual</h5>
                                <div>
                                    <button class="btn btn-success btn-sm me-2" id="btn-import-classroom">
                                        <i class="fab fa-google me-2"></i>Importar de Classroom
                                    </button>
                                    <button class="btn btn-primary btn-sm" id="btn-add-student">
                                        <i class="fas fa-plus me-2"></i>Nuevo Alumno
                                    </button>
                                </div>
                            </div>
                            <div class="table-responsive" id="students-table-container">
                                <div class="text-center py-4">
                                    <div class="spinner-border text-primary" role="status"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                 <!-- Config Tab -->
                <div class="tab-pane fade" id="config-content">
                    <div class="row">
                        <div class="col-md-6 mb-4">
                            <div class="card shadow-sm h-100">
                                <div class="card-header bg-light fw-bold">Ciclos Formativos</div>
                                <div class="card-body">
                                    <div class="input-group mb-3">
                                        <input type="text" class="form-control" id="new-cycle-input" placeholder="Ej: DAW, DAM">
                                        <button class="btn btn-outline-primary" type="button" id="btn-add-cycle">Añadir</button>
                                    </div>
                                    <ul class="list-group" id="cycles-list">
                                        <!-- Cycles will be loaded here -->
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6 mb-4">
                            <div class="card shadow-sm h-100">
                                <div class="card-header bg-light fw-bold">Niveles</div>
                                <div class="card-body">
                                    <div class="input-group mb-3">
                                        <input type="text" class="form-control" id="new-level-input" placeholder="Ej: 1º, 2º">
                                        <button class="btn btn-outline-primary" type="button" id="btn-add-level">Añadir</button>
                                    </div>
                                    <ul class="list-group" id="levels-list">
                                        <!-- Levels will be loaded here -->
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        `;

        // Event Listeners for Tabs
        document.getElementById('companies-tab').addEventListener('shown.bs.tab', () => this.loadCompanies());
        document.getElementById('students-tab').addEventListener('shown.bs.tab', () => this.loadStudents());
        document.getElementById('config-tab').addEventListener('shown.bs.tab', () => this.loadConfig());

        // Add Buttons
        document.getElementById('btn-add-company').addEventListener('click', () => this.openCompanyModal());
        document.getElementById('btn-add-student').addEventListener('click', () => this.openStudentModal());
        document.getElementById('btn-import-classroom').addEventListener('click', () => this.openClassroomImportModal());

        // Config Buttons
        document.getElementById('btn-add-cycle').addEventListener('click', () => this.addConfigItem('cycles', 'new-cycle-input'));
        document.getElementById('btn-add-level').addEventListener('click', () => this.addConfigItem('levels', 'new-level-input'));

        // Initial Load
        this.loadCompanies();
        // Pre-load config in background as it is needed for dropdowns
        this.config = await this.firebaseService.getDualConfig();
    }

    // ==================== COMPANIES ====================

    async loadCompanies() {
        const container = document.getElementById('companies-table-container');
        try {
            // Load companies and students (needed for filtering)
            this.companies = await this.firebaseService.getCompanies();
            // We need students to filter companies "With Students", "1st Year", etc.
            if (this.students.length === 0) {
                this.students = await this.firebaseService.getDualStudents(null);
            }
            this.renderCompaniesTable();
        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar empresas</div>';
        }
    }

    renderCompaniesTable() {
        const container = document.getElementById('companies-table-container');

        // Filter Logic
        let displayCompanies = this.companies.filter(c => {
            if (!this.companyFilters.withStudents && !this.companyFilters.firstYear && !this.companyFilters.secondYear) return true;

            const companyStudents = this.students.filter(s => s.companyId === c.id);

            if (companyStudents.length === 0) return false; // If filtering by any student critera, must have students

            let match = true;
            // "With Students" is implied if any other filter, but if ONLY that is checked:
            if (this.companyFilters.withStudents && !this.companyFilters.firstYear && !this.companyFilters.secondYear) {
                // Already checked length > 0
            }

            // "1st Year" -> Check if ANY student is Level "1" (flexible match)
            if (this.companyFilters.firstYear) {
                const hasFirst = companyStudents.some(s => s.level && (s.level.includes('1') || s.level.toLowerCase().includes('primero')));
                if (!hasFirst) match = false;
            }

            // "2nd Year" -> Check if ANY student is Level "2"
            if (this.companyFilters.secondYear) {
                const hasSecond = companyStudents.some(s => s.level && (s.level.includes('2') || s.level.toLowerCase().includes('segundo')));
                if (!hasSecond) match = false;
            }
            // Note: If both 1st and 2nd checked, does it mean AND or OR? 
            // Usually "Show companies with 1st year students AND 2nd year students" or just "Show... OR ..."
            // Given the prompt "filtrar por las empresas de alumnos de 1 o 2 curso", 
            // it likely means "Show if it has 1st year OR Show if it has 2nd year". 
            // BUT if distinct checkboxes usually filters are restrictive (AND). 
            // However, for boolean properties like this, often OR is desired if buttons.
            // Let's implement restrictive (AND) if both checked (must have BOTH types), 
            // or if the user meant "Show companies relevant to 1st year" simply toggle.
            // Let's stick to: if 1st checked, must have 1st. If 2nd checked, must have 2nd. 

            return match;
        });

        // Sort Logic
        this.sortData(displayCompanies, this.companySort);

        const buildSortHeader = (label, col) => {
            const icon = this.companySort.column === col
                ? (this.companySort.direction === 'asc' ? '<i class="fas fa-sort-up"></i>' : '<i class="fas fa-sort-down"></i>')
                : '<i class="fas fa-sort text-muted" style="opacity:0.3"></i>';
            return `<th style="cursor: pointer;" data-col="${col}" class="sortable-header user-select-none">${label} ${icon}</th>`;
        };

        // Filters UI
        const filtersHtml = `
            <div class="mb-3 d-flex gap-2 align-items-center flex-wrap">
                <span class="fw-bold me-2"><i class="fas fa-filter me-1"></i>Filtros:</span>
                <button class="btn btn-sm ${this.companyFilters.withStudents ? 'btn-primary' : 'btn-outline-secondary'} btn-filter-toggle" data-filter="withStudents">
                    Con Alumnos
                </button>
                <button class="btn btn-sm ${this.companyFilters.firstYear ? 'btn-primary' : 'btn-outline-secondary'} btn-filter-toggle" data-filter="firstYear">
                    1º Curso
                </button>
                <button class="btn btn-sm ${this.companyFilters.secondYear ? 'btn-primary' : 'btn-outline-secondary'} btn-filter-toggle" data-filter="secondYear">
                    2º Curso
                </button>
                <span class="ms-auto text-muted small">Mostrando ${displayCompanies.length} de ${this.companies.length}</span>
            </div>
        `;

        if (displayCompanies.length === 0) {
            container.innerHTML = filtersHtml + '<div class="alert alert-info py-4 text-center"><i class="fas fa-search me-2"></i>No hay empresas que coincidan con los filtros</div>';
            // Re-attach filter events even for empty state
            container.querySelectorAll('.btn-filter-toggle').forEach(btn => {
                btn.addEventListener('click', () => this.toggleCompanyFilter(btn.dataset.filter));
            });
            return;
        }

        container.innerHTML = `
            ${filtersHtml}
            <table class="table table-striped table-hover align-middle">
                <thead>
                    <tr>
                        ${buildSortHeader('Empresa', 'name')}
                        ${buildSortHeader('Contacto', 'contactName')}
                        <th>Email</th>
                        <th>Teléfono</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${displayCompanies.map(c => `
                        <tr>
                            <td>
                                <div class="fw-bold">${c.name}</div>
                                <div class="small text-muted">${c.address || ''}</div>
                            </td>
                            <td>${c.contactName || '-'}</td>
                            <td>${c.email ? `<a href="mailto:${c.email}">${c.email}</a>` : '-'}</td>
                            <td>${c.phone || '-'}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary btn-edit-company" data-id="${c.id}">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-info btn-history-company" data-id="${c.id}" title="Ver Historial">
                                    <i class="fas fa-history"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Bind Events
        container.querySelectorAll('.btn-filter-toggle').forEach(btn => {
            btn.addEventListener('click', () => this.toggleCompanyFilter(btn.dataset.filter));
        });

        container.querySelectorAll('.sortable-header').forEach(th => {
            th.addEventListener('click', () => this.toggleCompanySort(th.dataset.col));
        });

        container.querySelectorAll('.btn-edit-company').forEach(btn => {
            btn.addEventListener('click', () => {
                const company = this.companies.find(c => c.id === btn.dataset.id);
                this.openCompanyModal(company);
            });
        });

        container.querySelectorAll('.btn-history-company').forEach(btn => {
            btn.addEventListener('click', () => {
                const company = this.companies.find(c => c.id === btn.dataset.id);
                this.showCompanyHistory(company);
            });
        });
    }

    toggleCompanyFilter(filterKey) {
        this.companyFilters[filterKey] = !this.companyFilters[filterKey];
        if (filterKey === 'firstYear' || filterKey === 'secondYear') {
            // If selecting a specific year, auto-select "withStudents" because it implies it? 
            // Logic: If I want 1st year, they MUST have students.
            // But let's leave independent to avoid confusion, or handle in filter logic (implied).
            // Current logic handles it (empty students list = fail).
        }
        this.renderCompaniesTable();
    }

    toggleCompanySort(column) {
        if (this.companySort.column === column) {
            this.companySort.direction = this.companySort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.companySort.column = column;
            this.companySort.direction = 'asc';
        }
        this.renderCompaniesTable();
    }

    sortData(data, sortState) {
        data.sort((a, b) => {
            let valA = a[sortState.column] || '';
            let valB = b[sortState.column] || '';
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    openCompanyModal(company = null) {
        const isEdit = !!company;
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${isEdit ? 'Editar Empresa' : 'Nueva Empresa'}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="company-form">
                            <div class="mb-3">
                                <label class="form-label">Nombre de la Empresa *</label>
                                <input type="text" class="form-control" id="comp-name" required value="${company?.name || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Dirección</label>
                                <input type="text" class="form-control" id="comp-address" value="${company?.address || ''}">
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Persona de Contacto</label>
                                    <input type="text" class="form-control" id="comp-contact" value="${company?.contactName || ''}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Teléfono</label>
                                    <input type="text" class="form-control" id="comp-phone" value="${company?.phone || ''}">
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Email</label>
                                <input type="email" class="form-control" id="comp-email" value="${company?.email || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Notas Adicionales</label>
                                <textarea class="form-control" id="comp-notes" rows="3">${company?.notes || ''}</textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        ${isEdit ? `<button type="button" class="btn btn-danger me-auto" id="btn-delete-comp">Eliminar</button>` : ''}
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-comp">Guardar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const saveBtn = document.getElementById('btn-save-comp');
        saveBtn.addEventListener('click', async () => {
            const name = document.getElementById('comp-name').value;
            if (!name) return alert('El nombre es obligatorio');

            const data = {
                name,
                address: document.getElementById('comp-address').value,
                contactName: document.getElementById('comp-contact').value,
                phone: document.getElementById('comp-phone').value,
                email: document.getElementById('comp-email').value,
                notes: document.getElementById('comp-notes').value
            };

            try {
                if (isEdit) {
                    await this.firebaseService.updateCompany(company.id, data);
                } else {
                    await this.firebaseService.createCompany(data);
                }
                UIHelpers.showToast('Empresa guardada', 'success');
                bsModal.hide();
                this.loadCompanies();
            } catch (e) {
                console.error(e);
                UIHelpers.showToast('Error al guardar', 'error');
            }
        });

        if (isEdit) {
            document.getElementById('btn-delete-comp').addEventListener('click', async () => {
                if (await UIHelpers.confirm('¿Seguro que quieres eliminar esta empresa?')) {
                    try {
                        await this.firebaseService.deleteCompany(company.id);
                        UIHelpers.showToast('Empresa eliminada', 'success');
                        bsModal.hide();
                        this.loadCompanies();
                    } catch (e) {
                        console.error(e);
                        UIHelpers.showToast('Error al eliminar', 'error');
                    }
                }
            });
        }

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async showCompanyHistory(company) {
        const students = await this.firebaseService.getDualStudents(null);
        const history = students.filter(s => s.companyId === company.id);

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Historial: ${company.name}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                         ${history.length === 0 ? '<p class="text-muted">No hay alumnos asignados en el historial.</p>' : `
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Periodo</th>
                                        <th>Alumno</th>
                                        <th>Tutor</th>
                                        <th>Fechas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${history.map(s => `
                                        <tr>
                                            <td>${s.course || '-'}</td>
                                            <td>${s.name}</td>
                                            <td>${s.tutorName || '-'}</td>
                                            <td>${s.startDate} - ${s.endDate}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                         `}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        new bootstrap.Modal(modal).show();
        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    // ==================== STUDENTS ====================

    async loadStudents() {
        const container = document.getElementById('students-table-container');
        try {
            this.students = await this.firebaseService.getDualStudents(null);

            if (this.companies.length === 0) {
                this.companies = await this.firebaseService.getCompanies();
            }

            this.renderStudentsTable();
        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar alumnos</div>';
        }
    }

    renderStudentsTable() {
        const container = document.getElementById('students-table-container');

        if (this.students.length === 0) {
            UIHelpers.showEmptyState(container, 'No hay alumnos registrados', 'user-graduate');
            return;
        }

        // Clone and sort
        const displayStudents = [...this.students];
        this.sortData(displayStudents, this.studentSort);

        const buildSortHeader = (label, col) => {
            const icon = this.studentSort.column === col
                ? (this.studentSort.direction === 'asc' ? '<i class="fas fa-sort-up"></i>' : '<i class="fas fa-sort-down"></i>')
                : '<i class="fas fa-sort text-muted" style="opacity:0.3"></i>';
            return `<th style="cursor: pointer;" data-col="${col}" class="sortable-header user-select-none">${label} ${icon}</th>`;
        };

        container.innerHTML = `
            <table class="table table-striped table-hover align-middle">
                <thead>
                    <tr>
                        ${buildSortHeader('Alumno', 'name')}
                        ${buildSortHeader('Ciclo', 'cycle')}
                        ${buildSortHeader('Nivel', 'level')}
                        ${buildSortHeader('Empresa', 'companyId')}
                        ${buildSortHeader('Tutor', 'tutorName')}
                        <th>Fechas</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${displayStudents.map(s => {
            const company = this.companies.find(c => c.id === s.companyId);
            const companyName = company ? company.name : '<span class="text-danger">Sin asignar</span>';
            // Override sort value for calculated columns if needed (complex sort), 
            // but for now simple 'companyId' sort groups them. 
            // Ideally we sort by companyName, let's inject it for sorting.
            s._companyName = company ? company.name : 'zzz';

            return `
                        <tr>
                            <td>
                                <div class="fw-bold">${s.name}</div>
                                <div class="small text-muted">${s.course || ''}</div>
                            </td>
                            <td><span class="badge bg-secondary">${s.cycle || '-'}</span></td>
                            <td><span class="badge bg-info text-dark">${s.level || '-'}</span></td>
                            <td>${companyName}</td>
                            <td>${s.tutorName || '-'}</td>
                            <td>${s.startDate} a ${s.endDate}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary btn-edit-student" data-id="${s.id}">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </td>
                        </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        `;

        container.querySelectorAll('.sortable-header').forEach(th => {
            th.addEventListener('click', () => this.toggleStudentSort(th.dataset.col));
        });

        container.querySelectorAll('.btn-edit-student').forEach(btn => {
            btn.addEventListener('click', () => {
                const student = this.students.find(s => s.id === btn.dataset.id);
                this.openStudentModal(student);
            });
        });
    }

    toggleStudentSort(column) {
        if (this.studentSort.column === column) {
            this.studentSort.direction = this.studentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.studentSort.column = column;
            this.studentSort.direction = 'asc';
        }
        this.renderStudentsTable();
    }

    async openStudentModal(student = null) {
        const isEdit = !!student;

        if (this.users.length === 0) {
            const allUsers = await this.firebaseService.getAllUsers();
            this.users = allUsers.filter(u => (u.roles || []).includes('equipo_dual'));
        }

        // Ensure config is loaded
        if (!this.config.cycles.length) this.config = await this.firebaseService.getDualConfig();

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${isEdit ? 'Editar Alumno' : 'Nuevo Alumno'}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="student-form">
                            <div class="mb-3">
                                <label class="form-label">Nombre del Alumno *</label>
                                <input type="text" class="form-control" id="st-name" required value="${student?.name || ''}">
                            </div>
                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">Curso</label>
                                    <input type="text" class="form-control" id="st-course" value="${student?.course || UIHelpers.getSchoolYearLabel()}" placeholder="2025-2026">
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">Ciclo</label>
                                    <select class="form-select" id="st-cycle">
                                        <option value="">-</option>
                                        ${this.config.cycles.map(c => `<option value="${c}" ${student?.cycle === c ? 'selected' : ''}>${c}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">Nivel</label>
                                    <select class="form-select" id="st-level">
                                        <option value="">-</option>
                                        ${this.config.levels.map(l => `<option value="${l}" ${student?.level === l ? 'selected' : ''}>${l}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Horario</label>
                                <input type="text" class="form-control" id="st-schedule" value="${student?.schedule || ''}" placeholder="L-V 8:00-14:00">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Empresa</label>
                                <select class="form-select" id="st-company">
                                    <option value="">-- Sin asignar --</option>
                                    ${this.companies.map(c => `
                                        <option value="${c.id}" ${student?.companyId === c.id ? 'selected' : ''}>${c.name}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Tutor (Equipo Dual)</label>
                                <select class="form-select" id="st-tutor">
                                    <option value="">-- Seleccionar --</option>
                                    ${this.users.map(u => `
                                        <option value="${u.uid}" ${student?.tutorId === u.uid ? 'selected' : ''}>${u.displayName || u.email}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Fecha Inicio</label>
                                    <input type="date" class="form-control" id="st-start" value="${student?.startDate || ''}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Fecha Fin</label>
                                    <input type="date" class="form-control" id="st-end" value="${student?.endDate || ''}">
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        ${isEdit ? `<button type="button" class="btn btn-danger me-auto" id="btn-delete-st">Eliminar</button>` : ''}
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-st">Guardar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-save-st').addEventListener('click', async () => {
            const name = document.getElementById('st-name').value;
            if (!name) return alert('Nombre obligatorio');

            const tutorSelect = document.getElementById('st-tutor');
            const tutorId = tutorSelect.value;
            const tutorName = tutorSelect.options[tutorSelect.selectedIndex].text;

            const data = {
                name,
                course: document.getElementById('st-course').value,
                cycle: document.getElementById('st-cycle').value,
                level: document.getElementById('st-level').value,
                schedule: document.getElementById('st-schedule').value,
                companyId: document.getElementById('st-company').value,
                tutorId: tutorId,
                tutorName: tutorId ? tutorName : null,
                startDate: document.getElementById('st-start').value,
                endDate: document.getElementById('st-end').value
            };

            try {
                if (isEdit) {
                    await this.firebaseService.updateDualStudent(student.id, data);
                } else {
                    await this.firebaseService.createDualStudent(data);
                }
                UIHelpers.showToast('Alumno guardado', 'success');
                bsModal.hide();
                this.loadStudents();
            } catch (e) {
                console.error(e);
                UIHelpers.showToast('Error al guardar', 'error');
            }
        });

        if (isEdit) {
            document.getElementById('btn-delete-st').addEventListener('click', async () => {
                if (await UIHelpers.confirm('¿Eliminar alumno?')) {
                    await this.firebaseService.deleteDualStudent(student.id);
                    bsModal.hide();
                    this.loadStudents();
                }
            });
        }

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    // ==================== CONFIGURATION ====================

    async loadConfig() {
        // Render current config lists
        this.renderConfigList('cycles', this.config.cycles);
        this.renderConfigList('levels', this.config.levels);
    }

    renderConfigList(type, items) {
        const list = document.getElementById(`${type}-list`);
        if (!items || items.length === 0) {
            list.innerHTML = '<li class="list-group-item text-muted">Ninguno configurado</li>';
            return;
        }

        list.innerHTML = items.map((item, index) => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${item}
                <button class="btn btn-sm btn-outline-danger btn-remove-config" data-type="${type}" data-idx="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </li>
        `).join('');

        list.querySelectorAll('.btn-remove-config').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeConfigItem(type, parseInt(btn.dataset.idx));
            });
        });
    }

    async addConfigItem(type, inputId) {
        const input = document.getElementById(inputId);
        const value = input.value.trim();
        if (!value) return;

        if (!this.config[type]) this.config[type] = [];
        this.config[type].push(value);
        input.value = '';

        try {
            await this.firebaseService.updateDualConfig(this.config);
            this.renderConfigList(type, this.config[type]);
        } catch (e) {
            console.error(e);
            UIHelpers.showToast('Error al guardar configuración', 'error');
        }
    }

    async removeConfigItem(type, index) {
        if (!await UIHelpers.confirm('¿Eliminar este elemento?')) return;

        this.config[type].splice(index, 1);
        try {
            await this.firebaseService.updateDualConfig(this.config);
            this.renderConfigList(type, this.config[type]);
        } catch (e) {
            console.error(e);
            UIHelpers.showToast('Error al eliminar', 'error');
        }
    }

    // ==================== CLASSROOM IMPORT ====================

    async openClassroomImportModal() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-success text-white">
                        <h5 class="modal-title"><i class="fab fa-google me-2"></i>Importar de Classroom</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                         <div class="alert alert-info small">
                            Asegúrate de permitir el acceso a Classroom si se solicita.
                         </div>
                         
                         <!-- Step 1: Select Course -->
                         <div id="step-course">
                             <h6 class="fw-bold">1. Selecciona la clase de Classroom</h6>
                             <div class="text-center py-3" id="loading-courses">
                                 <div class="spinner-border text-primary" role="status"></div>
                             </div>
                             <div id="courses-list" class="list-group mb-4 d-none">
                                 <!-- Courses here -->
                             </div>
                         </div>

                         <!-- Step 2: Target & Students -->
                         <div id="step-students" class="d-none">
                             <h6 class="fw-bold">2. Configura e Importa</h6>
                             <div class="row mb-3">
                                 <div class="col-md-4">
                                     <label class="form-label">Ciclo</label>
                                     <select class="form-select" id="import-cycle">
                                        <option value="">-</option>
                                        ${this.config.cycles.map(c => `<option value="${c}">${c}</option>`).join('')}
                                     </select>
                                 </div>
                                 <div class="col-md-4">
                                     <label class="form-label">Nivel</label>
                                     <select class="form-select" id="import-level">
                                        <option value="">-</option>
                                        ${this.config.levels.map(l => `<option value="${l}">${l}</option>`).join('')}
                                     </select>
                                 </div>
                                 <div class="col-md-4">
                                     <label class="form-label">Curso Escolar</label>
                                     <input type="text" class="form-control" id="import-year" value="${UIHelpers.getSchoolYearLabel()}">
                                 </div>
                             </div>

                             <h6 class="fw-bold mt-4">Selecciona Alumnos</h6>
                             <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="check-all">
                                <label class="form-check-label" for="check-all">Seleccionar todos</label>
                             </div>
                             <div id="students-list" class="border p-2" style="max-height: 300px; overflow-y: auto;">
                                 <!-- Students here -->
                             </div>
                         </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-success disabled" id="btn-do-import">Importar Seleccionados</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        // Load Courses
        try {
            const { courses, token } = await this.firebaseService.getClassroomCourses();
            document.getElementById('loading-courses').classList.add('d-none');
            const coursesList = document.getElementById('courses-list');
            coursesList.classList.remove('d-none');

            if (courses.length === 0) {
                coursesList.innerHTML = '<div class="alert alert-warning">No se encontraron clases activas en Classroom.</div>';
            } else {
                courses.forEach(c => {
                    const item = document.createElement('a');
                    item.href = '#';
                    item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
                    item.innerHTML = `<div><div class="fw-bold">${c.name}</div><div class="small text-muted">${c.section || ''}</div></div><i class="fas fa-chevron-right"></i>`;
                    item.addEventListener('click', async (e) => {
                        e.preventDefault();
                        // Load Students logic
                        coursesList.querySelectorAll('.active').forEach(i => i.classList.remove('active'));
                        item.classList.add('active');

                        await this.loadClassroomStudentsForImport(c.id, token);
                    });
                    coursesList.appendChild(item);
                });
            }

        } catch (e) {
            console.error(e);
            document.getElementById('loading-courses').innerHTML = '<div class="alert alert-danger">Error al conectar con Classroom. Revisa los permisos (Google Cloud Console).</div>';
        }

        document.getElementById('check-all').addEventListener('change', (e) => {
            document.querySelectorAll('.student-check').forEach(chk => chk.checked = e.target.checked);
            this.updateImportButton();
        });

        document.getElementById('btn-do-import').addEventListener('click', async () => {
            await this.executeImport(bsModal);
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async loadClassroomStudentsForImport(courseId, token) {
        document.getElementById('step-course').classList.add('d-none');
        document.getElementById('step-students').classList.remove('d-none');
        const list = document.getElementById('students-list');
        list.innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div></div>';

        try {
            const students = await this.firebaseService.getClassroomStudents(courseId, token);

            if (students.length === 0) {
                list.innerHTML = '<div class="alert alert-warning">Esta clase no tiene alumnos.</div>';
                return;
            }

            list.innerHTML = '';
            students.forEach(s => {
                const name = s.profile.name.fullName;
                const email = s.profile.emailAddress;
                const photo = s.profile.photoUrl ? `https:${s.profile.photoUrl}` : 'img/default-user.png';

                const div = document.createElement('div');
                div.className = 'form-check py-1 border-bottom';
                div.innerHTML = `
                    <input class="form-check-input student-check" type="checkbox" value="${email}" data-name="${name}">
                    <label class="form-check-label d-flex align-items-center">
                        <img src="${photo}" class="rounded-circle me-2" style="width: 24px; height: 24px;" onerror="this.src='img/default-user.png'">
                        <span>${name}</span>
                    </label>
                 `;

                div.querySelector('input').addEventListener('change', () => this.updateImportButton());
                list.appendChild(div);
            });

        } catch (e) {
            console.error(e);
            list.innerHTML = '<div class="text-danger">Error al cargar alumnos.</div>';
        }
    }

    updateImportButton() {
        const count = document.querySelectorAll('.student-check:checked').length;
        const btn = document.getElementById('btn-do-import');
        btn.textContent = `Importar (${count})`;
        if (count > 0) btn.classList.remove('disabled');
        else btn.classList.add('disabled');
    }

    async executeImport(modal) {
        const cycle = document.getElementById('import-cycle').value;
        const level = document.getElementById('import-level').value;
        const year = document.getElementById('import-year').value;

        if (!cycle || !level) {
            alert('Debes seleccionar Ciclo y Nivel');
            return;
        }

        const selected = [];
        document.querySelectorAll('.student-check:checked').forEach(chk => {
            selected.push({
                name: chk.dataset.name,
                email: chk.value,
                course: year,
                cycle: cycle,
                level: level,
                companyId: null,
                tutorId: null,
                startDate: null,
                endDate: null
            });
        });

        // Parallel import
        let imported = 0;
        for (const s of selected) {
            try {
                await this.firebaseService.createDualStudent(s);
                imported++;
            } catch (e) {
                console.error("Error importing", s.name, e);
            }
        }

        UIHelpers.showToast(`Importados ${imported} alumnos correctamente`, 'success');
        modal.hide();
        this.loadStudents();
    }
}
