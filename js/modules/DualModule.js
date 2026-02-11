import { UIHelpers } from '../UIHelpers.js';

export class DualModule {
    constructor(container, supabaseService, user, userRoles) {
        this.container = container;
        this.supabaseService = supabaseService;
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
        this.studentFilters = {
            myStudents: false,
            level: '',
            cycle: ''
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
                    <button class="nav-link" id="team-tab" data-bs-toggle="tab" data-bs-target="#team-content" type="button">
                        <i class="fas fa-chalkboard-teacher me-2"></i>Equipo Dual
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
                                <div class="d-flex gap-2">
                                    <input type="text" class="form-control form-control-sm" id="company-search-input" placeholder="Buscar empresa..." style="width: 250px;">
                                    <button class="btn btn-primary btn-sm" id="btn-add-company">
                                        <i class="fas fa-plus me-2"></i>Nueva Empresa
                                    </button>
                                </div>
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

                <!-- Team Tab -->
                <div class="tab-pane fade" id="team-content">
                    <div class="card shadow-sm">
                        <div class="card-body">
                             <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="card-title fw-bold">Tablero del Equipo Dual</h5>
                            </div>
                            <div class="table-responsive" id="team-table-container">
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
        document.getElementById('team-tab').addEventListener('shown.bs.tab', () => this.loadDualTeam());
        document.getElementById('config-tab').addEventListener('shown.bs.tab', () => this.loadConfig());

        // Add Buttons
        document.getElementById('company-search-input').addEventListener('input', () => this.renderCompaniesTable());
        document.getElementById('btn-add-company').addEventListener('click', () => this.openCompanyModal());
        document.getElementById('btn-add-student').addEventListener('click', () => this.openStudentModal());
        document.getElementById('btn-import-classroom').addEventListener('click', () => this.openClassroomImportModal());

        // Config Buttons
        document.getElementById('btn-add-cycle').addEventListener('click', () => this.addConfigItem('cycles', 'new-cycle-input'));
        document.getElementById('btn-add-level').addEventListener('click', () => this.addConfigItem('levels', 'new-level-input'));

        // Initial Load
        this.loadCompanies();
        // Pre-load config in background as it is needed for dropdowns
        this.config = await this.supabaseService.getDualConfig();
    }

    // ==================== COMPANIES ====================

    async loadCompanies() {
        const container = document.getElementById('companies-table-container');
        try {
            // Load companies, students, and active users (for prospector names)
            // Always reload students to ensure 'hosting' status is accurate if assignments changed
            let allUsers = [];
            [this.companies, this.students, allUsers] = await Promise.all([
                this.supabaseService.getCompanies(),
                this.supabaseService.getDualStudents(null),
                this.supabaseService.getAllUsers()
            ]);

            this.users = allUsers.filter(u => (u.roles || []).includes('equipo_dual'));
            this.renderCompaniesTable();
        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar empresas</div>';
        }
    }

    renderCompaniesTable() {
        const container = document.getElementById('companies-table-container');

        // Calculate Status and Prospector Name for each company before filtering/sorting
        // Status Priority:
        // 1. Hosting (Green) - Has active students
        // 2. Agreed (Light Green) - Manual status 'agreed'
        // 3. Negotiating (Yellow) - Manual status 'negotiating'
        // 4. Declined (Red) - Manual status 'declined'
        // 5. None (White/Default)

        this.companies.forEach(c => {
            // Prospector Name Resolution
            if (c.prospectorId) {
                const u = this.users.find(user => user.uid === c.prospectorId);
                c._prospectorName = u ? (u.displayName || u.name || u.email) : '-';
            } else {
                c._prospectorName = '-';
            }

            const hasStudents = this.students.some(s => s.companyId === c.id);
            if (hasStudents) {
                c._computedStatus = 'hosting';
                c._statusLabel = 'Acoge Alumnos';
                c._statusColor = 'table-success'; // Green
                c._sortBy = 1;
            } else if (c.status === 'agreed') {
                c._computedStatus = 'agreed';
                c._statusLabel = 'Acepta';
                c._statusColor = 'table-info';
                c._sortBy = 2;
            } else if (c.status === 'negotiating') {
                c._computedStatus = 'negotiating';
                c._statusLabel = 'Negociando';
                c._statusColor = 'table-warning'; // Yellow
                c._sortBy = 3;
            } else if (c.status === 'declined') {
                c._computedStatus = 'declined';
                c._statusLabel = 'No Acepta';
                c._statusColor = 'table-danger'; // Red
                c._sortBy = 4;
            } else {
                c._computedStatus = 'none';
                c._statusLabel = '-';
                c._statusColor = '';
                c._sortBy = 5;
            }
        });

        // Filter Logic
        const searchTerm = document.getElementById('company-search-input')?.value.toLowerCase().trim() || '';

        let displayCompanies = this.companies.filter(c => {
            if (searchTerm && !c.name.toLowerCase().includes(searchTerm)) return false;

            if (!this.companyFilters.withStudents && !this.companyFilters.firstYear && !this.companyFilters.secondYear && !this.companyFilters.noStudents) return true;

            const companyStudents = this.students.filter(s => s.companyId === c.id);

            if (this.companyFilters.noStudents) {
                return companyStudents.length === 0;
            }

            if (companyStudents.length === 0) return false;

            let match = true;
            if (this.companyFilters.withStudents && !this.companyFilters.firstYear && !this.companyFilters.secondYear) {
                // Pass
            }

            if (this.companyFilters.firstYear) {
                const hasFirst = companyStudents.some(s => s.level && (s.level.includes('1') || s.level.toLowerCase().includes('primero')));
                if (!hasFirst) match = false;
            }

            if (this.companyFilters.secondYear) {
                const hasSecond = companyStudents.some(s => s.level && (s.level.includes('2') || s.level.toLowerCase().includes('segundo')));
                if (!hasSecond) match = false;
            }

            return match;
        });

        // Sort Logic
        // Extend sortData to handle '_sortBy' for Status and '_prospectorName'
        if (this.companySort.column === 'status') {
            displayCompanies.sort((a, b) => {
                const dir = this.companySort.direction === 'asc' ? 1 : -1;
                return (a._sortBy - b._sortBy) * dir;
            });
        } else if (this.companySort.column === 'prospectorName') {
            displayCompanies.sort((a, b) => {
                const valA = (a._prospectorName || '').toLowerCase();
                const valB = (b._prospectorName || '').toLowerCase();
                const dir = this.companySort.direction === 'asc' ? 1 : -1;
                if (valA < valB) return -1 * dir;
                if (valA > valB) return 1 * dir;
                return 0;
            });
        } else {
            this.sortData(displayCompanies, this.companySort);
        }

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
                <button class="btn btn-sm ${this.companyFilters.noStudents ? 'btn-primary' : 'btn-outline-secondary'} btn-filter-toggle" data-filter="noStudents">
                    Sin Alumnos
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
            container.querySelectorAll('.btn-filter-toggle').forEach(btn => {
                btn.addEventListener('click', () => this.toggleCompanyFilter(btn.dataset.filter));
            });
            return;
        }

        container.innerHTML = `
            ${filtersHtml}
            <table class="table table-hover align-middle">
                <thead>
                    <tr>
                        ${buildSortHeader('Estado', 'status')}
                        ${buildSortHeader('Empresa', 'name')}
                        ${buildSortHeader('Prospección', 'prospectorName')}
                        <th>Email</th>
                        <th>Teléfono</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${displayCompanies.map(c => {
            // Find assigned students
            const assignedStudents = this.students.filter(s => s.companyId === c.id);
            const studentsHtml = assignedStudents.length > 0
                ? `<div class="mt-1 small text-primary"><i class="fas fa-user-graduate me-1"></i>${assignedStudents.map(s => s.name).join(', ')}</div>`
                : '';

            return `
                        <tr class="${c._statusColor} clickable-row" data-id="${c.id}" style="cursor:pointer">
                            <td>
                                <span class="badge bg-white text-dark border">${c._statusLabel}</span>
                            </td>
                            <td>
                                <div class="fw-bold">${c.name}</div>
                                <div class="small text-muted">${c.address || ''}</div>
                                ${c.cif ? `<div class="small text-muted">CIF: ${c.cif}</div>` : ''}
                                ${studentsHtml}
                            </td>
                            <td>
                                <div class="small text-primary fw-bold">${c._prospectorName}</div>
                            </td>
                            <td>${c.email ? `<a href="mailto:${c.email}" class="text-decoration-none" onclick="event.stopPropagation()">${c.email}</a>` : '-'}</td>
                            <td>${c.phone || '-'}</td>
                            <td>
                                <div class="d-flex gap-1" onclick="event.stopPropagation()">
                                    <button class="btn btn-sm btn-outline-dark btn-interactions-company" data-id="${c.id}" title="Seguimiento">
                                        <i class="fas fa-comments"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-primary btn-edit-company" data-id="${c.id}" title="Editar">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-info btn-history-company" data-id="${c.id}" title="Ver Historial Alumnos">
                                        <i class="fas fa-history"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `}).join('')}
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

        // Row Click Event
        container.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', (e) => {
                // Ignore if clicked on a button or link (already handled by stopPropagation but safety check)
                if (e.target.closest('button') || e.target.closest('a')) return;

                const company = this.companies.find(c => c.id === row.dataset.id);
                this.openCompanyModal(company);
            });
        });

        container.querySelectorAll('.btn-edit-company').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Double safety
                const company = this.companies.find(c => c.id === btn.dataset.id);
                this.openCompanyModal(company);
            });
        });

        container.querySelectorAll('.btn-history-company').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const company = this.companies.find(c => c.id === btn.dataset.id);
                this.showCompanyHistory(company);
            });
        });

        container.querySelectorAll('.btn-interactions-company').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const company = this.companies.find(c => c.id === btn.dataset.id);
                this.openInteractionsModal(company, 'company');
            });
        });
    }

    toggleCompanyFilter(filterKey) {
        if (filterKey === 'noStudents') {
            this.companyFilters.noStudents = !this.companyFilters.noStudents;
            if (this.companyFilters.noStudents) {
                this.companyFilters.withStudents = false;
                this.companyFilters.firstYear = false;
                this.companyFilters.secondYear = false;
            }
        } else {
            this.companyFilters[filterKey] = !this.companyFilters[filterKey];
            if (this.companyFilters[filterKey]) {
                this.companyFilters.noStudents = false;
            }
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

    async openCompanyModal(company = null) {
        const isEdit = !!company;
        const hasContact = company?.contactName || company?.phone || company?.email;

        // Load Dual Team users if not loaded
        if (this.users.length === 0) {
            const allUsers = await this.supabaseService.getAllUsers();
            this.users = allUsers.filter(u => (u.roles || []).includes('equipo_dual'));
        }

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${isEdit ? 'Editar Empresa' : 'Nueva Empresa'}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="company-form">
                            <div class="row">
                                <div class="col-md-8 mb-3">
                                    <label class="form-label">Nombre de la Empresa *</label>
                                    <input type="text" class="form-control" id="comp-name" required value="${company?.name || ''}">
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">NIF / CIF</label>
                                    <input type="text" class="form-control" id="comp-cif" value="${company?.cif || ''}">
                                </div>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-8 mb-3">
                                    <label class="form-label">Dirección</label>
                                    <input type="text" class="form-control" id="comp-address" value="${company?.address || ''}">
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">Estado (Prospección)</label>
                                    <select class="form-select" id="comp-status">
                                        <option value="none" ${!company?.status || company.status === 'none' ? 'selected' : ''}>Sin definir / En proceso</option>
                                        <option value="negotiating" ${company?.status === 'negotiating' ? 'selected' : ''}>En negociación (Amarillo)</option>
                                        <option value="agreed" ${company?.status === 'agreed' ? 'selected' : ''}>Acepta (Verde claro)</option>
                                        <option value="declined" ${company?.status === 'declined' ? 'selected' : ''}>No acepta / No (Rojo)</option>
                                    </select>
                                    <div class="form-text small">"Acoge Alumnos" (Verde) es automático si tiene alumnos asignados.</div>
                                </div>
                            </div>

                             <div class="mb-3">
                                <label class="form-label fw-bold text-primary">Responsable Prospección (Equipo TIC)</label>
                                <select class="form-select" id="comp-prospector">
                                    <option value="">-- Sin Asignar --</option>
                                    ${this.users.map(u => `<option value="${u.uid}" ${company?.prospectorId === u.uid ? 'selected' : ''}>${u.displayName || u.name || u.email}</option>`).join('')}
                                </select>
                            </div>
                            
                            <div class="mb-3">
                                <h6 class="border-bottom pb-2 mt-2">Representante / Firma Convenio</h6>
                                <div class="row">
                                    <div class="col-md-4 mb-2">
                                        <label class="form-label small">Nombre Gerente</label>
                                        <input type="text" class="form-control form-control-sm" id="comp-mgr-name" value="${company?.managerName || ''}">
                                    </div>
                                    <div class="col-md-4 mb-2">
                                        <label class="form-label small">Teléfono</label>
                                        <input type="text" class="form-control form-control-sm" id="comp-mgr-phone" value="${company?.managerPhone || ''}">
                                    </div>
                                    <div class="col-md-4 mb-2">
                                        <label class="form-label small">Email</label>
                                        <input type="email" class="form-control form-control-sm" id="comp-mgr-email" value="${company?.managerEmail || ''}">
                                    </div>
                                </div>
                            </div>

                            <div class="mb-3">
                                <h6 class="border-bottom pb-2 mt-2">Tutor Laboral (Empresa)</h6>
                                <div class="row">
                                    <div class="col-md-4 mb-2">
                                        <label class="form-label small">Nombre Tutor</label>
                                        <input type="text" class="form-control form-control-sm" id="comp-tutor-name" value="${company?.tutorName || ''}">
                                    </div>
                                    <div class="col-md-4 mb-2">
                                        <label class="form-label small">Teléfono</label>
                                        <input type="text" class="form-control form-control-sm" id="comp-tutor-phone" value="${company?.tutorPhone || ''}">
                                    </div>
                                    <div class="col-md-4 mb-2">
                                        <label class="form-label small">Email</label>
                                        <input type="email" class="form-control form-control-sm" id="comp-tutor-email" value="${company?.tutorEmail || ''}">
                                    </div>
                                </div>
                            </div>

                            <div class="mb-3">
                                <h6 class="border-bottom pb-2 mt-2">Persona de Contacto (RRHH / Admin)</h6>
                                
                                <button type="button" class="btn btn-sm btn-outline-primary mb-3 ${hasContact ? 'd-none' : ''}" id="btn-add-contact">
                                    <i class="fas fa-plus me-1"></i> Añadir Persona de Contacto
                                </button>

                                <div id="contact-fields-container" class="${hasContact ? '' : 'd-none'}">
                                    <div class="row">
                                        <div class="col-md-6 mb-2">
                                            <label class="form-label small">Nombre Persona Contacto</label>
                                            <input type="text" class="form-control form-control-sm" id="comp-contact" value="${company?.contactName || ''}">
                                        </div>
                                        <div class="col-md-6 mb-2">
                                            <label class="form-label small">Teléfono</label>
                                            <input type="text" class="form-control form-control-sm" id="comp-phone" value="${company?.phone || ''}">
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label small">Email</label>
                                        <input type="email" class="form-control form-control-sm" id="comp-email" value="${company?.email || ''}">
                                    </div>
                                </div>
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

        // Contact Toggle Logic
        document.getElementById('btn-add-contact').addEventListener('click', (e) => {
            e.currentTarget.classList.add('d-none');
            document.getElementById('contact-fields-container').classList.remove('d-none');
        });

        const saveBtn = document.getElementById('btn-save-comp');
        saveBtn.addEventListener('click', async () => {
            const name = document.getElementById('comp-name').value;
            if (!name) return alert('El nombre es obligatorio');

            const data = {
                name,
                cif: document.getElementById('comp-cif').value,
                address: document.getElementById('comp-address').value,
                status: document.getElementById('comp-status').value,
                prospectorId: document.getElementById('comp-prospector').value,

                // Manager
                managerName: document.getElementById('comp-mgr-name').value,
                managerPhone: document.getElementById('comp-mgr-phone').value,
                managerEmail: document.getElementById('comp-mgr-email').value,

                // Tutor
                tutorName: document.getElementById('comp-tutor-name').value,
                tutorPhone: document.getElementById('comp-tutor-phone').value,
                tutorEmail: document.getElementById('comp-tutor-email').value,

                // Legacy
                contactName: document.getElementById('comp-contact').value,
                phone: document.getElementById('comp-phone').value,
                email: document.getElementById('comp-email').value,

                notes: document.getElementById('comp-notes').value
            };

            try {
                if (isEdit) {
                    await this.supabaseService.updateCompany(company.id, data);
                } else {
                    await this.supabaseService.createCompany(data);
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
                        await this.supabaseService.deleteCompany(company.id);
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
        const students = await this.supabaseService.getDualStudents(null);
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
            this.students = await this.supabaseService.getDualStudents(null);

            if (this.companies.length === 0) {
                this.companies = await this.supabaseService.getCompanies();
            }

            this.renderStudentsTable();
        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar alumnos</div>';
        }
    }

    renderStudentsTable() {
        const container = document.getElementById('students-table-container');

        // Pre-calculation for Tutor Name for all students to enable proper sorting
        this.students.forEach(s => {
            if (s.tutorId) {
                const u = this.users.find(user => user.uid === s.tutorId);
                s._tutorName = u ? (u.displayName || u.name || u.email) : '-';
            } else {
                s._tutorName = '-';
            }
        });

        // Filter Logic
        let displayStudents = this.students.filter(s => {
            if (this.studentFilters.myStudents && s.tutorId !== this.user.uid) return false;

            if (this.studentFilters.level) {
                const l = (s.level || '').toLowerCase();
                const f = this.studentFilters.level.toLowerCase();
                if (!l.includes(f)) return false;
            }

            if (this.studentFilters.cycle && s.cycle !== this.studentFilters.cycle) return false;

            return true;
        });

        // Sort Logic
        if (this.studentSort.column === 'tutorName') {
            displayStudents.sort((a, b) => {
                const valA = (a._tutorName || '').toLowerCase();
                const valB = (b._tutorName || '').toLowerCase();
                const dir = this.studentSort.direction === 'asc' ? 1 : -1;
                if (valA < valB) return -1 * dir;
                if (valA > valB) return 1 * dir;
                return 0;
            });
        } else {
            this.sortData(displayStudents, this.studentSort);
        }

        const buildSortHeader = (label, col) => {
            const icon = this.studentSort.column === col
                ? (this.studentSort.direction === 'asc' ? '<i class="fas fa-sort-up"></i>' : '<i class="fas fa-sort-down"></i>')
                : '<i class="fas fa-sort text-muted" style="opacity:0.3"></i>';
            return `<th style="cursor: pointer;" data-col="${col}" class="sortable-header user-select-none">${label} ${icon}</th>`;
        };

        const activeLevel1 = this.studentFilters.level === '1' ? 'btn-primary' : 'btn-outline-secondary';
        const activeLevel2 = this.studentFilters.level === '2' ? 'btn-primary' : 'btn-outline-secondary';

        const filtersHtml = `
            <div class="mb-3 d-flex gap-2 align-items-center flex-wrap">
                <span class="fw-bold me-2"><i class="fas fa-filter me-1"></i>Filtros:</span>
                <button class="btn btn-sm ${this.studentFilters.myStudents ? 'btn-primary' : 'btn-outline-secondary'} btn-filter-toggle-st" data-filter="myStudents">
                    Mis Alumnos
                </button>
                <div class="btn-group btn-group-sm">
                    <button class="btn ${activeLevel1} btn-filter-level" data-level="1">1º</button>
                    <button class="btn ${activeLevel2} btn-filter-level" data-level="2">2º</button>
                </div>
                <select class="form-select form-select-sm" style="width: auto;" id="filter-cycle">
                    <option value="">Todos los Ciclos</option>
                    ${this.config.cycles.map(c => `<option value="${c}" ${this.studentFilters.cycle === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
                <span class="ms-auto text-muted small">Mostrando ${displayStudents.length} de ${this.students.length}</span>
            </div>
        `;

        if (displayStudents.length === 0) {
            container.innerHTML = filtersHtml + '<div class="alert alert-info py-4 text-center"><i class="fas fa-search me-2"></i>No hay alumnos que coincidan con los filtros</div>';
            this.bindStudentFilters(container);
            return;
        }

        container.innerHTML = `
            ${filtersHtml}
            <table class="table table-hover align-middle">
                <thead>
                    <tr>
                        ${buildSortHeader('Alumno', 'name')}
                        ${buildSortHeader('Ciclo', 'cycle')}
                        ${buildSortHeader('Nivel', 'level')}
                        ${buildSortHeader('Empresa', 'companyId')}
                        ${buildSortHeader('Tutor Docente', 'tutorName')}
                        <th>Fechas</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${displayStudents.map(s => {
            const company = this.companies.find(c => c.id === s.companyId);
            let companyHtml = '';
            if (company) {
                // If assigned, show company name + (optional) observations as subtitle
                companyHtml = `<a href="#" class="text-decoration-none fw-bold btn-link-company" data-cid="${company.id}">${company.name}</a>`;
                if (s.possibleCompany) {
                    companyHtml += `<div class="small text-muted fst-italic mt-1" style="line-height:1.1; font-size:0.75rem;">${s.possibleCompany}</div>`;
                }
            } else {
                // If not assigned
                if (s.possibleCompany) {
                    // Show observations as main text
                    companyHtml = `<span class="fst-italic text-dark">${s.possibleCompany}</span>`;
                } else {
                    companyHtml = '<span class="text-danger">Sin asignar</span>';
                }
            }

            s._companyName = company ? company.name : (s.possibleCompany || 'zzz');

            // Row Color Logic
            let rowClass = '';
            if (company) {
                rowClass = 'table-success'; // Green: Assigned
            } else if (s.status === 'in_process') {
                rowClass = 'table-warning'; // Yellow: In Process
            } else {
                rowClass = 'table-danger'; // Red: Pending
            }

            return `
                        <tr class="${rowClass} clickable-row" data-id="${s.id}" style="cursor:pointer">
                            <td>
                                <div class="fw-bold">${s.name}</div>
                                <div class="small text-muted">${s.course || ''}</div>
                            </td>
                            <td><span class="badge bg-white text-dark border">${s.cycle || '-'}</span></td>
                            <td><span class="badge bg-white text-dark border">${s.level || '-'}</span></td>
                            <td>${companyHtml}</td>
                            <td><div class="small text-primary fw-bold">${s._tutorName}</div></td>
                            <td>${s.startDate} a ${s.endDate}</td>
                            <td>
                                <div class="d-flex gap-1" onclick="event.stopPropagation()">
                                    <button class="btn btn-sm btn-outline-dark btn-interactions-student" data-id="${s.id}" title="Seguimiento">
                                        <i class="fas fa-comments"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-primary btn-edit-student" data-id="${s.id}" title="Editar">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        `;

        this.bindStudentFilters(container);

        container.querySelectorAll('.sortable-header').forEach(th => {
            th.addEventListener('click', () => this.toggleStudentSort(th.dataset.col));
        });

        // Row Click Event
        container.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', (e) => {
                // Ignore if clicked on a button or link
                if (e.target.closest('button') || e.target.closest('a')) return;

                const student = this.students.find(s => s.id === row.dataset.id);
                this.openStudentModal(student);
            });
        });

        container.querySelectorAll('.btn-edit-student').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const student = this.students.find(s => s.id === btn.dataset.id);
                this.openStudentModal(student);
            });
        });

        container.querySelectorAll('.btn-interactions-student').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const student = this.students.find(s => s.id === btn.dataset.id);
                this.openInteractionsModal(student, 'student');
            });
        });

        container.querySelectorAll('.btn-link-company').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent row click
                e.preventDefault();
                const company = this.companies.find(c => c.id === btn.dataset.cid);
                if (company) this.openCompanyModal(company);
            });
        });

    }

    bindStudentFilters(container) {
        container.querySelectorAll('.btn-filter-toggle-st').forEach(btn => {
            btn.addEventListener('click', () => this.toggleStudentFilter(btn.dataset.filter));
        });

        container.querySelectorAll('.btn-filter-level').forEach(btn => {
            btn.addEventListener('click', () => {
                const level = btn.dataset.level;
                // Toggle if same clicked
                if (this.studentFilters.level === level) this.studentFilters.level = '';
                else this.studentFilters.level = level;
                this.renderStudentsTable();
            });
        });

        const cycleSelect = container.querySelector('#filter-cycle');
        if (cycleSelect) {
            cycleSelect.addEventListener('change', (e) => {
                this.studentFilters.cycle = e.target.value;
                this.renderStudentsTable();
            });
        }
    }

    toggleStudentFilter(filter) {
        if (filter === 'myStudents') {
            this.studentFilters.myStudents = !this.studentFilters.myStudents;
        }
        this.renderStudentsTable();
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
            const allUsers = await this.supabaseService.getAllUsers();
            this.users = allUsers.filter(u => (u.roles || []).includes('equipo_dual'));
        }

        // Ensure config is loaded
        if (!this.config.cycles.length) this.config = await this.supabaseService.getDualConfig();

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
                                <label class="form-label">Estado (Si no tiene empresa)</label>
                                <select class="form-select" id="st-status">
                                    <option value="pending" ${(!student?.status || student?.status === 'pending') ? 'selected' : ''}>Pendiente de asignar (Rojo)</option>
                                    <option value="in_process" ${student?.status === 'in_process' ? 'selected' : ''}>En proceso / Entrevistas (Amarillo)</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Posible Empresa / Observaciones</label>
                                <input type="text" class="form-control" id="st-possible-company" value="${student?.possibleCompany || ''}" placeholder="Nombre de empresa tentativa o notas...">
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
                endDate: document.getElementById('st-end').value,
                status: document.getElementById('st-status').value,
                possibleCompany: document.getElementById('st-possible-company').value
            };

            try {
                if (isEdit) {
                    await this.supabaseService.updateDualStudent(student.id, data);
                } else {
                    await this.supabaseService.createDualStudent(data);
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
                    await this.supabaseService.deleteDualStudent(student.id);
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
            await this.supabaseService.updateDualConfig(this.config);
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
            await this.supabaseService.updateDualConfig(this.config);
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
            const { courses, token } = await this.supabaseService.getClassroomCourses();
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
            const students = await this.supabaseService.getClassroomStudents(courseId, token);

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
                await this.supabaseService.createDualStudent(s);
                imported++;
            } catch (e) {
                console.error("Error importing", s.name, e);
            }
        }

        UIHelpers.showToast(`Importados ${imported} alumnos correctamente`, 'success');
        modal.hide();
        this.loadStudents();
    }
    async openInteractionsModal(entity, type) {
        // entity: company or student object
        // type: 'company' or 'student'

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Seguimiento: ${entity.name}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="card mb-3 bg-light">
                            <div class="card-body py-2">
                                <form id="interaction-form" class="row g-2 align-items-center">
                                    <div class="col-auto">
                                        <select class="form-select form-select-sm" id="int-type">
                                            <option value="visit">Visita</option>
                                            <option value="call">Llamada</option>
                                            <option value="email">Email</option>
                                            <option value="other">Otro</option>
                                        </select>
                                    </div>
                                    <div class="col-auto">
                                        <input type="date" class="form-control form-control-sm" id="int-date" value="${new Date().toISOString().split('T')[0]}">
                                    </div>
                                    <div class="col">
                                        <input type="text" class="form-control form-control-sm" id="int-notes" placeholder="Notas / Resumen..." required>
                                    </div>
                                    <div class="col-auto">
                                        <button type="submit" class="btn btn-sm btn-primary">Añadir</button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        <div id="interactions-list" style="max-height: 400px; overflow-y: auto;">
                            <div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const form = document.getElementById('interaction-form');
        const listContainer = document.getElementById('interactions-list');

        const loadInteractions = async () => {
            try {
                let interactions = [];

                if (type === 'company') {
                    // 1. Company Interactions
                    const companyInteractions = await this.supabaseService.getDualInteractions(entity.id);
                    companyInteractions.forEach(i => i._sourceLabel = 'Empresa (Prospección)');

                    // 2. Student Interactions
                    const assignedStudents = this.students.filter(s => s.companyId === entity.id);

                    const studentPromises = assignedStudents.map(async s => {
                        const sInts = await this.supabaseService.getDualInteractions(s.id);
                        sInts.forEach(i => {
                            i._sourceLabel = `Alumno: ${s.name}`;
                            i._isStudent = true;
                        });
                        return sInts;
                    });

                    const studentsInteractionsResults = await Promise.all(studentPromises);
                    const allStudentInteractions = studentsInteractionsResults.flat();

                    interactions = [...companyInteractions, ...allStudentInteractions];
                } else {
                    interactions = await this.supabaseService.getDualInteractions(entity.id);
                }

                // Sort by date desc
                interactions.sort((a, b) => new Date(b.date) - new Date(a.date));

                if (interactions.length === 0) {
                    listContainer.innerHTML = '<div class="text-muted text-center py-3">No hay registros de seguimiento.</div>';
                    return;
                }

                listContainer.innerHTML = `
                    <div class="list-group list-group-flush">
                        ${interactions.map(i => {
                    let icon = 'fa-comment';
                    let color = 'text-secondary';
                    if (i.type === 'visit') { icon = 'fa-walking'; color = 'text-success'; }
                    else if (i.type === 'call') { icon = 'fa-phone'; color = 'text-info'; }
                    else if (i.type === 'email') { icon = 'fa-envelope'; color = 'text-warning'; }

                    const dateParts = i.date.split('-');
                    const fmtDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

                    // Source Badge
                    const sourceBadge = i._sourceLabel
                        ? `<span class="badge ${i._isStudent ? 'bg-info text-dark' : 'bg-light text-dark border'} ms-2">${i._sourceLabel}</span>`
                        : '';

                    return `
                        <div class="list-group-item px-0">
                            <div class="d-flex justify-content-between align-items-start">
                                <div class="me-3">
                                    <i class="fas ${icon} ${color} fa-lg"></i>
                                </div>
                                <div class="flex-grow-1">
                                    <div class="d-flex justify-content-between">
                                        <div class="fw-bold small">${fmtDate} <span class="text-muted fw-normal ms-1">(${i.authorName || '?'})</span> ${sourceBadge}</div>
                                        <div>
                                            ${(i.author === this.user.uid || this.userRoles.admin) ? `
                                            <button class="btn btn-sm text-danger p-0 btn-del-int" data-id="${i.id}"><i class="fas fa-times"></i></button>
                                            ` : ''}
                                        </div>
                                    </div>
                                    <div class="small mt-1">${i.notes}</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
                    </div>
                `;

                listContainer.querySelectorAll('.btn-del-int').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (confirm('¿Borrar seguimiento?')) {
                            await this.supabaseService.deleteDualInteraction(btn.dataset.id);
                            loadInteractions();
                        }
                    });
                });

            } catch (e) {
                console.error(e);
                listContainer.innerHTML = '<div class="text-danger">Error al cargar historial.</div>';
            }
        };

        // Initial Load
        loadInteractions();

        // Add New Interaction
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const notes = document.getElementById('int-notes').value.trim();
            if (!notes) return;

            const data = {
                type: document.getElementById('int-type').value,
                date: document.getElementById('int-date').value,
                notes: notes,
                relatedId: entity.id,
                relatedType: type,
                author: this.user.uid,
                authorName: this.user.displayName || this.user.email
            };

            try {
                await this.supabaseService.addDualInteraction(data);
                document.getElementById('int-notes').value = '';
                loadInteractions();
            } catch (error) {
                console.error(error);
                UIHelpers.showToast('Error al añadir registro', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async loadDualTeam() {
        const container = document.getElementById('team-table-container');
        try {
            // Ensure we have users, students, and companies loaded
            if (this.users.length === 0) {
                const allUsers = await this.supabaseService.getAllUsers();
                this.users = allUsers.filter(u => (u.roles || []).includes('equipo_dual'));
            }
            if (this.students.length === 0) this.students = await this.supabaseService.getDualStudents(null);
            if (this.companies.length === 0) this.companies = await this.supabaseService.getCompanies();

            this.renderDualTeamTable();
        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar datos del equipo</div>';
        }
    }

    renderDualTeamTable() {
        const container = document.getElementById('team-table-container');

        // Pre-calculate Totals for Targets
        const totalHours1 = this.users.reduce((acc, u) => acc + (parseInt(u.dualHours1) || 0), 0);
        const totalHours2 = this.users.reduce((acc, u) => acc + (parseInt(u.dualHours2) || 0), 0);

        const totalStudents1 = this.students.filter(s => s.level === '1' || s.level === '1º').length;
        const totalStudents2 = this.students.filter(s => s.level === '2' || s.level === '2º').length;

        // Calculate Stats
        const stats = this.users.map(u => {
            const students1 = this.students.filter(s => s.tutorId === u.uid && (s.level === '1' || s.level === '1º')).length;
            const students2 = this.students.filter(s => s.tutorId === u.uid && (s.level === '2' || s.level === '2º')).length;
            const companies = this.companies.filter(c => c.prospectorId === u.uid).length;

            // Calculate Targets
            const userHours1 = parseInt(u.dualHours1) || 0;
            const userHours2 = parseInt(u.dualHours2) || 0;
            const target1 = totalHours1 > 0 ? Math.round((userHours1 / totalHours1) * totalStudents1) : 0;
            const target2 = totalHours2 > 0 ? Math.round((userHours2 / totalHours2) * totalStudents2) : 0;

            return {
                ...u,
                name: u.displayName || u.email,
                s1: students1,
                s2: students2,
                t1: target1,
                t2: target2,
                totalStudents: students1 + students2,
                totalTarget: target1 + target2,
                companies: companies
            };
        });

        // Add 'Sin Asignar' stats
        const unassignedS1 = this.students.filter(s => !s.tutorId && (s.level === '1' || s.level === '1º')).length;
        const unassignedS2 = this.students.filter(s => !s.tutorId && (s.level === '2' || s.level === '2º')).length;
        const unassignedC = this.companies.filter(c => !c.prospectorId).length;

        if (unassignedS1 > 0 || unassignedS2 > 0 || unassignedC > 0) {
            stats.push({
                isUnassigned: true,
                name: '<span class="text-danger fw-bold">Sin Asignar / Otros</span>',
                s1: unassignedS1,
                s2: unassignedS2,
                t1: '-',
                t2: '-',
                totalStudents: unassignedS1 + unassignedS2,
                totalTarget: '-',
                companies: unassignedC
            });
        }

        container.innerHTML = `
            <table class="table table-striped table-hover align-middle">
                <thead class="table-dark">
                    <tr>
                        <th>Tutor Dual</th>
                        <th class="text-center">Alumnos 1º (Asig / Obj)</th>
                        <th class="text-center">Alumnos 2º (Asig / Obj)</th>
                        <th class="text-center">Total Alumnos (Asig / Obj)</th>
                        <th class="text-center">Empresas Contactadas</th>
                    </tr>
                </thead>
                <tbody>
                    ${stats.map((s, index) => `
                        <tr class="${s.isUnassigned ? '' : 'clickable-row'}" data-index="${index}" style="${s.isUnassigned ? '' : 'cursor:pointer'}">
                            <td class="fw-bold">${s.name}</td>
                            <td class="text-center">
                                <span class="fw-bold">${s.s1}</span> 
                                <span class="text-muted small">/ ${s.t1}</span>
                            </td>
                            <td class="text-center">
                                <span class="fw-bold">${s.s2}</span> 
                                <span class="text-muted small">/ ${s.t2}</span>
                            </td>
                            <td class="text-center">
                                <span class="fw-bold">${s.totalStudents}</span>
                                <span class="text-muted small">/ ${s.totalTarget}</span>
                            </td>
                            <td class="text-center">${s.companies}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <h6 class="fw-bold mt-4 mb-3">Resumen de Horas de Dedicación</h6>
            <table class="table table-sm table-bordered table-hover align-middle">
                <thead class="table-light">
                    <tr>
                        <th>Tutor</th>
                        <th class="text-center">Horas 1º</th>
                        <th class="text-center">Horas 2º</th>
                        <th class="text-center">Total Horas</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.users.map(u => {
            const h1 = parseInt(u.dualHours1) || 0;
            const h2 = parseInt(u.dualHours2) || 0;
            return `
                        <tr>
                            <td>${u.displayName || u.email}</td>
                            <td class="text-center">${h1}</td>
                            <td class="text-center">${h2}</td>
                            <td class="text-center fw-bold">${h1 + h2}</td>
                        </tr>`;
        }).join('')}
                </tbody>
                <tfoot class="table-group-divider fw-bold bg-light">
                    <tr>
                        <td>TOTALES</td>
                        <td class="text-center">${totalHours1}</td>
                        <td class="text-center">${totalHours2}</td>
                        <td class="text-center">${totalHours1 + totalHours2}</td>
                    </tr>
                </tfoot>
            </table>
        `;

        container.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', () => {
                const index = row.dataset.index;
                const user = stats[index];
                if (!user.isUnassigned) {
                    this.openTeamMemberModal(user);
                }
            });
        });
    }

    async openTeamMemberModal(user) {
        // Calculate Totals for Targets
        const totalHours1 = this.users.reduce((acc, u) => acc + (parseInt(u.dualHours1) || 0), 0);
        const totalHours2 = this.users.reduce((acc, u) => acc + (parseInt(u.dualHours2) || 0), 0);

        const totalStudents1 = this.students.filter(s => s.level === '1' || s.level === '1º').length;
        const totalStudents2 = this.students.filter(s => s.level === '2' || s.level === '2º').length;

        const userHours1 = parseInt(user.dualHours1) || 0;
        const userHours2 = parseInt(user.dualHours2) || 0;

        const target1 = totalHours1 > 0 ? Math.round((userHours1 / totalHours1) * totalStudents1) : 0;
        const target2 = totalHours2 > 0 ? Math.round((userHours2 / totalHours2) * totalStudents2) : 0;

        // Fetch History
        let historyHtml = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"></div></div>';

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Ficha Tutor: ${user.name}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Hours Configuration -->
                        <div class="card mb-4">
                            <div class="card-header bg-light fw-bold">Configuración de Horas y Cupos</div>
                            <div class="card-body">
                                <form id="hours-form" class="row align-items-end">
                                    <div class="col-md-5">
                                        <label class="form-label">Horas 1º Curso</label>
                                        <div class="input-group">
                                            <input type="number" class="form-control" id="hours-1" value="${userHours1}" min="0">
                                            <span class="input-group-text bg-white text-muted small">
                                                Actual: ${user.s1} / Objetivo: <span class="fw-bold text-primary ms-1">${target1}</span>
                                            </span>
                                        </div>
                                    </div>
                                    <div class="col-md-5">
                                        <label class="form-label">Horas 2º Curso</label>
                                        <div class="input-group">
                                            <input type="number" class="form-control" id="hours-2" value="${userHours2}" min="0">
                                            <span class="input-group-text bg-white text-muted small">
                                                Actual: ${user.s2} / Objetivo: <span class="fw-bold text-primary ms-1">${target2}</span>
                                            </span>
                                        </div>
                                    </div>
                                    <div class="col-md-2">
                                        <button type="button" class="btn btn-success w-100" id="btn-save-hours">Guardar</button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        <!-- Interaction History -->
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="fw-bold mb-0">Historial de Actividad</h6>
                            <span class="text-muted small">Últimas interacciones realizadas</span>
                        </div>
                        <div class="list-group list-group-flush border rounded" id="history-container" style="max-height: 400px; overflow-y: auto;">
                            ${historyHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        modal.addEventListener('hidden.bs.modal', () => modal.remove());

        // Save Hours Logic
        document.getElementById('btn-save-hours').addEventListener('click', async () => {
            const h1 = parseInt(document.getElementById('hours-1').value) || 0;
            const h2 = parseInt(document.getElementById('hours-2').value) || 0;

            try {
                await this.supabaseService.updateUser(user.uid, {
                    dualHours1: h1,
                    dualHours2: h2
                });

                // Update local state and UI
                user.dualHours1 = h1;
                user.dualHours2 = h2;

                // Refresh main table and close modal or refresh modal stats? 
                // For simplicity, close and refresh main table
                bsModal.hide();
                UIHelpers.showToast('Horas actualizadas correctmente', 'success');
                this.loadDualTeam(); // Reload to recalc targets if needed (though targets are dynamic)
            } catch (e) {
                console.error(e);
                alert('Error al guardar horas');
            }
        });

        // Load History
        try {
            const interactions = await this.supabaseService.getInteractionsByAuthor(user.uid);

            const historyContainer = document.getElementById('history-container');
            if (interactions.length === 0) {
                historyContainer.innerHTML = '<div class="text-center py-3 text-muted">No hay actividad registrada.</div>';
            } else {
                historyContainer.innerHTML = interactions.map(i => {
                    // Determine Context (Company or Student Name)
                    let contextName = 'Desconocido';
                    let contextBadge = '';

                    if (i.relatedType === 'company') {
                        const c = this.companies.find(comp => comp.id === i.relatedId);
                        contextName = c ? c.name : 'Empresa eliminada';
                        contextBadge = '<span class="badge bg-primary me-2">Empresa</span>';
                    } else {
                        const s = this.students.find(stud => stud.id === i.relatedId);
                        contextName = s ? s.name : 'Alumno eliminado';
                        contextBadge = '<span class="badge bg-success me-2">Alumno</span>';
                    }

                    return `
                        <div class="list-group-item">
                            <div class="d-flex justify-content-between align-items-start mb-1">
                                <div>
                                    ${contextBadge}
                                    <span class="fw-bold">${contextName}</span>
                                </div>
                                <small class="text-muted">${i.date}</small>
                            </div>
                            <div class="d-flex align-items-center mb-1">
                                <span class="badge bg-secondary me-2">${UIHelpers.getInteractionIcon(i.type)} ${i.type}</span>
                            </div>
                            <div class="small text-muted fst-italic">"${i.notes}"</div>
                        </div>
                    `;
                }).join('');
            }
        } catch (e) {
            console.error(e);
            document.getElementById('history-container').innerHTML = '<div class="text-danger p-3">Error al cargar historial</div>';
        }
    }
}
