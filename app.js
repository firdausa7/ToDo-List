// ==================== CONFIGURATION ====================
const XANO_API = 'https://x8ki-letl-twmt.n7.xano.io/api:P1c5LU3H';

// ==================== APPLICATION STATE ====================
let notificationCheckInterval = null;

// ==================== UTILITY FUNCTIONS ====================
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(date) {
    if (!date) return 'No due date';
    const dateObj = new Date(date);
    return isNaN(dateObj.getTime()) ? 'Invalid date' : dateObj.toLocaleString();
}

function isTaskOverdue(task) {
    const due = task.due_date || task.dueDate;
    const completed = task.is_completed || task.completed;
    if (!due || completed) return false;
    return new Date(due) < new Date();
}

function updateStats(todos) {
    const total = todos.length;
    const completed = todos.filter(t => t.is_completed || t.completed).length;
    const pending = total - completed;
    const overdue = todos.filter(t => isTaskOverdue(t) && !(t.is_completed || t.completed)).length;

    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('pendingTasks').textContent = pending;
    document.getElementById('overdueTasks').textContent = overdue;
}

function updateSubmitButton(isLoading, text) {
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    if (!submitBtn || !submitText) return;

    submitBtn.disabled = isLoading;
    submitText.textContent = text;
}

function validateTaskData(data) {
    if (!data.title || !data.title.trim()) {
        return { isValid: false, error: 'Task title cannot be empty' };
    }
    return { isValid: true };
}

// ==================== API FUNCTIONS ====================
async function loadTodos() {
    try {
        const response = await fetch(`${XANO_API}/task`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Load todos error:', error);
        showToast('Using demo data (Xano unavailable)', 'info');
        throw error;
    }
}

async function createTodo(todoData) {
    try {
        const response = await fetch(`${XANO_API}/task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: todoData.title,
                description: todoData.description || '',
                due_date: todoData.dueDate || null,
                priority: todoData.priority || 'medium',
                is_completed: false
            })
        });
        if (!response.ok) throw new Error('Create failed');
        return await response.json();
    } catch (error) {
        console.error('Create todo error:', error);
        throw error;
    }
}

async function updateTodo(id, updates) {
    try {
        const response = await fetch(`${XANO_API}/task/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: updates.title,
                description: updates.description || '',
                due_date: updates.dueDate || null,
                priority: updates.priority || 'medium',
                is_completed: updates.completed || false
            })
        });
        if (!response.ok) throw new Error('Update failed');
        return await response.json();
    } catch (error) {
        console.error('Update todo error:', error);
        throw error;
    }
}

async function updateTodoCompletion(id, isCompleted) {
    try {
        const response = await fetch(`${XANO_API}/task/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_completed: isCompleted })
        });
        if (!response.ok) throw new Error('Completion update failed');
        return await response.json();
    } catch (error) {
        console.error('Update completion error:', error);
        throw error;
    }
}

async function deleteTodo(id) {
    try {
        const response = await fetch(`${XANO_API}/task/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Delete failed');
        return true;
    } catch (error) {
        console.error('Delete todo error:', error);
        throw error;
    }
}

// ==================== RENDER FUNCTIONS ====================
function renderTodos(todos, filter = 'all') {
    const container = document.getElementById('taskListContainer');
    if (!container) return;

    const filtered = todos.filter(task => {
        const overdue = isTaskOverdue(task);
        const completed = task.is_completed || task.completed;
        switch (filter) {
            case 'all': return true;
            case 'pending': return !completed && !overdue;
            case 'completed': return completed;
            case 'overdue': return overdue;
            default: return true;
        }
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <p>No tasks found. ${filter !== 'all' ? 'Try a different filter.' : 'Add your first task!'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(task => {
        const completed = task.is_completed || task.completed;
        const overdue = isTaskOverdue(task);
        const dueFormatted = formatDate(task.due_date || task.dueDate);

        return `
            <div class="task-item ${completed ? 'completed' : ''} ${overdue ? 'overdue' : ''}" data-id="${task.id}">
                <div class="task-header">
                    <h3 class="task-title">${escapeHtml(task.title)}</h3>
                    <span class="task-priority priority-${task.priority || 'medium'}">${task.priority || 'medium'}</span>
                </div>
                ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
                <div class="task-footer">
                    <div class="task-due ${overdue ? 'overdue' : ''}">
                        <i class="fas fa-calendar-alt"></i> ${dueFormatted}
                        ${overdue ? ' <i class="fas fa-exclamation-circle"></i> OVERDUE' : ''}
                    </div>
                    <div class="task-actions">
                        <button class="btn btn-sm ${completed ? 'btn-warning' : 'btn-success'}" onclick="app.toggleComplete(${task.id})">
                            <i class="fas ${completed ? 'fa-undo' : 'fa-check'}"></i> ${completed ? 'Undo' : 'Complete'}
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="app.editTask(${task.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="app.showDeleteModal(${task.id}, '${escapeHtml(task.title)}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== FORM HANDLER ====================
function handleFormSubmit(e) {
    e.preventDefault();
    const taskId = document.getElementById('taskId').value || null;
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const dueDate = document.getElementById('dueDate').value;
    const priority = document.getElementById('priority').value;

    const todoData = { title, description, dueDate, priority };
    const validation = validateTaskData(todoData);
    if (!validation.isValid) return showToast(validation.error, 'error');

    updateSubmitButton(true, 'Processing...');
    if (taskId) app.updateTask(Number(taskId), todoData);
    else app.createTask(todoData);
}

// ==================== APPLICATION OBJECT ====================
const app = {
    todos: [],
    currentFilter: 'all',
    editTaskId: null,
    taskToDelete: null,
    isDarkMode: false,

    async init() {
        this.setupEventListeners();
        this.loadThemePreference();
        await this.testXanoAPI();
        await this.loadInitialData();
        this.startDueChecker();
    },

    async testXanoAPI() {
        try {
            const res = await fetch(`${XANO_API}/task`);
            if (res.ok) showToast('✅ Connected to Xano API', 'success');
            else showToast('❌ Xano API error', 'error');
        } catch {
            showToast('❌ Xano API unavailable', 'error');
        }
    },

    async loadInitialData() {
        try {
            const apiTodos = await loadTodos();
            this.todos = apiTodos.map(todo => ({
                id: todo.id,
                title: todo.title || 'Untitled',
                description: todo.description || '',
                dueDate: todo.due_date || null,
                priority: todo.priority || 'medium',
                completed: todo.is_completed || false
            }));
        } catch {
            this.todos = [];
        } finally {
            renderTodos(this.todos, this.currentFilter);
            updateStats(this.todos);
        }
    },

    setupEventListeners() {
        const form = document.getElementById('taskForm');
        if (form) form.addEventListener('submit', handleFormSubmit);

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentFilter = btn.dataset.filter;
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderTodos(this.todos, this.currentFilter);
            });
        });

        const cancelDelete = document.getElementById('cancelDelete');
        const confirmDelete = document.getElementById('confirmDelete');
        const closeDelete = document.getElementById('closeDeleteModal');
        if (cancelDelete) cancelDelete.addEventListener('click', () => this.hideDeleteModal());
        if (closeDelete) closeDelete.addEventListener('click', () => this.hideDeleteModal());
        if (confirmDelete) confirmDelete.addEventListener('click', () => {
            if (this.taskToDelete) this.deleteTask(this.taskToDelete);
        });

        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) themeBtn.addEventListener('click', () => this.toggleTheme());
    },

    async createTask(todoData) {
        try {
            const newTodo = await createTodo(todoData);
            this.todos.push({
                id: newTodo.id,
                title: todoData.title,
                description: todoData.description,
                dueDate: todoData.dueDate,
                priority: todoData.priority,
                completed: false
            });
            showToast('Task created successfully', 'success');
        } catch {
            this.todos.push({ id: Date.now(), ...todoData, completed: false });
            showToast('Saved locally (API unavailable)', 'info');
        } finally {
            renderTodos(this.todos, this.currentFilter);
            updateStats(this.todos);
            document.getElementById('taskForm').reset();
            updateSubmitButton(false, 'Add Task');
        }
    },

    async updateTask(id, updates) {
        try {
            await updateTodo(id, updates);
            const index = this.todos.findIndex(t => t.id === id);
            if (index !== -1) this.todos[index] = { ...this.todos[index], ...updates };
            showToast('Task updated successfully', 'success');
        } catch {
            const index = this.todos.findIndex(t => t.id === id);
            if (index !== -1) this.todos[index] = { ...this.todos[index], ...updates };
            showToast('Updated locally (API unavailable)', 'info');
        } finally {
            renderTodos(this.todos, this.currentFilter);
            updateStats(this.todos);
            document.getElementById('taskForm').reset();
            document.getElementById('taskId').value = '';
            updateSubmitButton(false, 'Update Task');
        }
    },

    async toggleComplete(id) {
        const index = this.todos.findIndex(t => t.id === id);
        if (index === -1) return;

        const newStatus = !this.todos[index].completed;
        try {
            await updateTodoCompletion(id, newStatus);
            this.todos[index].completed = newStatus;
            showToast(newStatus ? 'Task marked complete' : 'Task marked pending', 'success');
        } catch {
            this.todos[index].completed = newStatus;
            showToast('Updated locally (API unavailable)', 'info');
        } finally {
            renderTodos(this.todos, this.currentFilter);
            updateStats(this.todos);
        }
    },

    editTask(id) {
        const todo = this.todos.find(t => t.id === id);
        if (!todo) return showToast('Task not found', 'error');
        document.getElementById('taskId').value = todo.id;
        document.getElementById('title').value = todo.title;
        document.getElementById('description').value = todo.description || '';
        document.getElementById('dueDate').value = todo.dueDate || '';
        document.getElementById('priority').value = todo.priority || 'medium';
        document.getElementById('formTitle').textContent = 'Edit Task';
        document.getElementById('submitText').textContent = 'Update Task';
    },

    showDeleteModal(id, title) {
        this.taskToDelete = id;
        document.getElementById('taskToDeleteTitle').textContent = title;
        document.getElementById('deleteModal').style.display = 'flex';
    },

    hideDeleteModal() {
        this.taskToDelete = null;
        document.getElementById('deleteModal').style.display = 'none';
    },

    async deleteTask(id) {
        try {
            await deleteTodo(id);
            this.todos = this.todos.filter(t => t.id !== id);
            showToast('Task deleted successfully', 'success');
        } catch {
            this.todos = this.todos.filter(t => t.id !== id);
            showToast('Deleted locally (API unavailable)', 'info');
        } finally {
            renderTodos(this.todos, this.currentFilter);
            updateStats(this.todos);
            this.hideDeleteModal();
        }
    },

    loadThemePreference() {
        const saved = localStorage.getItem('todoAppDarkMode');
        if (saved !== null) {
            this.isDarkMode = JSON.parse(saved);
            document.body.classList.toggle('dark-mode', this.isDarkMode);
        }
    },

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        document.body.classList.toggle('dark-mode', this.isDarkMode);
        localStorage.setItem('todoAppDarkMode', this.isDarkMode);
        showToast(this.isDarkMode ? 'Dark mode enabled' : 'Light mode enabled', 'info');
    },

    startDueChecker() {
        if (notificationCheckInterval) clearInterval(notificationCheckInterval);
        notificationCheckInterval = setInterval(() => {
            this.todos.forEach(task => {
                if (!task.completed && task.dueDate) {
                    const diff = new Date(task.dueDate).getTime() - Date.now();
                    if (diff > 0 && diff <= 30 * 60 * 1000) {
                        showToast(`"${task.title}" is due soon!`, 'info');
                    }
                    if (diff < 0) {
                        showToast(`"${task.title}" is overdue!`, 'error');
                    }
                }
            });
        }, 5 * 60 * 1000);
    }
};

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', () => app.init());
