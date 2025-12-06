// Socket.io Connection Manager
class SocketManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.currentConversationId = null;
    }

    connect(token) {
        if (this.socket) {
            this.disconnect();
        }

        this.socket = io('http://localhost:5000', {
            auth: { token },
            transports: ['polling', 'websocket'],
            withCredentials: false,
        });

        this.socket.on('connect', () => {
            this.connected = true;
            console.log('Socket connected');
            UI.showToast('Connected to chat server', 'success');
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            console.log('Socket disconnected');
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            UI.showToast('Connection error', 'error');
        });

        // Listen for new messages
        this.socket.on('new_message', (message) => {
            console.log('New message received:', message);
            app.handleNewMessage(message);
        });

        // Listen for message sent confirmation
        this.socket.on('message_sent', (data) => {
            console.log('Message sent:', data);
        });

        // Listen for delivery receipts
        this.socket.on('message_delivered', (data) => {
            console.log('Message delivered:', data);
            app.updateMessageStatus(data.messageId, 'delivered');
        });

        // Listen for read receipts
        this.socket.on('message_read', (data) => {
            console.log('Message read:', data);
            app.updateMessageStatus(data.messageId, 'read');
        });

        // Listen for typing indicators
        this.socket.on('user_typing', (data) => {
            console.log('User typing:', data);
            UI.showTypingIndicator(data.username);
        });

        this.socket.on('user_stop_typing', (data) => {
            console.log('User stopped typing');
            UI.hideTypingIndicator();
        });

        // Listen for online/offline status
        this.socket.on('user_online', (data) => {
            console.log('User online:', data);
            app.updateUserStatus(data.userId, true);
        });

        this.socket.on('user_offline', (data) => {
            console.log('User offline:', data);
            app.updateUserStatus(data.userId, false);
        });

        this.socket.on('joined_conversation', (data) => {
            console.log('Joined conversation:', data);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
        }
    }

    joinConversation(conversationId) {
        if (!this.socket || !this.connected) {
            console.error('Socket not connected');
            return;
        }

        this.currentConversationId = conversationId;
        this.socket.emit('join_conversation', conversationId);
    }

    leaveConversation(conversationId) {
        if (!this.socket || !this.connected) return;

        this.socket.emit('leave_conversation', conversationId);
        this.currentConversationId = null;
    }

    sendMessage(conversationId, content, tempId = null) {
        if (!this.socket || !this.connected) {
            console.error('Socket not connected');
            return;
        }

        this.socket.emit('send_message', {
            conversationId,
            content,
            tempId: tempId || Date.now()
        });
    }

    sendTyping(conversationId) {
        if (!this.socket || !this.connected) return;

        this.socket.emit('typing', { conversationId });
    }

    sendStopTyping(conversationId) {
        if (!this.socket || !this.connected) return;

        this.socket.emit('stop_typing', { conversationId });
    }

    markAsRead(messageId) {
        if (!this.socket || !this.connected) return;

        this.socket.emit('message_read', { messageId });
    }

    markAsDelivered(messageId) {
        if (!this.socket || !this.connected) return;

        this.socket.emit('message_delivered', { messageId });
    }
}

// Export socket instance
const socketManager = new SocketManager();
