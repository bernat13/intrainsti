import { UIHelpers } from '../UIHelpers.js';
import { Calendar } from '../Calendar.js';

export class SUMModule {
    constructor(container, firebaseService, user, userRoles, isAdmin) {
        this.container = container;
        this.firebaseService = firebaseService;
        this.user = user;
        this.userRoles = userRoles || [];
        this.isAdmin = isAdmin;

        // Global bindings moved to constructor
        window.currentSUMModule = this;
        window.reserveSUMSlot = (idx, lbl) => this.handleReserve(idx, lbl);
        window.cancelSUMReservation = (id) => this.handleCancel(id);

        this.currentDate = new Date();

        // Navigation from Calendar
        const pendingDate = localStorage.getItem('pendingDate');
        if (pendingDate) {
            this.currentDate = new Date(pendingDate);
            localStorage.removeItem('pendingDate');
        }
        this.reservations = [];

        // Define fixed slots
        this.slots = [
            { index: 0, label: '08:00 - 09:00', type: 'class' },
            { index: 1, label: '09:00 - 10:00', type: 'class' },
            { index: 2, label: '10:00 - 11:00', type: 'class' },
            { index: 3, label: '11:00 - 11:30 (Recreo)', type: 'break' },
            { index: 4, label: '11:30 - 12:30', type: 'class' },
            { index: 5, label: '12:30 - 13:30', type: 'class' },
            { index: 6, label: '13:30 - 14:30', type: 'class' }
        ];

        this.render();
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header mb-4">
                <h2><i class="fas fa-chalkboard-teacher me-2"></i>Reserva de SUM</h2>
                <p class="text-muted">Reserva el Salón de Usos Múltiples por horas.</p>
            </div>

            <!-- Calendar Section -->
            <div class="row mb-4">
                <div class="col-lg-6 mx-auto">
                     <div class="d-flex justify-content-between align-items-center mb-3">
                        <button id="sum-prev-month" class="btn btn-outline-primary btn-sm"><i class="fas fa-chevron-left"></i></button>
                        <h4 id="sum-month-label" class="m-0 fw-bold text-primary"></h4>
                        <button id="sum-next-month" class="btn btn-outline-primary btn-sm"><i class="fas fa-chevron-right"></i></button>
                    </div>
                    <div class="card shadow-sm border-0 mb-4">
                        <div class="card-body p-0">
                            <div id="sum-calendar-grid" class="calendar-grid"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="sum-schedule-container" class="card shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-center py-5">
                         <div class="spinner-border text-primary" role="status"></div>
                    </div>
                </div>
            </div>
        `;

        // Initialize Calendar
        this.calendar = new Calendar({
            grid: document.getElementById('sum-calendar-grid'),
            monthLabel: document.getElementById('sum-month-label'),
            prevBtn: document.getElementById('sum-prev-month'),
            nextBtn: document.getElementById('sum-next-month')
        }, this.firebaseService, this.user, this.userRoles, {
            // Disable default fetching, we just want navigation
            fetchData: async (year, month) => {
                // Determine days that have ANY reservation to maybe color them?
                // For now, implementing as per plan: pure navigation + selection
                // Optional: fetch all SUM reservations for month to show dots?
                // Let's keep it simple as requested first.
                return {};
            },
            onDateSelect: (dateStr) => {
                this.currentDate = new Date(dateStr);
                this.loadSchedule();
            },
            renderCell: (cell, dateStr, dayData, isWeekend) => {
                const day = parseInt(dateStr.split('-')[2]);
                const dateObj = new Date(dateStr);
                const isSelected = this.formatDateForInput(this.currentDate) === dateStr;

                // Number
                const number = document.createElement('span');
                number.className = 'day-number';
                number.textContent = day;
                cell.appendChild(number);

                // Styling
                if (isWeekend) {
                    cell.style.backgroundColor = '#f8f9fa';
                    cell.style.color = '#adb5bd';
                }

                if (isSelected) {
                    cell.classList.add('bg-primary', 'text-white');
                    number.style.color = 'white';
                } else if (!isWeekend) {
                    cell.style.cursor = 'pointer';
                }
            }
        });

        await this.loadSchedule();
    }

    formatDateForInput(date) {
        return date.toISOString().split('T')[0];
    }

    async loadSchedule() {
        // Update Calendar UI (highlight selected) mostly requires re-render or manual class toggle
        // Simplest is to trigger calendar render if we want to ensure visual consistency
        // But for performance, let's just update the previous view if needed.
        // Actually, the Calendar.render() clears everything.
        // We can manually toggle classes if grid exists
        this.updateCalendarSelection();

        const container = document.getElementById('sum-schedule-container');
        const dateStr = this.formatDateForInput(this.currentDate);

        const dayOfWeek = this.currentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            container.innerHTML = `<div class="alert alert-warning m-3 text-center">El SUM no está disponible los fines de semana.</div>`;
            return;
        }

        try {
            // Show loading
            container.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-center py-5">
                         <div class="spinner-border text-primary"></div>
                    </div>
                </div>`;

            this.reservations = await this.firebaseService.getSUMReservations(dateStr);
            this.renderSchedule(container, dateStr);
        } catch (error) {
            console.error('Error loading schedule:', error);
            container.innerHTML = `<div class="alert alert-danger m-3">Error al cargar horario: ${error.message}</div>`;
        }
    }

    updateCalendarSelection() {
        if (!this.calendar || !this.calendar.grid) return;

        // Remove active class from all
        const allCells = this.calendar.grid.querySelectorAll('.calendar-day');
        allCells.forEach(cell => {
            cell.classList.remove('bg-primary', 'text-white');
            const num = cell.querySelector('.day-number');
            if (num) num.style.color = '';
        });

        // Find cell for current date
        const dateStr = this.formatDateForInput(this.currentDate);
        // We can't easily find it without re-rendering or storing reference
        // But hey, we provided a custom renderCell, but that runs only on month load.
        // Let's just re-render the calendar. It's cheap.
        this.calendar.render();
    }

    renderSchedule(container, dateStr) {
        const content = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h5 class="card-title m-0">Horario para ${UIHelpers.formatDate(this.currentDate)}</h5>
            </div>
            <div class="list-group">
                ${this.slots.map(slot => this.renderSlot(slot)).join('')}
            </div>
        `;
        container.innerHTML = `<div class="card-body">${content}</div>`;
    }

    renderSlot(slot) {
        const reservation = this.reservations.find(r => r.slotIndex === slot.index);
        const isReserved = !!reservation;
        const isMyReservation = isReserved && reservation.userId === this.user.uid;

        let statusClass = 'list-group-item-action';
        let badge = '';
        let content = '';
        let clickAction = '';

        if (isReserved) {
            statusClass = isMyReservation ? 'list-group-item-primary' : 'list-group-item-secondary disabled-look';
            badge = isMyReservation
                ? `<span class="badge bg-primary">Tu reserva</span>`
                : `<span class="badge bg-secondary">Reservado</span>`;

            content = `
                <div class="d-flex justify-content-between align-items-center w-100">
                    <div>
                        <h6 class="mb-1">${slot.label}</h6>
                        <div class="mb-1"><strong>Motivo:</strong> ${reservation.title || 'Sin especificar'}</div>
                        <div class="small text-muted"><i class="fas fa-user-circle me-1"></i>Reservado por: ${reservation.userName || 'Usuario desconocido'}</div>
                    </div>
                    <div>
                        ${badge}
                        ${(isMyReservation || this.isAdmin || (this.userRoles && this.userRoles.includes('equipo_tic'))) ?
                    `<button class="btn btn-sm btn-danger ms-2" onclick="window.cancelSUMReservation('${reservation.id}')"><i class="fas fa-trash"></i></button>`
                    : ''}
                    </div>
                </div>
            `;
        } else {
            // Available
            clickAction = `onclick="window.reserveSUMSlot(${slot.index}, '${slot.label}')"`;
            content = `
                <div class="d-flex justify-content-between align-items-center w-100">
                    <div>
                        <h6 class="mb-1">${slot.label}</h6>
                        <small class="text-success"><i class="fas fa-check-circle me-1"></i>Disponible</small>
                    </div>
                    <button class="btn btn-sm btn-outline-success">Reservar</button>
                </div>
             `;
        }

        return `
            <div class="list-group-item ${statusClass}" ${!isReserved ? clickAction : ''}>
                ${content}
            </div>
        `;
    }

    async handleReserve(slotIndex, slotLabel) {
        const title = prompt(`Confirmar reserva para ${slotLabel}.\n\nIntroduce un motivo o clase:`);
        if (!title) return;

        try {
            const dateStr = this.formatDateForInput(this.currentDate);
            await this.firebaseService.reserveSUM(
                dateStr,
                slotIndex,
                slotLabel,
                title,
                this.user.uid,
                this.user.displayName || this.user.email.split('@')[0]
            );
            UIHelpers.showToast('Reserva realizada', 'success');
            await this.loadSchedule();
        } catch (error) {
            console.error(error);
            UIHelpers.showToast('Error al reservar', 'error');
        }
    }

    async handleCancel(reservationId) {
        if (!confirm('¿Seguro que quieres cancelar esta reserva?')) return;

        try {
            await this.firebaseService.cancelSUMReservation(reservationId);
            UIHelpers.showToast('Reserva cancelada', 'success');
            await this.loadSchedule();
        } catch (error) {
            console.error(error);
            UIHelpers.showToast('Error al cancelar', 'error');
        }
    }

    destroy() {
        delete window.reserveSUMSlot;
        delete window.cancelSUMReservation;
        delete window.currentSUMModule;
    }
}

// Global bindings managed in constructor
