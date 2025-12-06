// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// API Helper Functions
class API {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
    }

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const config = {
            ...options,
            headers,
        };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Auth endpoints
    async register(username, email, password) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password }),
        });
    }

    async login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    }

    async logout() {
        return this.request('/auth/logout', {
            method: 'POST',
        });
    }

    async getCurrentUser() {
        return this.request('/auth/me');
    }

    // User endpoints
    async getAllUsers() {
        return this.request('/users');
    }

    async getUserById(userId) {
        return this.request(`/users/${userId}`);
    }

    // Conversation endpoints
    async createConversation(participantId) {
        return this.request('/conversations', {
            method: 'POST',
            body: JSON.stringify({ participantId }),
        });
    }

    async getRecentChats(page = 1, limit = 20) {
        return this.request(`/conversations?page=${page}&limit=${limit}`);
    }

    async getConversationById(conversationId) {
        return this.request(`/conversations/${conversationId}`);
    }

    // Message endpoints
    async sendMessage(conversationId, content) {
        return this.request('/messages', {
            method: 'POST',
            body: JSON.stringify({ conversationId, content }),
        });
    }

    async sendMediaMessage(conversationId, file) {
        const formData = new FormData();
        formData.append('conversationId', conversationId);
        formData.append('file', file);

        const headers = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${API_BASE_URL}/messages/media`, {
            method: 'POST',
            headers,
            body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Upload failed');
        }

        return data;
    }

    async getChatHistory(conversationId, limit = 50, cursor = null) {
        let url = `/messages/${conversationId}?limit=${limit}`;
        if (cursor) {
            url += `&cursor=${cursor}`;
        }
        return this.request(url);
    }

    async markMessageAsRead(messageId) {
        return this.request(`/messages/${messageId}/read`, {
            method: 'PUT',
        });
    }

    async markAllMessagesAsRead(conversationId) {
        return this.request(`/messages/${conversationId}/read-all`, {
            method: 'PUT',
        });
    }
}

// Export API instance
const api = new API();
