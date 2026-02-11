import { UIHelpers } from '../UIHelpers.js';
import { Calendar } from '../Calendar.js';

export class LaptopCartsModule {
    constructor(container, supabaseService, user, userRoles, isAdmin) {
        this.container = container;
        this.supabaseService = supabaseService;
        this.user = user;
        this.userRoles = userRoles;
        this.isAdmin = isAdmin;
        this.isTic = userRoles.includes('equipo_tic') || isAdmin;

        this.currentDate = new Date();

        // Navigation from Calendar
        const pendingDate = localStorage.getItem('pendingDate');
        if (pendingDate) {
            this.currentDate = new Date(pendingDate);
            localStorage.removeItem('pendingDate');
        }
        this.carts = [];
        this.reservations = [];

        window.currentCartsModule = this;

        // Define fixed slots
        this.slots = [
            { index: 0, label: '08:00 - 09:00' },
            { index: 1, label: '09:00 - 10:00' },
            { index: 2, label: '10:00 - 11:00' },
            { index: 3, label: '11:00 - 11:30 (R)' },
            { index: 4, label: '11:30 - 12:30' },
            { index: 5, label: '12:30 - 13:30' },
            { index: 6, label: '13:30 - 14:30' }
        ];

        this.render();
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header mb-4">
                <h2><i class="fas fa-laptop-house me-2"></i>Reserva de Carros</h2>
                <p class="text-muted">Reserva carros de portátiles para tus clases.</p>
            </div>

            <ul class="nav nav-tabs mb-4" id="carts-tabs" role="tablist">
                <li class="nav-item">
                    <a class="nav-link active" id="tab-reservations-link" data-bs-toggle="tab" href="#tab-reservations" role="tab">Reservas</a>
                </li>
                ${this.isTic ? `
                <li class="nav-item">
                    <a class="nav-link" id="tab-inventory-link" data-bs-toggle="tab" href="#tab-inventory" role="tab">Gestión Carros (TIC)</a>
                </li>
                ` : ''}
            </ul>

            <div class="tab-content" id="carts-tab-content">
                <!-- Reservations Tab -->
                <div class="tab-pane fade show active" id="tab-reservations" role="tabpanel">
                    <!-- Calendar Section -->
                    <div class="row mb-4">
                        <div class="col-lg-12">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <button id="carts-prev-month" class="btn btn-outline-primary btn-sm"><i class="fas fa-chevron-left"></i></button>
                                <h4 id="carts-month-label" class="m-0 fw-bold text-primary"></h4>
                                <button id="carts-next-month" class="btn btn-outline-primary btn-sm"><i class="fas fa-chevron-right"></i></button>
                            </div>
                            <div class="card shadow-sm border-0 mb-4">
                                <div class="card-body p-0">
                                    <div id="carts-calendar-grid" class="calendar-grid calendar-compact"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="carts-grid-container" class="table-responsive">
                         <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
                    </div>
                </div>

                <!-- Inventory Tab (TIC) -->
                <div class="tab-pane fade" id="tab-inventory" role="tabpanel">
                    <div class="d-flex justify-content-end mb-3">
                        <button class="btn btn-primary" onclick="window.currentCartsModule.showAddCartModal()">
                            <i class="fas fa-plus me-2"></i>Nuevo Carro
                        </button>
                    </div>
                    <div id="carts-list-container">
                        <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
                    </div>
                </div>
            </div>
        `;

        // Initialize Calendar
        this.calendar = new Calendar({
            grid: document.getElementById('carts-calendar-grid'),
            monthLabel: document.getElementById('carts-month-label'),
            prevBtn: document.getElementById('carts-prev-month'),
            nextBtn: document.getElementById('carts-next-month')
        }, this.supabaseService, this.user, this.userRoles, {
            fetchData: async (year, month) => {
                return await this.supabaseService.getMonthAvailability(year, month);
            },
            onDateSelect: (dateStr) => {
                this.currentDate = new Date(dateStr);
                this.loadReservationsView();
            },
            renderCell: (cell, dateStr, dayData, isWeekend) => {
                const day = parseInt(dateStr.split('-')[2]);
                const isSelected = this.formatDateForInput(this.currentDate) === dateStr;

                const number = document.createElement('span');
                number.className = 'day-number';
                number.textContent = day;
                cell.appendChild(number);

                if (isWeekend || (dayData && dayData.isHoliday)) {
                    cell.classList.add('day-red');
                    if (dayData && dayData.isHoliday) cell.title = "Festivo";
                }

                if (isSelected) {
                    cell.classList.remove('day-red');
                    cell.classList.add('bg-primary', 'text-white');
                    number.style.color = 'white';
                } else if (!isWeekend && !(dayData && dayData.isHoliday)) {
                    cell.style.cursor = 'pointer';
                }
            }
        });

        // Initial Load
        await this.loadReservationsView();

        if (this.isTic) {
            document.getElementById('tab-inventory-link').addEventListener('shown.bs.tab', () => this.loadInventoryView());
        }
    }

    formatDateForInput(date) {
        return date.toISOString().split('T')[0];
    }

    // --- Reservations View ---

    async loadReservationsView() {
        this.updateCalendarSelection();

        const container = document.getElementById('carts-grid-container');
        const dateStr = this.formatDateForInput(this.currentDate);

        const dayOfWeek = this.currentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            container.innerHTML = `<div class="alert alert-warning text-center">No hay reservas los fines de semana.</div>`;
            return;
        }

        try {
            // Loading
            container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

            // Load carts and reservations locally
            // Ideally should check cache or verify if carts list changed
            this.carts = await this.supabaseService.getCarts();
            this.carts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            this.reservations = await this.supabaseService.getCartReservations(dateStr);
            this.renderGrid(container);
        } catch (error) {
            console.error(error);
            container.innerHTML = `<div class="alert alert-danger">Error al cargar reservas</div>`;
        }
    }

    updateCalendarSelection() {
        if (!this.calendar || !this.calendar.grid) return;
        this.calendar.render();
    }

    renderGrid(container) {
        if (this.carts.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No hay carros disponibles en el sistema.</div>';
            return;
        }

        // Filter active carts only
        const activeCarts = this.carts.filter(c => c.active);

        let html = `
            <table class="table table-bordered text-center align-middle">
                <thead class="table-light">
                    <tr>
                        <th style="width: 15%">Horario (${UIHelpers.formatDate(this.currentDate)})</th>
                        ${activeCarts.map(cart => `
                            <th>
                                <div>${cart.name}</div>
                                <small class="text-muted fw-normal">${cart.location}</small>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        this.slots.forEach(slot => {
            html += `<tr><th class="table-light">${slot.label}</th>`;

            activeCarts.forEach(cart => {
                const reservation = this.reservations.find(r => r.slotIndex === slot.index && r.cartId === cart.id);
                const isReserved = !!reservation;
                const isMyReservation = isReserved && reservation.userId === this.user.uid;

                if (isReserved) {
                    const cellClass = isMyReservation ? 'table-primary' : 'table-secondary';
                    const canManage = isMyReservation || this.isTic;
                    const cursor = canManage ? 'pointer' : 'default';
                    const clickAction = canManage ? `onclick="window.currentCartsModule.cancelReservation('${reservation.id}')"` : '';
                    const tooltip = isMyReservation ? 'Click para cancelar' : (this.isTic ? 'Click para cancelar (Admin/TIC)' : 'Reservado');

                    html += `
                        <td class="${cellClass}" style="cursor: ${cursor}" ${clickAction} title="${tooltip}">
                            <div class="fw-bold small">${reservation.userName}</div>
                            ${reservation.comment ? `<div class="x-small text-muted fst-italic">${reservation.comment}</div>` : ''}
                            ${canManage ? '<i class="fas fa-times text-danger mt-1"></i>' : ''}
                        </td>
                    `;
                } else {
                    html += `
                        <td class="" style="cursor: pointer" onclick="window.currentCartsModule.makeReservation(${slot.index}, '${slot.label}', '${cart.id}', '${cart.name}')">
                            <span class="text-success opacity-50"><i class="fas fa-plus-circle"></i></span>
                        </td>
                    `;
                }
            });

            html += `</tr>`;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    async makeReservation(slotIndex, slotLabel, cartId, cartName) {
        this.showReservationTypeModal(slotIndex, slotLabel, cartId, cartName);
    }

    showReservationTypeModal(slotIndex, slotLabel, cartId, cartName) {
        const existingModal = document.getElementById('reservation-type-modal');
        if (existingModal) existingModal.remove();

        const dateStr = this.formatDateForInput(this.currentDate);
        const dayName = this.currentDate.toLocaleDateString('es-ES', { weekday: 'long' });

        const endDate = this.getEndOfSchoolYear();
        const endDateStr = endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

        const modal = document.createElement('div');
        modal.id = 'reservation-type-modal';
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Confirmar Reserva</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Carro:</strong> ${cartName}</p>
                        <p><strong>Hora:</strong> ${slotLabel}</p>
                        
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="radio" name="resType" id="res-single" value="single" checked>
                            <label class="form-check-label" for="res-single">
                                Solo el día <strong>${dateStr}</strong>
                            </label>
                        </div>
                        
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="radio" name="resType" id="res-mass" value="mass">
                            <label class="form-check-label" for="res-mass">
                                Todas las semanas (cada ${dayName})<br>
                                <small class="text-muted">Hasta fin de curso (${endDateStr})</small>
                            </label>
                        </div>

                        <hr>

                        <div class="form-check mb-2">
                             <input class="form-check-input" type="checkbox" id="res-for-other">
                             <label class="form-check-label" for="res-for-other">
                                 Reservar para otra persona / Comentario
                             </label>
                        </div>
                        <div class="mb-3 d-none" id="res-comment-container">
                             <input type="text" class="form-control" id="res-comment" placeholder="Nombre de la persona o motivo">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-confirm-res">Reservar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const checkOther = document.getElementById('res-for-other');
        const commentContainer = document.getElementById('res-comment-container');
        const commentInput = document.getElementById('res-comment');

        checkOther.addEventListener('change', () => {
            if (checkOther.checked) {
                commentContainer.classList.remove('d-none');
                commentInput.focus();
            } else {
                commentContainer.classList.add('d-none');
            }
        });

        document.getElementById('btn-confirm-res').addEventListener('click', async () => {
            const type = document.querySelector('input[name="resType"]:checked').value;
            const comment = checkOther.checked ? commentInput.value.trim() : '';

            if (checkOther.checked && !comment) {
                alert('Por favor, indica el nombre o comentario.');
                return;
            }

            bsModal.hide();

            if (type === 'single') {
                await this.processSingleReservation(dateStr, slotIndex, slotLabel, cartId, cartName, comment);
            } else {
                await this.processMassReservation(slotIndex, slotLabel, cartId, cartName, comment);
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    getEndOfSchoolYear() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11
        let endYear = currentYear;
        // If August or later, end is next year
        if (currentMonth >= 7) {
            endYear = currentYear + 1;
        }
        return new Date(endYear, 5, 30); // Month 5 is June
    }

    async processSingleReservation(dateStr, slotIndex, slotLabel, cartId, cartName, comment = '') {
        try {
            await this.supabaseService.reserveCart(
                dateStr,
                slotIndex,
                slotLabel,
                cartId,
                this.user.uid,
                this.user.displayName || this.user.email.split('@')[0],
                comment
            );
            UIHelpers.showToast('Reserva realizada', 'success');
            await this.loadReservationsView();
        } catch (error) {
            console.error(error);
            UIHelpers.showToast('Error al reservar: ' + error.message, 'error');
        }
    }

    async processMassReservation(slotIndex, slotLabel, cartId, cartName, comment = '') {
        // Use noon to avoid DST midnight issues
        const startDate = new Date(this.currentDate);
        startDate.setHours(12, 0, 0, 0);

        const endDate = this.getEndOfSchoolYear();
        endDate.setHours(12, 0, 0, 0);

        const targetDates = [];

        // Avoid infinite loops
        let count = 0;
        let diffWeeks = 0;

        while (count < 60) {
            // Calculate next date based on original startDate + weeks, 
            // instead of accumulating on iterDate to avoid drift.
            const nextDate = new Date(startDate);
            nextDate.setDate(startDate.getDate() + (diffWeeks * 7));

            if (nextDate > endDate) break;

            targetDates.push(this.formatDateForInput(nextDate));
            diffWeeks++;
            count++;
        }

        if (targetDates.length === 0) return;

        if (!confirm(`Se comprobará la disponibilidad para ${targetDates.length} días. ¿Continuar?`)) return;

        UIHelpers.showToast('Verificando disponibilidad...', 'info');

        try {
            const rangeStart = targetDates[0];
            const rangeEnd = targetDates[targetDates.length - 1];

            const existingReservations = await this.supabaseService.getCartReservationsInRange(rangeStart, rangeEnd);

            const conflicts = [];

            targetDates.forEach(date => {
                const conflict = existingReservations.find(r =>
                    r.date === date &&
                    r.slotIndex === slotIndex &&
                    r.cartId === cartId
                );
                if (conflict) {
                    conflicts.push(date);
                }
            });

            if (conflicts.length > 0) {
                const conflictStr = conflicts.slice(0, 3).join(', ') + (conflicts.length > 3 ? '...' : '');
                alert(`No se puede realizar la reserva masiva.\n\nHay conflictos en las siguientes fechas:\n${conflictStr}\n\nNo se ha realizado ninguna reserva.`);
                return;
            }

            UIHelpers.showToast('Realizando reservas...', 'info');

            const promises = targetDates.map(date =>
                this.supabaseService.reserveCart(
                    date,
                    slotIndex,
                    slotLabel,
                    cartId,
                    this.user.uid,
                    this.user.displayName || this.user.email.split('@')[0],
                    comment
                )
            );

            await Promise.all(promises);

            UIHelpers.showToast(`Reservado correctamente para ${targetDates.length} semanas.`, 'success');
            await this.loadReservationsView();

        } catch (e) {
            console.error(e);
            UIHelpers.showToast('Error en el proceso: ' + e.message, 'error');
        }
    }

    async cancelReservation(reservationId) {
        const reservation = this.reservations.find(r => r.id === reservationId);
        if (!reservation) return;

        // Show Modal for Delete options
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'delete-reservation-modal';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title">Eliminar Reserva</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>¿Qué deseas eliminar?</p>
                        <div class="form-check mb-2">
                            <input class="form-check-input" type="radio" name="delType" id="del-single" value="single" checked>
                            <label class="form-check-label" for="del-single">
                                Solo esta reserva (${reservation.date})
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="delType" id="del-mass" value="mass">
                            <label class="form-check-label" for="del-mass">
                                Esta y todas las futuras<br>
                                <small class="text-muted">Todas las reservas de este hueco/carro a partir de hoy.</small>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-danger" id="btn-confirm-delete">Eliminar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
            const type = document.querySelector('input[name="delType"]:checked').value;
            bsModal.hide();

            try {
                if (type === 'single') {
                    await this.supabaseService.cancelCartReservation(reservationId);
                    UIHelpers.showToast('Reserva cancelada', 'success');
                } else {
                    if (!confirm('¿Estás seguro de que quieres borrar TODAS las reservas futuras de esta serie?')) return;

                    UIHelpers.showToast('Buscando reservas...', 'info');
                    const futureReservations = await this.supabaseService.getReservationsForCartInRange(
                        reservation.cartId,
                        reservation.slotIndex,
                        reservation.date,
                        this.user.uid
                    );

                    if (futureReservations.length === 0) {
                        UIHelpers.showToast('No se encontraron reservas futuras.', 'info');
                        return;
                    }

                    UIHelpers.showToast(`Eliminando ${futureReservations.length} reservas...`, 'info');
                    const promises = futureReservations.map(r => this.supabaseService.cancelCartReservation(r.id));
                    await Promise.all(promises);
                    UIHelpers.showToast('Reservas eliminadas correctamente', 'success');
                }
                await this.loadReservationsView();
            } catch (error) {
                console.error(error);
                UIHelpers.showToast('Error al cancelar', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    // --- Inventory View (TIC) ---

    async loadInventoryView() {
        const container = document.getElementById('carts-list-container');
        try {
            this.carts = await this.supabaseService.getCarts();
            this.carts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

            if (this.carts.length === 0) {
                container.innerHTML = '<p class="text-muted text-center">No hay carros registrados.</p>';
                return;
            }

            container.innerHTML = `
                <div class="list-group">
                    ${this.carts.map(cart => `
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                                <h5 class="mb-1">${cart.name} ${!cart.active ? '<span class="badge bg-danger">Inactivo</span>' : ''}</h5>
                                <p class="mb-1 text-muted">${cart.description}</p>
                                <small class="text-primary"><i class="fas fa-map-marker-alt me-1"></i>${cart.location}</small>
                            </div>
                            <div>
                                <button class="btn btn-sm btn-outline-secondary me-2" onclick="window.currentCartsModule.editCart('${cart.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="window.currentCartsModule.deleteCart('${cart.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar inventario</div>';
        }
    }

    showAddCartModal() {
        this.showCartModal(); // Mode create
    }

    editCart(cartId) {
        const cart = this.carts.find(c => c.id === cartId);
        if (cart) this.showCartModal(cart);
    }

    async deleteCart(cartId) {
        if (!confirm('¿Eliminar este carro? Se perderán las reservas históricas asociadas (si no se borraron antes).')) return;
        try {
            await this.supabaseService.deleteCart(cartId);
            UIHelpers.showToast('Carro eliminado', 'success');
            this.loadInventoryView();
        } catch (e) {
            UIHelpers.showToast('Error al eliminar', 'error');
        }
    }

    showCartModal(cart = null) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${cart ? 'Editar Carro' : 'Nuevo Carro'}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                         <div class="mb-3">
                            <label class="form-label">Nombre</label>
                            <input type="text" class="form-control" id="cart-name" value="${cart ? cart.name : ''}" placeholder="Ej: Carro 1">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Ubicación</label>
                            <input type="text" class="form-control" id="cart-location" value="${cart ? cart.location : ''}" placeholder="Ej: Planta 1">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Descripción</label>
                            <textarea class="form-control" id="cart-desc" rows="2">${cart ? cart.description : ''}</textarea>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="cart-active" ${(!cart || cart.active) ? 'checked' : ''}>
                            <label class="form-check-label">Activo (Disponible para reservas)</label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-cart">Guardar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-save-cart').addEventListener('click', async () => {
            const name = document.getElementById('cart-name').value;
            const location = document.getElementById('cart-location').value;
            const description = document.getElementById('cart-desc').value;
            const active = document.getElementById('cart-active').checked;

            if (!name || !location) {
                UIHelpers.showToast('Nombre y Ubicación son obligatorios', 'error');
                return;
            }

            try {
                if (cart) {
                    await this.supabaseService.updateCart(cart.id, { name, location, description, active });
                } else {
                    await this.supabaseService.createCart({ name, location, description, active });
                }
                UIHelpers.showToast('Guardado correctamente', 'success');
                bsModal.hide();
                this.loadInventoryView();
            } catch (e) {
                console.error(e);
                UIHelpers.showToast('Error al guardar', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    destroy() {
        delete window.currentCartsModule;
    }
}
