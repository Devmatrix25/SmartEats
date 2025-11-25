// Base JavaScript utilities and common functionality
class SmartEatsApp {
    constructor() {
        this.apiBaseUrl = 'https://smarteats-09nh.onrender.com/api';
        this.socket = null;
        this.currentUser = null;
        this.init();
    }

    init() {
        this.loadTheme();
        this.setupInterceptors();
        this.checkAuth();
        this.setupEventListeners();
    }

    setupInterceptors() {
        const originalFetch = window.fetch;
        window.fetch = async (url, options = {}) => {
            const token = localStorage.getItem('accessToken');
            
            if (token && !url.includes('/auth/refresh')) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`
                };
            }

            const response = await originalFetch(url, options);
            
            if (response.status === 401 && !url.includes('/auth/')) {
                const refreshSuccess = await this.refreshToken();
                if (refreshSuccess) {
                    return originalFetch(url, {
                        ...options,
                        headers: {
                            ...options.headers,
                            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                        }
                    });
                } else {
                    this.logout();
                }
            }

            return response;
        };
    }

    // -------------------------------
    // THE FIX: Unified user formatting
    // -------------------------------
    normalizeUser(u) {
    if (!u) return {};

    // If backend sends array of addresses, preserve it
    let addressList = Array.isArray(u.address) ? u.address : [];
    let defaultAddress = addressList.find(a => a.isDefault) || addressList[0] || null;

    return {
        id: u._id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        avatar: u.avatar || null,

        // Keep REAL address array
        addressList,

        // And keep default address for checkout
        defaultAddress
    };
}

    // -------------------------------

    // Theme Management
    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeToggle(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeToggle(newTheme);
    }

    updateThemeToggle(theme) {
        const toggles = document.querySelectorAll('.theme-toggle');
        toggles.forEach(toggle => {
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            }
            toggle.setAttribute('title', `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`);
        });
    }

    // Authentication
    async checkAuth() {
        const token = localStorage.getItem('accessToken');

        // Load user from localStorage
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.updateUIForAuth(this.currentUser);
        }

        if (token) {
            try {
                const verified = await this.verifyToken(token);
                const normalized = this.normalizeUser(verified);

                localStorage.setItem('currentUser', JSON.stringify(normalized));
                this.currentUser = normalized;

                this.updateUIForAuth(this.currentUser);

            } catch (error) {
                this.handleAuthError();
            }
        }
    }

    async verifyToken(token) {
        const response = await fetch(`${this.apiBaseUrl}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Invalid token');
        }

        const data = await response.json();
        const raw = data.user || data;

        return this.normalizeUser(raw);
    }

    updateUIForAuth(user) {
        const authElements = document.querySelectorAll('.auth-only');
        const guestElements = document.querySelectorAll('.guest-only');
        
        authElements.forEach(el => el.style.display = 'block');
        guestElements.forEach(el => el.style.display = 'none');

        const userMenu = document.getElementById('userMenu');
        if (userMenu) {
            userMenu.innerHTML = `
                <img src="${user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || 'User')}" 
                     alt="${user.name}" 
                     class="rounded-circle me-2" 
                     width="32" 
                     height="32">
                ${user.name}
            `;
        }
    }

    handleAuthError() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('currentUser');
        this.currentUser = null;
         const currentPath = window.location.pathname;

    // Driver App Redirect
    if (currentPath.includes('/driver/')) {
        window.location.href = '../driver/index.html';
    }
    // Restaurant App Redirect
    else if (currentPath.includes('/restaurant/')) {
        window.location.href = '../restaurant/index.html';
    }
    // Customer App Redirect
    else {
        window.location.href = '../customer/index.html';
    }
    }

    // API Calls
    async apiCall(endpoint, options = {}) {
        const token = localStorage.getItem('accessToken');
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        const config = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, config);
            
            if (response.status === 401) {
                const newToken = await this.refreshToken();
                if (newToken) {
                    config.headers.Authorization = `Bearer ${newToken}`;
                    return await fetch(`${this.apiBaseUrl}${endpoint}`, config);
                }
            }
            
            return response;
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    async refreshToken() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            this.handleAuthError();
            return null;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('accessToken', data.accessToken);
                return data.accessToken;
            } else {
                this.handleAuthError();
                return null;
            }
        } catch (error) {
            this.handleAuthError();
            return null;
        }
    }

    // Socket.IO
    connectSocket() {
        if (this.socket) return;

        const token = localStorage.getItem('accessToken');
        this.socket = io({
            auth: { token }
        });

        this.socket.on('connect', () => console.log('Connected to server'));
        this.socket.on('disconnect', () => console.log('Disconnected from server'));
        this.socket.on('error', (error) => console.error('Socket error:', error));
    }

    disconnectSocket() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    // UI Helpers
    showLoading(selector = 'body') {
        document.querySelector(selector)?.classList.add('loading');
    }

    hideLoading(selector = 'body') {
        document.querySelector(selector)?.classList.remove('loading');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} alert-dismissible fade show`;
        toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'position-fixed top-0 end-0 p-3';
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        }
        
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    }

    formatTime(dateString) {
        return new Date(dateString).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.theme-toggle')) this.toggleTheme();
            if (e.target.closest('.logout-btn')) {
                e.preventDefault();
                this.logout();
            }
        });
    }

    async logout() {
        try {
            await this.apiCall('/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            this.currentUser = null;
            this.disconnectSocket();
            window.location.href = '../customer/index.html';
        }
    }

    async handleFormSubmit(form, endpoint, method = 'POST', successCallback = null) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            
            try {
                submitBtn.innerHTML = '<div class="loading-spinner"></div>';
                submitBtn.disabled = true;

                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());

                const response = await this.apiCall(endpoint, {
                    method: method,
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    const result = await response.json();
                    this.showToast('Operation completed successfully!', 'success');
                    
                    if (successCallback) {
                        successCallback(result);
                    }
                } else {
                    const error = await response.json();
                    this.showToast(error.message || 'Something went wrong', 'error');
                }
            } catch (error) {
                this.showToast('Network error occurred', 'error');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
}

// Initialize the app
const smartEats = new SmartEatsApp();
window.smartEats = smartEats;
