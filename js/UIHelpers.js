// UI Helper functions for consistent UI elements across modules
export class UIHelpers {

    // Show toast notification
    static showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${this.getIconForType(type)} me-2"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    static getIconForType(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    static getInteractionIcon(type) {
        const icons = {
            'Llamada': '<i class="fas fa-phone"></i>',
            'Visita': '<i class="fas fa-building"></i>',
            'Email': '<i class="fas fa-envelope"></i>',
            'Reunión': '<i class="fas fa-users"></i>'
        };
        return icons[type] || '<i class="fas fa-comment"></i>';
    }

    // Confirm dialog
    static async confirm(message, title = '¿Estás seguro?') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>${message}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary btn-confirm">Confirmar</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const bsModal = new bootstrap.Modal(modal);

            modal.querySelector('.btn-confirm').addEventListener('click', () => {
                bsModal.hide();
                resolve(true);
            });

            modal.addEventListener('hidden.bs.modal', () => {
                modal.remove();
                resolve(false);
            });

            bsModal.show();
        });
    }

    // Format date
    static formatDate(date) {
        if (!date) return '-';
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Format date (short)
    static formatDateShort(date) {
        if (!date) return '-';
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    // Format time duration in minutes
    static formatDuration(minutes) {
        if (!minutes) return '-';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    }

    // Get status badge HTML
    static getStatusBadge(status) {
        const badges = {
            'abierto': '<span class="badge bg-danger">Abierto</span>',
            'pendiente_validacion': '<span class="badge bg-warning text-dark">Pendiente Validación</span>',
            'rechazado': '<span class="badge bg-secondary">Rechazado</span>',
            'en_progreso': '<span class="badge bg-warning text-dark">En Progreso</span>',
            'resuelto': '<span class="badge bg-success">Resuelto</span>',
            'cerrado': '<span class="badge bg-secondary">Cerrado</span>'
        };
        return badges[status] || '<span class="badge bg-secondary">Desconocido</span>';
    }

    // Get priority badge HTML
    static getPriorityBadge(priority) {
        const badges = {
            'baja': '<span class="badge bg-info">Baja</span>',
            'normal': '<span class="badge bg-primary">Normal</span>',
            'alta': '<span class="badge bg-warning text-dark">Alta</span>',
            'urgente': '<span class="badge bg-danger">Urgente</span>'
        };
        return badges[priority] || '<span class="badge bg-secondary">Normal</span>';
    }

    // Format currency
    static formatCurrency(amount) {
        if (amount === null || amount === undefined) return '-';
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    // Get role display name
    static getRoleDisplayName(role) {
        const roleNames = {
            'jefe_departamento': 'Jefe de Departamento',
            'equipo_tic': 'Equipo TIC',
            'equipo_mantenimiento': 'Equipo Mantenimiento',
            'equipo_3d': 'Equipo Impresión 3D',
            'equipo_dual': 'Equipo Dual',
            'equipo_directivo': 'Equipo Directivo',
            'director': 'Director/a'
        };
        return roleNames[role] || role;
    }

    // Show loading spinner in element
    static showLoading(element) {
        element.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>
        `;
    }

    // Show empty state
    static showEmptyState(element, message, icon = 'inbox') {
        element.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-${icon} fa-3x mb-3"></i>
                <p>${message}</p>
            </div>
        `;
    }

    static getSchoolYearStart(date = new Date()) {
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-11
        // School year starts usually in September (Month 8)
        // If current month is Jan-Aug (0-7), start year is previous year
        const startYear = month < 8 ? year - 1 : year;
        return new Date(startYear, 8, 1); // 1st September
    }

    static getSchoolYearLabel(date = new Date()) {
        const start = this.getSchoolYearStart(date);
        return `${start.getFullYear()}-${start.getFullYear() + 1}`;
    }

    // Escape HTML to prevent XSS
    static escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
