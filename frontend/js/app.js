// Main App Controller
class ChatApp {
    constructor() {
        this.currentUser = null;
        this.allUsers = [];
        this.conversations = [];
        this.activeConversation = null;
        this.messages = {};
        this.selectedFile = null;
        this.typingTimeout = null;
    }

    async init() {
        // Check if user is already logged in
        const token = localStorage.getItem('token');
        if (token) {
            try {
                await this.loadCurrentUser();
                this.showChatScreen();
                await this.loadData();
            } catch (error) {
                console.error('Auto-login failed:', error);
                this.showAuthScreen();
            }
        } else {
            this.showAuthScreen();
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Auth forms
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Message form
        document.getElementById('message-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSendMessage();
        });

        // File input
        document.getElementById('file-input').addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        // Typing indicator
        const messageInput = document.getElementById('message-input');
        messageInput.addEventListener('input', () => {
            if (this.activeConversation) {
                socketManager.sendTyping(this.activeConversation._id);

                clearTimeout(this.typingTimeout);
                this.typingTimeout = setTimeout(() => {
                    socketManager.sendStopTyping(this.activeConversation._id);
                }, 1000);
            }
        });
    }

    async handleRegister() {
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        try {
            const response = await api.register(username, email, password);
            api.setToken(response.data.token);
            this.currentUser = response.data.user;

            UI.showToast('Account created successfully!', 'success');
            this.showChatScreen();
            await this.loadData();
        } catch (error) {
            UI.showError(error.message || 'Registration failed');
        }
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await api.login(email, password);
            api.setToken(response.data.token);
            this.currentUser = response.data.user;

            UI.showToast('Welcome back!', 'success');
            this.showChatScreen();
            await this.loadData();
        } catch (error) {
            UI.showError(error.message || 'Login failed');
        }
    }

    async loadCurrentUser() {
        const response = await api.getCurrentUser();
        this.currentUser = response.data.user;
    }

    async loadData() {
        // Connect Socket.io
        socketManager.connect(api.token);

        // Update current user display
        const avatar = document.getElementById('current-user-avatar');
        const username = document.getElementById('current-username');
        if (avatar) avatar.textContent = UI.getInitials(this.currentUser.username);
        if (username) username.textContent = this.currentUser.username;

        // Load users and conversations
        await Promise.all([
            this.loadAllUsers(),
            this.loadConversations()
        ]);
    }

    async loadAllUsers() {
        try {
            const response = await api.getAllUsers();
            this.allUsers = response.data.users;
            this.renderUsersList();
        } catch (error) {
            console.error('Failed to load users:', error);
            // Show error in UI
            const container = document.getElementById('users-list');
            container.innerHTML = `<div class="empty-state">
                <p>Failed to load users</p>
                <small>${error.message || 'Please refresh the page'}</small>
            </div>`;
            UI.showToast('Failed to load users', 'error');
        }
    }

    async loadConversations() {
        try {
            const response = await api.getRecentChats();
            this.conversations = response.data.conversations;
            this.renderConversationsList();
        } catch (error) {
            console.error('Failed to load conversations:', error);
        }
    }

    renderUsersList() {
        const container = document.getElementById('users-list');
        container.innerHTML = '';

        if (this.allUsers.length === 0) {
            container.innerHTML = '<div class="empty-state">No users found</div>';
            return;
        }

        this.allUsers.forEach(user => {
            const userItem = UI.renderUserItem(user, (user) => this.handleUserClick(user));
            container.appendChild(userItem);
        });
    }

    renderConversationsList() {
        const container = document.getElementById('conversations-list');
        container.innerHTML = '';

        if (this.conversations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No conversations yet</p>
                    <small>Select a user to start chatting</small>
                </div>
            `;
            return;
        }

        this.conversations.forEach(conversation => {
            const convItem = UI.renderConversationItem(
                conversation,
                (conv) => this.handleConversationClick(conv)
            );
            container.appendChild(convItem);
        });
    }

    async handleUserClick(user) {
        try {
            // Create or get conversation
            const response = await api.createConversation(user._id || user.id);
            const conversation = response.data.conversation;

            // Update conversations list if new
            const exists = this.conversations.find(c => c._id === conversation._id);
            if (!exists) {
                this.conversations.unshift(conversation);
                this.renderConversationsList();
            }

            // Open the conversation
            await this.openConversation(conversation);

            UI.setActiveUser(user._id || user.id);

            // Close mobile sidebar after selection
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                const overlay = document.querySelector('.sidebar-overlay');
                if (sidebar) sidebar.classList.remove('mobile-show');
                if (overlay) overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        } catch (error) {
            console.error('Failed to create conversation:', error);
            UI.showToast('Failed to start conversation', 'error');
        }
    }

    async handleConversationClick(conversation) {
        await this.openConversation(conversation);
        UI.setActiveConversation(conversation._id);

        // Close mobile sidebar after selection
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            if (sidebar) sidebar.classList.remove('mobile-show');
            if (overlay) overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    async openConversation(conversation) {
        // Leave previous conversation
        if (this.activeConversation) {
            socketManager.leaveConversation(this.activeConversation._id);
        }

        this.activeConversation = conversation;

        // Join new conversation
        socketManager.joinConversation(conversation._id);

        // Get other user
        const otherUser = conversation.participants.find(
            p => p._id !== this.currentUser.id
        );

        // Update UI
        document.getElementById('empty-chat').style.display = 'none';
        document.getElementById('active-chat').style.display = 'flex';
        UI.updateChatHeader(otherUser);

        // On mobile, hide sidebar and show chat view
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.querySelector('.sidebar-overlay');

            // Hide sidebar
            if (sidebar) {
                sidebar.classList.remove('mobile-show');
                sidebar.classList.add('mobile-hide');
            }

            // Hide overlay
            if (overlay) {
                overlay.classList.remove('active');
            }

            // Re-enable body scroll
            document.body.style.overflow = '';
        }

        // Load messages
        await this.loadMessages(conversation._id);
    }

    async loadMessages(conversationId) {
        try {
            const response = await api.getChatHistory(conversationId);
            this.messages[conversationId] = response.data.messages.reverse(); // Reverse to show oldest first

            this.renderMessages();

            // Mark all as read
            await api.markAllMessagesAsRead(conversationId);
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    renderMessages() {
        const container = document.getElementById('messages-container');
        container.innerHTML = '';

        const messages = this.messages[this.activeConversation._id] || [];

        if (messages.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No messages yet</p>
                    <small>Send a message to start the conversation</small>
                </div>
            `;
            return;
        }

        // CRITICAL FIX: Remove duplicates before rendering
        const uniqueMessages = messages.filter((msg, index, self) =>
            index === self.findIndex(m => m._id === msg._id)
        );

        console.log(`Rendering ${uniqueMessages.length} unique messages (had ${messages.length})`);

        uniqueMessages.forEach(message => {
            const messageEl = UI.renderMessage(message, this.currentUser.id);
            container.appendChild(messageEl);
        });

        UI.scrollToBottom(container);
    }

    async handleSendMessage() {
        const input = document.getElementById('message-input');
        const content = input.value.trim();

        if (!content && !this.selectedFile) return;
        if (!this.activeConversation) {
            UI.showToast('Please select a conversation first', 'error');
            return;
        }

        try {
            if (this.selectedFile) {
                // Send media message
                UI.showToast('Uploading file...', 'info');

                try {
                    await api.sendMediaMessage(
                        this.activeConversation._id,
                        this.selectedFile
                    );

                    // Clear file selection and show success
                    this.clearFileSelection();
                    UI.showToast('File sent successfully!', 'success');
                } catch (uploadError) {
                    console.error('Failed to upload file:', uploadError);
                    UI.showToast('Failed to upload file', 'error');
                    return; // Exit early on upload error
                }
            } else {
                // Send text message via API
                await api.sendMessage(
                    this.activeConversation._id,
                    content
                );
            }

            input.value = '';

            // Try to reload conversations (non-critical)
            try {
                await this.loadConversations();
            } catch (error) {
                console.error('Failed to reload conversations:', error);
                // Don't show error toast, upload was successful
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            UI.showToast('Failed to send message', 'error');
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check file size (50MB max)
        if (file.size > 50 * 1024 * 1024) {
            UI.showToast('File too large. Maximum size is 50MB', 'error');
            return;
        }

        this.selectedFile = file;

        // Show preview
        const preview = document.getElementById('file-preview');
        const fileName = document.getElementById('file-name');
        fileName.textContent = file.name;
        preview.style.display = 'flex';
    }

    clearFileSelection() {
        this.selectedFile = null;
        document.getElementById('file-input').value = '';
        document.getElementById('file-preview').style.display = 'none';
    }

    addMessageToUI(message) {
        if (!this.messages[this.activeConversation._id]) {
            this.messages[this.activeConversation._id] = [];
        }

        this.messages[this.activeConversation._id].push(message);
        this.renderMessages();
    }

    handleNewMessage(message) {
        console.log('New message received:', message);

        // Get conversation ID from message
        const conversationId = message.conversation._id || message.conversation;

        // Add to messages cache
        if (!this.messages[conversationId]) {
            this.messages[conversationId] = [];
        }

        // CRITICAL: Check if message already exists (avoid duplicates)
        const exists = this.messages[conversationId].some(m => m._id === message._id);

        console.log('Duplicate check:', {
            messageId: message._id,
            exists,
            currentCount: this.messages[conversationId].length
        });

        if (exists) {
            console.log('DUPLICATE DETECTED - Skipping message');
            return; // Exit early - don't process duplicate
        }

        // Add message to cache only if not duplicate
        this.messages[conversationId].push(message);

        // If this message is for the active conversation, display it
        if (this.activeConversation && this.activeConversation._id === conversationId) {
            this.addMessageToUI(message);

            // Auto-scroll to bottom
            const container = document.getElementById('messages-container');
            if (container) {
                setTimeout(() => {
                    container.scrollTop = container.scrollHeight;
                }, 100);
            }

            // Mark as read if it's from the other user
            if (message.sender._id !== this.currentUser.id) {
                socketManager.markAsRead(message._id);
            }
        } else {
            // Update conversation list to show new message
            this.loadConversations();
        }

        // Show toast for new messages from others
        if (message.sender._id !== this.currentUser.id) {
            const senderName = message.sender.username;
            UI.showToast(`New message from ${senderName}`, 'info');
        }

        // AUTOMATIC: Mark message as delivered if we're not the sender
        if (message.sender._id !== this.currentUser.id) {
            socketManager.markAsDelivered(message._id);
        }
    }

    updateMessageStatus(messageId, status) {
        console.log('Updating message status:', messageId, status);

        // Update message status in cache first
        for (let convId in this.messages) {
            const message = this.messages[convId].find(m => m._id === messageId);
            if (message) {
                if (status === 'delivered') {
                    message.isDelivered = true;
                    message.deliveredAt = Date.now();
                } else if (status === 'read') {
                    message.isRead = true;
                    message.readAt = Date.now();
                }
                break;
            }
        }

        // Update UI in real-time
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            const iconEl = messageEl.querySelector('.receipt-icon');
            if (iconEl) {
                // Remove all status classes
                iconEl.classList.remove('sent', 'delivered', 'read');

                // Add new status class and update icon
                if (status === 'read') {
                    iconEl.classList.add('read');
                    iconEl.textContent = '✓✓';
                } else if (status === 'delivered') {
                    iconEl.classList.add('delivered');
                    iconEl.textContent = '✓✓';
                }

                console.log('Receipt icon updated to:', status);
            }
        }
    }

    updateUserStatus(userId, isOnline) {
        // Update user status in users list
        const userItem = document.querySelector(`[data-user-id="${userId}"]`);
        if (userItem) {
            const statusEl = userItem.querySelector('.status');
            if (statusEl) {
                statusEl.textContent = isOnline ? 'Online' : 'Offline';
                statusEl.className = `status ${isOnline ? 'online' : 'offline'}`;
            }
        }

        // Update chat header if this is the active conversation user
        if (this.activeConversation) {
            const otherUser = this.activeConversation.participants.find(
                p => p._id === userId
            );
            if (otherUser) {
                const chatStatus = document.getElementById('chat-user-status');
                if (chatStatus) {
                    chatStatus.textContent = isOnline ? 'Online' : 'Offline';
                }
            }
        }
    }

    showAuthScreen() {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('chat-screen').style.display = 'none';
    }

    showChatScreen() {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'grid';
    }
}

// Global functions for inline event handlers
function switchTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabBtns = document.querySelectorAll('.tab-btn');

    if (tab === 'login') {
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
        tabBtns[0].classList.add('active');
        tabBtns[1].classList.remove('active');
    } else {
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
        tabBtns[1].classList.add('active');
        tabBtns[0].classList.remove('active');
    }
}

function toggleAuthForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    loginForm.classList.toggle('active');
    registerForm.classList.toggle('active');
}

function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    let overlay = document.querySelector('.sidebar-overlay');

    // Create overlay if it doesn't exist
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.onclick = toggleMobileMenu; // Close when clicking overlay
        document.body.appendChild(overlay);
    }

    // Toggle sidebar visibility using classes
    const isVisible = sidebar.classList.contains('mobile-show') ||
        !sidebar.classList.contains('mobile-hide');

    if (isVisible) {
        sidebar.classList.add('mobile-hide');
        sidebar.classList.remove('mobile-show');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    } else {
        sidebar.classList.add('mobile-show');
        sidebar.classList.remove('mobile-hide');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function clearFileSelection() {
    app.selectedFile = null;
    document.getElementById('file-input').value = '';
    document.getElementById('file-preview').style.display = 'none';
}

async function logout() {
    try {
        await api.logout();
        api.clearToken();
        socketManager.disconnect();

        UI.showToast('Logged out successfully', 'success');
        app.showAuthScreen();

        // Reset app state
        app.currentUser = null;
        app.allUsers = [];
        app.conversations = [];
        app.activeConversation = null;
        app.messages = {};
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// Initialize app when DOM is ready
const app = new ChatApp();
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
