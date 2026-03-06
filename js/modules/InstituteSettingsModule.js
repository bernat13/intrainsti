
import { UIHelpers } from '../UIHelpers.js';

export class InstituteSettingsModule {
    constructor(container, supabaseService) {
        this.container = container;
        this.supabaseService = supabaseService;
        this.institute = this.supabaseService.getInstitute();
        this.render();
    }

    async render() {
        // Double check access (though Router should handle it)
        const user = await this.supabaseService.getCurrentUser();
        const roles = await this.supabaseService.getUserRoles(user.id);
        const hasAccess = roles.includes('admin') || roles.includes('director') || roles.includes('equipo_directivo');

        if (!hasAccess) {
            this.container.innerHTML = '<div class="alert alert-danger m-4">No tienes permiso para acceder a esta configuración.</div>';
            return;
        }

        this.container.innerHTML = `
            <div class="module-header bg-white p-4 rounded shadow-sm mb-4">
                <h2><i class="fas fa-cogs me-2"></i>Configuración del Centro</h2>
                <p class="text-muted mb-0">Gestiona la información general y los horarios del instituto.</p>
            </div>

            <div class="row">
                <!-- General Info -->
                <div class="col-lg-6 mb-4">
                    <div class="card shadow-sm h-100">
                        <div class="card-header bg-light">
                            <h5 class="card-title mb-0"><i class="fas fa-info-circle me-2"></i>Información General</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">Nombre del Instituto</label>
                                <input type="text" class="form-control" id="inst-name" value="${UIHelpers.escapeHtml(this.institute.name || '')}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Dirección</label>
                                <input type="text" class="form-control" id="inst-address" value="${UIHelpers.escapeHtml(this.institute.address || '')}" placeholder="C/ Ejemplo, 123">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Página Web</label>
                                <input type="url" class="form-control" id="inst-website" value="${UIHelpers.escapeHtml(this.institute.website || '')}" placeholder="https://...">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Time Slots -->
                <div class="col-lg-6 mb-4">
                    <div class="card shadow-sm h-100">
                        <div class="card-header bg-light d-flex justify-content-between align-items-center">
                            <h5 class="card-title mb-0"><i class="fas fa-clock me-2"></i>Horario de Clases</h5>
                            <button class="btn btn-sm btn-outline-success" id="btn-add-slot">
                                <i class="fas fa-plus"></i> Añadir Franja
                            </button>
                        </div>
                        <div class="card-body p-0">
                            <div class="alert alert-info small m-3">
                                <i class="fas fa-info-circle"></i> Estas franjas se utilizan para las reservas del Salón de Actos y Carros de Portátiles.
                            </div>
                            <div class="table-responsive">
                                <table class="table table-hover mb-0" id="slots-table">
                                    <thead class="table-light">
                                        <tr>
                                            <th style="width: 120px;">Inicio</th>
                                            <th style="width: 120px;">Fin</th>
                                            <th>Descripción</th>
                                            <th style="width: 50px;"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="slots-body">
                                        <!-- Rows generated here -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="fixed-bottom p-3 bg-white border-top shadow-lg d-flex justify-content-end" style="z-index: 1000;">
                <button class="btn btn-primary btn-lg px-5" id="btn-save-settings">
                    <i class="fas fa-save me-2"></i>Guardar Cambios
                </button>
            </div>
            <div style="height: 80px;"></div> <!-- Spacer -->
        `;

        this.renderSlots();
        this.bindEvents();
    }

    renderSlots() {
        const body = document.getElementById('slots-body');
        const slots = this.institute.time_slots || [];

        // Sort by start time
        slots.sort((a, b) => a.start.localeCompare(b.start));

        body.innerHTML = slots.map((slot, index) => `
            <tr data-index="${index}">
                <td>
                    <input type="time" class="form-control form-control-sm slot-start" value="${slot.start}">
                </td>
                <td>
                    <input type="time" class="form-control form-control-sm slot-end" value="${slot.end}">
                </td>
                <td>
                    <input type="text" class="form-control form-control-sm slot-label" value="${UIHelpers.escapeHtml(slot.label)}" placeholder="Ej: 1ª Hora">
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-danger btn-remove-slot">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        body.querySelectorAll('.btn-remove-slot').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tr = e.target.closest('tr');
                tr.remove();
            });
        });
    }

    bindEvents() {
        document.getElementById('btn-add-slot').addEventListener('click', () => {
            const body = document.getElementById('slots-body');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="time" class="form-control form-control-sm slot-start"></td>
                <td><input type="time" class="form-control form-control-sm slot-end"></td>
                <td><input type="text" class="form-control form-control-sm slot-label" placeholder="Nueva franja"></td>
                <td>
                    <button class="btn btn-sm btn-outline-danger btn-remove-slot">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            `;
            body.appendChild(tr);
            tr.querySelector('.btn-remove-slot').addEventListener('click', () => tr.remove());
        });

        document.getElementById('btn-save-settings').addEventListener('click', () => this.saveSettings());
    }

    async saveSettings() {
        const btn = document.getElementById('btn-save-settings');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

        try {
            // Gather General Info
            const name = document.getElementById('inst-name').value.trim();
            const address = document.getElementById('inst-address').value.trim();
            const website = document.getElementById('inst-website').value.trim();

            if (!name) throw new Error("El nombre del instituto es obligatorio.");

            // Gather Slots
            const slots = [];
            document.querySelectorAll('#slots-body tr').forEach(tr => {
                const start = tr.querySelector('.slot-start').value;
                const end = tr.querySelector('.slot-end').value;
                const label = tr.querySelector('.slot-label').value.trim();

                if (start && end && label) {
                    slots.push({ start, end, label });
                }
            });

            if (slots.length === 0) {
                if (!confirm("No has definido ninguna franja horaria. ¿Seguro que quieres guardar sin horario?")) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save me-2"></i>Guardar Cambios';
                    return;
                }
            }

            // Save to Backend
            await this.supabaseService.updateInstituteDetails({
                name,
                address,
                website,
                timeSlots: slots
            });

            // Update UI/Toast
            UIHelpers.showToast('Configuración guardada correctamente', 'success');

            // Update local object to reflect potential processing/standardization
            this.institute = this.supabaseService.getInstitute();

            // Re-render slots to sort them again
            this.renderSlots();

        } catch (error) {
            console.error(error);
            UIHelpers.showToast('Error al guardar: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save me-2"></i>Guardar Cambios';
        }
    }
}
