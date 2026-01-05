import { Calendar } from '../Calendar.js';
import { UIHelpers } from '../UIHelpers.js';

export class CalendarModule {
    constructor(container, firebaseService, user, isAdmin, userRoles, moduleConfig) {
        this.container = container;
        this.firebaseService = firebaseService;
        this.user = user;
        this.isAdmin = isAdmin;
        this.userRoles = userRoles || [];
        this.moduleConfig = moduleConfig || {};
        this.canEditSlots = this.userRoles.includes('director');
        this.canAddEvents = this.userRoles.includes('equipo_directivo');

        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="module-header">
                <h2><i class="fas fa-calendar-alt me-2"></i>Calendario de Disponibilidad</h2>
                <p class="text-muted">Gestiona tus días disponibles</p>
            </div>

            <!-- Management Legend (Visible only to Director) -->
            <div id="admin-legend-module" class="alert alert-warning border-warning ${this.canEditSlots ? '' : 'd-none'} mb-4" role="alert">
                <div class="d-flex align-items-center">
                    <i class="fas fa-info-circle fa-2x me-3"></i>
                    <div>
                        <h5 class="alert-heading fw-bold mb-1">Controles de Gestión</h5>
                        <ul class="mb-0 ps-3 small">
                            <li><strong>Clic Izquierdo</strong> en huecos: <span class="text-danger fw-bold">-1 Hueco</span>.</li>
                            <li><strong>Clic Derecho</strong> en huecos: <span class="text-success fw-bold">+1 Hueco</span>.</li>
                            <li><strong>Shift + Clic</strong>: Vincular documento.</li>
                            <li><strong>Ctrl + Clic</strong> en cualquier día: Marcar/Desmarcar <span class="text-danger fw-bold">Festivo</span>.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Event Legend (Visible only to Equipo Directivo) -->
            <div id="event-legend-module" class="alert alert-info border-info ${this.canAddEvents ? '' : 'd-none'} mb-4" role="alert">
                <div class="d-flex align-items-center">
                    <i class="fas fa-calendar-plus fa-2x me-3"></i>
                    <div>
                        <h5 class="alert-heading fw-bold mb-1">Gestión de Eventos</h5>
                        <p class="mb-0 small">Haz <strong>Doble Clic</strong> en un día para añadir un evento (Reuniones, Claustros, Evaluaciones, etc.).</p>
                    </div>
                </div>
            </div>

            <!-- TIC Control Panel -->
            ${this.userRoles.includes('equipo_tic') ? `
            <div class="d-flex justify-content-end mb-3">
                 <button id="btn-sync-drive" class="btn btn-outline-success">
                    <i class="fab fa-google-drive me-2"></i>Sincronizar Partes de Guardia (Drive)
                 </button>
            </div>
            ` : ''}

            <div class="d-flex justify-content-between align-items-center mb-4">
                <button id="prev-month-module" class="btn btn-outline-primary"><i class="fas fa-chevron-left"></i> Anterior</button>
                <h3 id="current-month-year-module" class="m-0 fw-bold text-primary"></h3>
                <button id="next-month-module" class="btn btn-outline-primary">Siguiente <i class="fas fa-chevron-right"></i></button>
            </div>

            <!-- Calendar Grid -->
            <div class="card shadow-sm border-0">
                <div class="card-body p-0">
                    <div id="calendar-grid-module" class="calendar-grid">
                        <!-- Days will be rendered here by Calendar.js -->
                    </div>
                </div>
            </div>

            <!-- Legend -->
            <div class="mt-4 d-flex gap-3 justify-content-center flex-wrap">
                <div class="d-flex align-items-center"><span class="badge bg-success me-2">4-3</span> Alta Disponibilidad</div>
                <div class="d-flex align-items-center"><span class="badge bg-warning text-dark me-2">2-1</span> Baja Disponibilidad</div>
                <div class="d-flex align-items-center"><span class="badge bg-danger me-2">0</span> Completo</div>
                <div class="d-flex align-items-center"><span class="badge bg-secondary me-2">Festivo</span> No Disponible</div>
            </div>
        `;

        this.initCalendar();
    }

    initCalendar() {
        // Find module-specific elements
        const gridElement = document.getElementById('calendar-grid-module');
        const monthLabel = document.getElementById('current-month-year-module');
        const prevBtn = document.getElementById('prev-month-module');
        const nextBtn = document.getElementById('next-month-module');

        // Pass explicit elements to Calendar constructor
        this.calendar = new Calendar({
            grid: gridElement,
            monthLabel: monthLabel,
            prevBtn: prevBtn,
            nextBtn: nextBtn
        }, this.firebaseService, this.user, this.userRoles, {
            showNavigationIcons: true,
            moduleConfig: this.moduleConfig // Pass config for visibility checks
        }); // Pass roles

        // Attach global function for event creation
        window.addCalendarEvent = (dateStr) => this.showAddEventModal(dateStr);

        // TIC Sync Handler
        const syncBtn = document.getElementById('btn-sync-drive');
        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                const year = this.calendar.currentYear;
                const month = this.calendar.currentMonth;
                const monthName = document.getElementById('current-month-year-module').textContent;

                if (!confirm(`¿Sincronizar partes de guardia para ${monthName} desde Google Drive?`)) return;

                const originalText = syncBtn.innerHTML;
                syncBtn.disabled = true;
                syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Sincronizando...';

                try {
                    const count = await this.firebaseService.syncDriveEvents(year, month);
                    UIHelpers.showToast(`Sincronización completada. ${count} documentos vinculados.`, 'success');
                } catch (error) {
                    console.error(error);
                    UIHelpers.showToast(error.message, 'error');
                } finally {
                    syncBtn.disabled = false;
                    syncBtn.innerHTML = originalText;
                }
            });
        }
    }

    showAddEventModal(dateStr) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Añadir Evento (${dateStr})</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Título</label>
                            <input type="text" class="form-control" id="event-title" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Hora (Opcional)</label>
                            <input type="time" class="form-control" id="event-time">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Enlace / Videollamada (Opcional)</label>
                            <input type="url" class="form-control" id="event-link" placeholder="https://meet.google.com/...">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Tipo</label>
                            <select class="form-select" id="event-type">
                                <option value="meeting">Reunión General</option>
                                <option value="evaluation">Evaluación</option>
                                <option value="cloister">Claustro</option>
                                <option value="other">Otro</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-event">Guardar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-save-event').addEventListener('click', async () => {
            const title = document.getElementById('event-title').value;
            const type = document.getElementById('event-type').value;
            const time = document.getElementById('event-time').value;
            const link = document.getElementById('event-link').value;

            if (!title) return;

            try {
                // Call service to add event
                await this.firebaseService.addCalendarEvent(dateStr, {
                    title,
                    type,
                    time: time || null,
                    link: link || null
                });
                UIHelpers.showToast('Evento añadido', 'success');
                bsModal.hide();
                // Calendar list updates automatically via listener
            } catch (error) {
                console.error(error);
                UIHelpers.showToast('Error al añadir evento', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    destroy() {
        if (this.calendar && this.calendar.unsubscribe) {
            this.calendar.unsubscribe();
        }
        delete window.addCalendarEvent;
    }
}
