
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import supabaseConfig from './supabase-config.js';

export class SupabaseService {
    constructor() {
        this.supabase = createClient(supabaseConfig.url, supabaseConfig.key);
        this.currentInstitute = null;
    }

    // ==================== AUTHENTICATION ====================

    async login() {
        const { data, error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
        return data; // Redirects usually
    }

    async logout() {
        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
        window.location.reload();
    }

    async getCurrentUser() {
        const { data: { user } } = await this.supabase.auth.getUser();
        return user;
    }

    onAuthStateChange(callback) {
        this.supabase.auth.onAuthStateChange((event, session) => {
            callback(session?.user || null);
        });
    }

    // ==================== INSTITUTE CONTEXT ====================

    setInstitute(institute) {
        this.currentInstitute = institute;
        // Optionally persist to localStorage
        localStorage.setItem('selectedInstituteId', institute.id);
    }

    getInstitute() {
        return this.currentInstitute;
    }

    async getMyInstitutes(userId) {
        // Fetch institutes where user is a member
        const { data, error } = await this.supabase
            .from('institute_members')
            .select(`
                institute_id,
                roles,
                institutes (
                    id,
                    name,
                    domain,
                    status
                )
            `)
            .eq('user_id', userId);
        // .eq('status', 'active'); // REMOVED: Fetch all to show pending in list

        if (error) throw error;

        // Flatten structure
        return data.map(m => ({
            ...m.institutes,
            myRoles: m.roles
        }));
    }

    async registerInstitute(name, adminEmail) {
        // 1. Create Institute
        const { data: instData, error: instError } = await this.supabase
            .from('institutes')
            .insert([
                {
                    name: name,
                    admin_email: adminEmail,
                    status: 'pending'
                }
            ])
            .select();

        if (instError) throw instError;
        const newInstitute = instData[0];

        // 2. Add Creator as Admin Member immediately
        const user = await this.getCurrentUser();
        if (user) {
            const { error: memberError } = await this.supabase
                .from('institute_members')
                .insert([{
                    user_id: user.id,
                    institute_id: newInstitute.id,
                    roles: ['admin'],
                    status: 'active'
                }]);

            if (memberError) {
                console.error("Error adding creator as member:", memberError);
                // Optional: rollback institute creation?
            }
        }

        return newInstitute;
    }

    // ==================== USER MANAGEMENT ====================

    async getProfile(userId) {
        const { data, error } = await this.supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is 'Row not found'
        return data;
    }

    async upsertProfile(user) {
        const { error } = await this.supabase
            .from('user_profiles')
            .upsert({
                id: user.id,
                email: user.email,
                display_name: user.user_metadata.full_name || user.email.split('@')[0],
                last_login: new Date()
            });
        if (error) throw error;
    }

    // ==================== INSTITUTE DETAILS ====================

    async getInstituteDetails(instituteId) {
        const { data, error } = await this.supabase
            .from('institutes')
            .select('*')
            .eq('id', instituteId)
            .single();

        if (error) throw error;
        return data;
    }

    async getModuleConfig() {
        // For now, return a default config where everything is active.
        // In future, this could be fetched from 'institute_settings' or 'institutes.config'
        return {
            calendario: 'active',
            anuncios: 'active',
            tickets_tic: 'active',
            tickets_maintenance: 'active',
            tickets_3d: 'active',
            dual: 'active',
            sum: 'active',
            carts: 'active'
        };
    }

    async getInstituteMember(userId, instituteId) {
        const { data, error } = await this.supabase
            .from('institute_members')
            .select('*')
            .eq('user_id', userId)
            .eq('institute_id', instituteId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    // ==================== USER & ROLES ====================

    // Helper compatibility methods
    async getUserRoles(uid) {
        if (!this.currentInstitute) return [];
        try {
            const member = await this.getInstituteMember(uid, this.currentInstitute.id);
            return member?.roles || [];
        } catch (e) {
            return [];
        }
    }

    async getUserRole(uid) {
        // First check if superadmin
        const profile = await this.getProfile(uid);
        if (profile && profile.is_superadmin) return true;

        const roles = await this.getUserRoles(uid);
        return roles.includes('admin') || roles.includes('director') || roles.includes('superadmin');
    }

    async isSuperAdmin(uid) {
        const profile = await this.getProfile(uid || (await this.getCurrentUser()).id);
        return profile?.is_superadmin || false;
    }

    async getAllUsers() {
        // In Firebase this returned profiles. In Supabase we want institute members + profiles
        if (!this.currentInstitute) return [];

        const { data, error } = await this.supabase
            .from('institute_members')
            .select(`
                *,
                user_profiles (
                    email,
                    display_name
                )
            `)
            .eq('institute_id', this.currentInstitute.id);

        if (error) throw error;

        // Map to format expected by UI (flatten profile)
        return data.map(m => ({
            uid: m.user_id,
            email: m.user_profiles?.email,
            displayName: m.user_profiles?.display_name,
            roles: m.roles,
            department: m.department,
            ...m
        }));
    }

    // ==================== GENERIC DATA METHODS ====================

    // Helper to ensure we scope to institute
    _scopeToInstitute(query) {
        if (!this.currentInstitute) throw new Error("No institute selected");
        return query.eq('institute_id', this.currentInstitute.id);
    }

    async getTickets(type, userUid = null, userRoles = null) {
        // type: 'tic', 'maintenance', '3d'

        let query = this.supabase
            .from('tickets')
            .select('*')
            .eq('type', type)
            .order('created_at', { ascending: false });

        query = this._scopeToInstitute(query);

        const { data, error } = await query;
        if (error) throw error;

        // Backend RLS allows "select" for all members.
        // We filter here for UI logic (My Tickets vs All Tickets).
        // Ideally RLS would handle this but requiring dynamic role checks in RLS is complex.

        const roles = userRoles || [];
        const isManager =
            roles.includes('admin') ||
            roles.includes('director') ||
            roles.includes('equipo_directivo') ||
            (type === 'tic' && roles.includes('equipo_tic')) ||
            (type === 'maintenance' && roles.includes('equipo_mantenimiento')) ||
            (type === '3d' && roles.includes('equipo_3d'));

        let filteredData = data;
        if (!isManager && userUid) {
            filteredData = data.filter(t => t.requested_by === userUid);
        }

        return filteredData.map(t => ({
            ...t,
            ticketNumber: t.number, // Map snake_case to camelCase
            requestedBy: t.requested_by,
            requestedByName: t.requested_by_name,
            requestedByDepartment: t.requested_by_department,
            assignedTo: t.assigned_to,
            resolutionTime: t.resolution_time,
            totalCost: t.total_cost,
            imageUrl: t.image_url || t.imageUrl, // Handle both just in case
            filamentUsed: t.filament_used,
            printTime: t.print_time,
            stlUrl: t.stl_url,
            createdAt: t.created_at ? new Date(t.created_at) : null,
            updatedAt: t.updated_at ? new Date(t.updated_at) : null
        }));
    }

    async createTicket(ticketData) {
        if (!this.currentInstitute) throw new Error("No institute selected");

        // Generate number? Or let DB trigger do it? 
        // For now, let's assume DB trigger or we generate simpler one.
        // Let's generate a simple timestamp-based one or random if we don't have counters table yet.
        const ticketNumber = `${ticketData.type.toUpperCase()}-${Date.now().toString().slice(-6)}`;

        const { data, error } = await this.supabase
            .from('tickets')
            .insert([{
                ...ticketData,
                number: ticketNumber,
                requested_by: ticketData.requestedBy, // Map camelCase to snake_case
                institute_id: this.currentInstitute.id,
                created_at: new Date()
            }])
            .select();

        if (error) throw error;
        return data[0];
    }

    async getAnnouncements(userRoles = null) {
        let query = this.supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false });

        query = this._scopeToInstitute(query);

        const { data, error } = await query;
        if (error) throw error;

        return data.map(a => ({
            ...a,
            authorName: a.author_name,
            createdAt: a.created_at ? new Date(a.created_at) : null
        }));
    }

    // Stub for ensureUserDocExists as it was called in DashboardApp
    async ensureUserDocExists(user) {
        await this.upsertProfile(user);
    }

    async validateUserEmail(email) {
        return true; // Supabase handles auth. 
    }

    // ==================== SUPERADMIN METHODS ====================

    async getAllInstitutesAdmin() {
        // Only accessible if RLS allows (superadmin)
        const { data, error } = await this.supabase
            .from('institutes')
            .select('*, institute_members(count)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Count users strictly (map data)
        return data.map(i => ({
            ...i,
            userCount: i.institute_members ? i.institute_members[0].count : 0
        }));
    }

    async updateInstituteStatus(id, status) {
        const { error } = await this.supabase
            .from('institutes')
            .update({ status: status })
            .eq('id', id);
        if (error) throw error;
    }

    async deleteInstitute(id) {
        const { error } = await this.supabase
            .from('institutes')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    async getSuperAdmins() {
        const { data, error } = await this.supabase
            .from('user_profiles')
            .select('*')
            .eq('is_superadmin', true);
        if (error) throw error;
        return data;
    }

    async setSuperAdmin(email, isSuper) {
        // Find user by email
        const { data: users, error: searchError } = await this.supabase
            .from('user_profiles')
            .select('id')
            .eq('email', email)
            .single();

        if (searchError) throw new Error("Usuario no encontrado");

        const { error } = await this.supabase
            .from('user_profiles')
            .update({ is_superadmin: isSuper })
            .eq('id', users.id);

        if (error) throw error;
    }

    // ==================== DEPARTMENTS ====================

    async getAllDepartments() {
        if (!this.currentInstitute) return [];
        const { data, error } = await this.supabase
            .from('departments')
            .select('*')
            .eq('institute_id', this.currentInstitute.id)
            .order('name');
        if (error) throw error;
        return data;
    }

    async createDepartment(deptData) {
        if (!this.currentInstitute) throw new Error("No institute selected");
        const { data, error } = await this.supabase
            .from('departments')
            .insert([{ ...deptData, institute_id: this.currentInstitute.id }])
            .select();
        if (error) throw error;
        return data[0];
    }

    async updateDepartment(id, updates) {
        const { error } = await this.supabase
            .from('departments')
            .update(updates)
            .eq('id', id);
        if (error) throw error;
    }

    async deleteDepartment(id) {
        const { error } = await this.supabase
            .from('departments')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    // ==================== USER MANAGEMENT UPDATES ====================

    async updateUserRoles(uid, roles) {
        if (!this.currentInstitute) throw new Error("No institute selected");
        const { error } = await this.supabase
            .from('institute_members')
            .update({ roles: roles })
            .eq('user_id', uid)
            .eq('institute_id', this.currentInstitute.id);
        if (error) throw error;
    }

    async updateUserDepartment(uid, deptId) {
        if (!this.currentInstitute) throw new Error("No institute selected");
        const { error } = await this.supabase
            .from('institute_members')
            .update({ department: deptId })
            .eq('user_id', uid)
            .eq('institute_id', this.currentInstitute.id);
        if (error) throw error;
    }

    async toggleAdminRole(uid, makeAdmin) {
        const roles = await this.getUserRoles(uid);
        const hasAdmin = roles.includes('admin');
        if (makeAdmin && !hasAdmin) {
            roles.push('admin');
        } else if (!makeAdmin && hasAdmin) {
            const idx = roles.indexOf('admin');
            if (idx > -1) roles.splice(idx, 1);
        } else {
            return;
        }
        await this.updateUserRoles(uid, roles);
    }

    // ==================== TICKETS & ANNOUNCEMENTS UPDATES ====================

    async updateTicket(type, id, updates) {
        const { newHistoryEntries, ...fields } = updates;

        const dbFields = {};
        if (fields.status) dbFields.status = fields.status;
        if (fields.assignedTo) dbFields.assigned_to = fields.assignedTo;
        if (fields.resolutionTime) dbFields.resolution_time = fields.resolutionTime;
        if (fields.totalCost) dbFields.total_cost = fields.totalCost;
        if (fields.priority) dbFields.priority = fields.priority;
        if (fields.updatedAt) dbFields.updated_at = fields.updatedAt;

        if (Object.keys(dbFields).length > 0) {
            const { error } = await this.supabase
                .from('tickets')
                .update(dbFields)
                .eq('id', id);
            if (error) throw error;
        }

        if (newHistoryEntries && newHistoryEntries.length > 0) {
            const { data } = await this.supabase.from('tickets').select('history').eq('id', id).single();
            const currentHistory = data.history || [];
            // Assuming tickets table has jsonb history column
            const { error } = await this.supabase
                .from('tickets')
                .update({ history: [...currentHistory, ...newHistoryEntries] })
                .eq('id', id);
            if (error) throw error;
        }
    }

    async deleteTicket(type, id) {
        const { error } = await this.supabase
            .from('tickets')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    async createAnnouncement(data, uid, authorName) {
        if (!this.currentInstitute) throw new Error("No institute selected");
        const { error } = await this.supabase
            .from('announcements')
            .insert([{
                title: data.title,
                content: data.content,
                priority: data.priority,
                target_roles: data.targetRoles,
                author: uid,
                author_name: authorName,
                institute_id: this.currentInstitute.id,
                created_at: new Date()
            }]);
        if (error) throw error;
    }

    async deleteAnnouncement(id) {
        const { error } = await this.supabase
            .from('announcements')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    // ==================== DUAL MODULE ====================

    async getDualConfig() {
        if (!this.currentInstitute) return { cycles: [], levels: [] };
        const { data, error } = await this.supabase
            .from('dual_config')
            .select('*')
            .eq('institute_id', this.currentInstitute.id)
            .maybeSingle();

        if (error) throw error;
        return { cycles: data?.cycles || [], levels: data?.levels || [] };
    }

    async updateDualConfig(config) {
        if (!this.currentInstitute) throw new Error("No selected institute");
        const { error } = await this.supabase
            .from('dual_config')
            .upsert({
                institute_id: this.currentInstitute.id,
                cycles: config.cycles || [],
                levels: config.levels || [],
                updated_at: new Date()
            }, { onConflict: 'institute_id' });
        if (error) throw error;
    }

    async getCompanies() {
        const { data, error } = await this.supabase
            .from('companies')
            .select('*')
            .eq('institute_id', this.currentInstitute.id)
            .order('name');
        if (error) throw error;
        return data; // Map fields if necessary? DualModule seems to use raw fields.
    }

    async createCompany(companyData) {
        const { error } = await this.supabase
            .from('companies')
            .insert([{ ...companyData, institute_id: this.currentInstitute.id }]);
        if (error) throw error;
    }

    async updateCompany(id, updates) {
        const { error } = await this.supabase
            .from('companies')
            .update(updates)
            .eq('id', id);
        if (error) throw error;
    }

    async deleteCompany(id) {
        const { error } = await this.supabase
            .from('companies')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    async getDualStudents(companyId = null) {
        let query = this.supabase
            .from('dual_students')
            .select('*')
            .eq('institute_id', this.currentInstitute.id)
            .order('name');

        if (companyId) query = query.eq('company_id', companyId);

        const { data, error } = await query;
        if (error) throw error;

        // Map snake_case to camelCase for UI? 
        // DualModule uses: name, course, cycle, level, schedule, companyId, tutorId
        // Let's assume the DB has snake_case and we map it, OR DB has camelCase?
        // Usually Supabase uses snake_case.
        // Let's assume snake_case in DB and map here.
        return data.map(s => ({
            id: s.id,
            name: s.name,
            course: s.course,
            cycle: s.cycle,
            level: s.level,
            schedule: s.schedule,
            companyId: s.company_id,
            tutorId: s.tutor_id,
            status: s.status,
            possibleCompany: s.possible_company,
            startDate: s.start_date,
            endDate: s.end_date,
            // ...
        }));
    }

    async createDualStudent(studentData) {
        // Map camelCase to snake_case
        const dbData = {
            institute_id: this.currentInstitute.id,
            name: studentData.name,
            course: studentData.course,
            cycle: studentData.cycle,
            level: studentData.level,
            schedule: studentData.schedule,
            company_id: studentData.companyId,
            tutor_id: studentData.tutorId,
            status: studentData.status,
            possible_company: studentData.possibleCompany,
            start_date: studentData.startDate,
            end_date: studentData.endDate
        };
        const { error } = await this.supabase.from('dual_students').insert([dbData]);
        if (error) throw error;
    }

    async updateDualStudent(id, updates) {
        const dbData = {};
        if (updates.name !== undefined) dbData.name = updates.name;
        if (updates.course !== undefined) dbData.course = updates.course;
        if (updates.cycle !== undefined) dbData.cycle = updates.cycle;
        if (updates.level !== undefined) dbData.level = updates.level;
        if (updates.schedule !== undefined) dbData.schedule = updates.schedule;
        if (updates.companyId !== undefined) dbData.company_id = updates.companyId;
        if (updates.tutorId !== undefined) dbData.tutor_id = updates.tutorId;
        if (updates.status !== undefined) dbData.status = updates.status;
        if (updates.possibleCompany !== undefined) dbData.possible_company = updates.possibleCompany;
        if (updates.startDate !== undefined) dbData.start_date = updates.startDate;
        if (updates.endDate !== undefined) dbData.end_date = updates.endDate;

        const { error } = await this.supabase
            .from('dual_students')
            .update(dbData)
            .eq('id', id);
        if (error) throw error;
    }

    async deleteDualStudent(id) {
        const { error } = await this.supabase.from('dual_students').delete().eq('id', id);
        if (error) throw error;
    }

    async getDualInteractions(relatedId) {
        const { data, error } = await this.supabase
            .from('dual_interactions')
            .select('*')
            .eq('related_id', relatedId)
            .order('date', { ascending: false });
        if (error) throw error;

        return data.map(i => ({
            id: i.id,
            type: i.type,
            date: i.date,
            notes: i.notes,
            relatedId: i.related_id,
            author: i.author,
            authorName: i.author_name
        }));
    }

    async addDualInteraction(data) {
        const dbData = {
            institute_id: this.currentInstitute.id,
            type: data.type,
            date: data.date,
            notes: data.notes,
            related_id: data.relatedId,
            related_type: data.relatedType,
            author: data.author,
            author_name: data.authorName
        };
        const { error } = await this.supabase.from('dual_interactions').insert([dbData]);
        if (error) throw error;
    }

    async deleteDualInteraction(id) {
        const { error } = await this.supabase.from('dual_interactions').delete().eq('id', id);
        if (error) throw error;
    }

    // Classroom Stubs (To be implemented with Google API)
    async getClassroomCourses() {
        return { courses: [], token: null };
    }

    async getClassroomStudents(courseId, token) {
        return [];
    }

    // ==================== DEPARTMENTS ====================

    async getAllDepartments() {
        const { data, error } = await this.supabase
            .from('departments')
            .select('*')
            .eq('institute_id', this.currentInstitute.id)
            .order('name');
        if (error) throw error;
        return data;
    }

    async createDepartment(data) {
        const { error } = await this.supabase
            .from('departments')
            .insert([{ ...data, institute_id: this.currentInstitute.id }]);
        if (error) throw error;
    }

    async updateDepartment(id, updates) {
        const { error } = await this.supabase
            .from('departments')
            .update(updates)
            .eq('id', id);
        if (error) throw error;
    }

    async deleteDepartment(id) {
        const { error } = await this.supabase
            .from('departments')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    async updateUserDepartment(userId, deptId) {
        // Update institute_members table
        const { error } = await this.supabase
            .from('institute_members')
            .update({ department: deptId })
            .eq('institute_id', this.currentInstitute.id)
            .eq('user_id', userId);
        if (error) throw error;
    }

    // ==================== DUAL MODULE ====================

    async getDualConfig() {
        if (!this.currentInstitute) return { cycles: [], levels: [] };
        const { data, error } = await this.supabase
            .from('dual_config')
            .select('*')
            .eq('institute_id', this.currentInstitute.id)
            .maybeSingle();

        if (error) throw error;
        return { cycles: data?.cycles || [], levels: data?.levels || [] };
    }

    async updateDualConfig(config) {
        if (!this.currentInstitute) throw new Error("No selected institute");
        const { error } = await this.supabase
            .from('dual_config')
            .upsert({
                institute_id: this.currentInstitute.id,
                cycles: config.cycles || [],
                levels: config.levels || [],
                updated_at: new Date()
            }, { onConflict: 'institute_id' });
        if (error) throw error;
    }

    async getCompanies() {
        const { data, error } = await this.supabase
            .from('companies')
            .select('*')
            .eq('institute_id', this.currentInstitute.id)
            .order('name');
        if (error) throw error;
        return data;
    }

    async createCompany(companyData) {
        const { error } = await this.supabase
            .from('companies')
            .insert([{ ...companyData, institute_id: this.currentInstitute.id }]);
        if (error) throw error;
    }

    async updateCompany(id, updates) {
        const { error } = await this.supabase
            .from('companies')
            .update(updates)
            .eq('id', id);
        if (error) throw error;
    }

    async deleteCompany(id) {
        const { error } = await this.supabase
            .from('companies')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    async getDualStudents(companyId = null) {
        let query = this.supabase
            .from('dual_students')
            .select('*')
            .eq('institute_id', this.currentInstitute.id)
            .order('name');

        if (companyId) query = query.eq('company_id', companyId);

        const { data, error } = await query;
        if (error) throw error;

        return data.map(s => ({
            id: s.id,
            name: s.name,
            course: s.course,
            cycle: s.cycle,
            level: s.level,
            schedule: s.schedule,
            companyId: s.company_id,
            tutorId: s.tutor_id,
            status: s.status,
            possibleCompany: s.possible_company,
            startDate: s.start_date,
            endDate: s.end_date
        }));
    }

    async createDualStudent(studentData) {
        const dbData = {
            institute_id: this.currentInstitute.id,
            name: studentData.name,
            course: studentData.course,
            cycle: studentData.cycle,
            level: studentData.level,
            schedule: studentData.schedule,
            company_id: studentData.companyId,
            tutor_id: studentData.tutorId,
            status: studentData.status,
            possible_company: studentData.possibleCompany,
            start_date: studentData.startDate,
            end_date: studentData.endDate
        };
        const { error } = await this.supabase.from('dual_students').insert([dbData]);
        if (error) throw error;
    }

    async updateDualStudent(id, updates) {
        const dbData = {};
        if (updates.name !== undefined) dbData.name = updates.name;
        if (updates.course !== undefined) dbData.course = updates.course;
        if (updates.cycle !== undefined) dbData.cycle = updates.cycle;
        if (updates.level !== undefined) dbData.level = updates.level;
        if (updates.schedule !== undefined) dbData.schedule = updates.schedule;
        if (updates.companyId !== undefined) dbData.company_id = updates.companyId;
        if (updates.tutorId !== undefined) dbData.tutor_id = updates.tutorId;
        if (updates.status !== undefined) dbData.status = updates.status;
        if (updates.possibleCompany !== undefined) dbData.possible_company = updates.possibleCompany;
        if (updates.startDate !== undefined) dbData.start_date = updates.startDate;
        if (updates.endDate !== undefined) dbData.end_date = updates.endDate;

        const { error } = await this.supabase
            .from('dual_students')
            .update(dbData)
            .eq('id', id);
        if (error) throw error;
    }

    async deleteDualStudent(id) {
        const { error } = await this.supabase.from('dual_students').delete().eq('id', id);
        if (error) throw error;
    }

    async getDualInteractions(relatedId) {
        const { data, error } = await this.supabase
            .from('dual_interactions')
            .select('*')
            .eq('related_id', relatedId)
            .order('date', { ascending: false });
        if (error) throw error;

        return data.map(i => ({
            id: i.id,
            type: i.type,
            date: i.date,
            notes: i.notes,
            relatedId: i.related_id,
            author: i.author,
            authorName: i.author_name
        }));
    }

    async addDualInteraction(data) {
        const dbData = {
            institute_id: this.currentInstitute.id,
            type: data.type,
            date: data.date,
            notes: data.notes,
            related_id: data.relatedId,
            related_type: data.relatedType,
            author: data.author,
            author_name: data.authorName
        };
        const { error } = await this.supabase.from('dual_interactions').insert([dbData]);
        if (error) throw error;
    }

    async deleteDualInteraction(id) {
        const { error } = await this.supabase.from('dual_interactions').delete().eq('id', id);
        if (error) throw error;
    }

    // Classroom Stubs
    async getClassroomCourses() { return { courses: [], token: null }; }
    async getClassroomStudents(courseId, token) { return []; }

    // ==================== SUM RESERVATIONS ====================

    async getMonthAvailability(year, month) {
        // We'll return reserved slots for each day
        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

        // Fetch SUM reservations
        const { data: sumRes, error: sumError } = await this.supabase
            .from('sum_reservations')
            .select('date')
            .eq('institute_id', this.currentInstitute.id)
            .gte('date', startDate)
            .lte('date', endDate);

        if (sumError) throw sumError;

        // Fetch Holidays (reuse calendar_days)
        const { data: holidays, error: holError } = await this.supabase
            .from('calendar_days')
            .select('date, is_holiday')
            .eq('institute_id', this.currentInstitute.id)
            .eq('is_holiday', true)
            .gte('date', startDate)
            .lte('date', endDate);

        if (holError) throw holError;

        // Map results
        // Use object keyed by dateStr
        const result = {};

        // Mark holidays
        holidays?.forEach(h => {
            if (!result[h.date]) result[h.date] = {};
            result[h.date].isHoliday = true;
        });

        // Use SUM logic? The UI highlights days with reservations?
        // Actually UI calls 'loadSchedule' for selected date. 
        // renderCell highlights holidays. 
        // Maybe we just return holidays here for the calendar view.
        return result;
    }

    async getSUMReservations(dateStr) {
        const { data, error } = await this.supabase
            .from('sum_reservations')
            .select('*')
            .eq('institute_id', this.currentInstitute.id)
            .eq('date', dateStr);

        if (error) throw error;

        return data.map(r => ({
            id: r.id,
            slotIndex: r.slot_index,
            title: r.title,
            userId: r.user_id,
            userName: r.user_name
        }));
    }

    async reserveSUM(dateStr, slotIndex, slotLabel, title, userId, userName) {
        const { error } = await this.supabase
            .from('sum_reservations')
            .insert({
                institute_id: this.currentInstitute.id,
                date: dateStr,
                slot_index: slotIndex,
                title: title,
                user_id: userId,
                user_name: userName
            });
        if (error) throw error;
    }

    async cancelSUMReservation(id) {
        const { error } = await this.supabase.from('sum_reservations').delete().eq('id', id);
        if (error) throw error;
    }

    // ==================== LAPTOP CARTS ====================

    async getCarts() {
        const { data, error } = await this.supabase
            .from('laptop_carts')
            .select('*')
            .eq('institute_id', this.currentInstitute.id);
        if (error) throw error;
        return data;
    }

    async createCart(cartData) {
        const { error } = await this.supabase.from('laptop_carts').insert([{ ...cartData, institute_id: this.currentInstitute.id }]);
        if (error) throw error;
    }

    async updateCart(id, updates) {
        const { error } = await this.supabase.from('laptop_carts').update(updates).eq('id', id);
        if (error) throw error;
    }

    async deleteCart(id) {
        const { error } = await this.supabase.from('laptop_carts').delete().eq('id', id);
        if (error) throw error;
    }

    async getCartReservations(dateStr) {
        const { data, error } = await this.supabase
            .from('cart_reservations')
            .select('*')
            .eq('institute_id', this.currentInstitute.id)
            .eq('date', dateStr);
        if (error) throw error;

        return data.map(r => ({
            id: r.id,
            cartId: r.cart_id,
            slotIndex: r.slot_index,
            userId: r.user_id,
            userName: r.user_name,
            comment: r.comment
        }));
    }

    async getCartReservationsInRange(startStr, endStr) {
        const { data, error } = await this.supabase
            .from('cart_reservations')
            .select('*')
            .eq('institute_id', this.currentInstitute.id)
            .gte('date', startStr)
            .lte('date', endStr);
        if (error) throw error;

        return data.map(r => ({
            id: r.id,
            cartId: r.cart_id,
            slotIndex: r.slot_index,
            date: r.date,
            userId: r.user_id,
            userName: r.user_name
        }));
    }

    async getReservationsForCartInRange(cartId, slotIndex, startStr, userId) {
        // Query for mass delete
        const { data, error } = await this.supabase
            .from('cart_reservations')
            .select('*')
            .eq('institute_id', this.currentInstitute.id)
            .eq('cart_id', cartId)
            .eq('slot_index', slotIndex)
            .eq('user_id', userId)
            .gte('date', startStr);
        if (error) throw error;
        return data;
    }

    async reserveCart(dateStr, slotIndex, slotLabel, cartId, userId, userName, comment) {
        const { error } = await this.supabase
            .from('cart_reservations')
            .insert({
                institute_id: this.currentInstitute.id,
                date: dateStr,
                slot_index: slotIndex,
                cart_id: cartId,
                user_id: userId,
                user_name: userName,
                comment: comment
            });
        if (error) throw error;
    }

    async cancelCartReservation(id) {
        const { error } = await this.supabase.from('cart_reservations').delete().eq('id', id);
        if (error) throw error;
    }

    // ==================== LOGS & STATS ====================

    async getLoginLogs(pageSize, cursor) {
        // Stub: Return empty logs
        return { logs: [], lastVisible: null };
    }

    calculateStats(tickets, type, deptMap) {
        const stats = {
            total: tickets.length,
            open: 0,
            resolved: 0,
            totalCost: 0,
            byDepartment: {},
            byUser: {}
        };

        tickets.forEach(t => {
            if (t.status === 'abierto' || t.status === 'en_progreso') stats.open++;
            if (t.status === 'resuelto' || t.status === 'cerrado') stats.resolved++;
            stats.totalCost += (parseFloat(t.totalCost) || 0);

            const deptName = deptMap[t.requestedByDepartment] || 'Sin Departamento';
            if (!stats.byDepartment[deptName]) {
                stats.byDepartment[deptName] = { count: 0, totalTime: 0, totalCost: 0 };
            }
            stats.byDepartment[deptName].count++;
            stats.byDepartment[deptName].totalTime += (parseInt(t.resolutionTime) || 0);
            stats.byDepartment[deptName].totalCost += (parseFloat(t.totalCost) || 0);

            const userName = t.requestedByName || 'Desconocido';
            if (!stats.byUser[userName]) {
                stats.byUser[userName] = { count: 0 };
            }
            stats.byUser[userName].count++;
        });

        return stats;
    }

    // ==================== CALENDAR ====================

    subscribeToMonth(year, month, callback) {
        // Simplified fetch-once for now
        const fetch = async () => {
            if (!this.currentInstitute) return;
            // Calculate start/end date for the month
            const startDate = new Date(year, month, 1);
            const endDate = new Date(year, month + 1, 0);
            const startStr = startDate.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];

            // Fetch Days (slots, holidays)
            // Assumes table 'calendar_days' exists
            const { data: days } = await this.supabase
                .from('calendar_days')
                .select('*')
                .eq('institute_id', this.currentInstitute.id)
                .gte('date', startStr)
                .lte('date', endStr);

            // Fetch Events
            // Assumes table 'calendar_events' exists
            const { data: events } = await this.supabase
                .from('calendar_events')
                .select('*')
                .eq('institute_id', this.currentInstitute.id)
                .gte('date', startStr)
                .lte('date', endStr);

            const result = {};
            // Populate result
            (days || []).forEach(d => {
                result[d.date] = {
                    slots: d.slots,
                    isHoliday: d.is_holiday,
                    driveLink: d.drive_link,
                    events: []
                };
            });

            (events || []).forEach(e => {
                if (!result[e.date]) {
                    // If no day record, create default
                    result[e.date] = { slots: 4, isHoliday: false, driveLink: null, events: [] };
                }
                result[e.date].events.push(e);
            });

            // Ensure calendar shows empty days if needed by caller? 
            // Caller probably handles empty dates.
            callback(result);
        };
        fetch();
        return () => { };
    }

    async toggleHoliday(dateStr) {
        if (!this.currentInstitute) return;
        // Upsert logic
        // Get current state
        const { data } = await this.supabase.from('calendar_days').select('is_holiday').eq('date', dateStr).eq('institute_id', this.currentInstitute.id).maybeSingle();
        const current = data ? data.is_holiday : false;

        await this.supabase.from('calendar_days').upsert({
            institute_id: this.currentInstitute.id,
            date: dateStr,
            is_holiday: !current
        }, { onConflict: 'institute_id, date' });
    }

    async updateSlot(dateStr, slots) {
        if (!this.currentInstitute) return;
        await this.supabase.from('calendar_days').upsert({
            institute_id: this.currentInstitute.id,
            date: dateStr,
            slots: slots
        }, { onConflict: 'institute_id, date' });
    }

    async setDriveLink(dateStr, linkId) {
        if (!this.currentInstitute) return;
        await this.supabase.from('calendar_days').upsert({
            institute_id: this.currentInstitute.id,
            date: dateStr,
            drive_link: linkId
        }, { onConflict: 'institute_id, date' });
    }

    async addCalendarEvent(dateStr, event) {
        if (!this.currentInstitute) return;

        // Ensure dateStr is valid
        if (!dateStr) return;

        await this.supabase.from('calendar_events').insert({
            institute_id: this.currentInstitute.id,
            date: dateStr,
            title: event.title,
            type: event.type,
            time: event.time,
            link: event.link,
            description: event.description || ''
        });
    }

    async removeCalendarEvent(dateStr, event) {
        // Needs event ID. If event object has ID from DB, use it.
        // Assuming event.id exists.
        if (event.id) {
            await this.supabase.from('calendar_events').delete().eq('id', event.id);
        } else {
            console.warn("Cannot remove event without ID");
        }
    }

    async syncDriveEvents(year, month) {
        console.warn("Google Drive Sync not implemented in Supabase version yet.");
        return 0;
    }
}
