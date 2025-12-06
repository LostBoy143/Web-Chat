// UI Helper Functions
class UI {
    static showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    static showError(message) {
        const errorDiv = document.getElementById('auth-error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';

        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    static getInitials(name) {
        if (!name || typeof name !== 'string') {
            return 'U'; // Default to 'U' for User
        }
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    static formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }

    static formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static renderUserItem(user, onClick) {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.dataset.userId = user._id || user.id;

        const initials = this.getInitials(user.username);
        const statusClass = user.isOnline ? 'online' : 'offline';

        div.innerHTML = `
            <div class="avatar">${initials}</div>
            <div class="user-details">
                <h5>${user.username}</h5>
                <p class="status ${statusClass}">${user.isOnline ? 'Online' : 'Offline'}</p>
            </div>
        `;

        div.onclick = () => onClick(user);
        return div;
    }

    static renderConversationItem(conversation, onClick) {
        const div = document.createElement('div');
        div.className = 'conversation-item';
        div.dataset.conversationId = conversation._id;

        // Get the other participant
        const otherUser = conversation.participants.find(
            p => p._id !== app.currentUser.id
        );

        if (!otherUser) return div;

        const initials = this.getInitials(otherUser.username);
        const lastMessage = conversation.lastMessage?.content || 'No messages yet';
        const time = conversation.updatedAt ? this.formatTime(conversation.updatedAt) : '';

        div.innerHTML = `
            <div class="avatar">${initials}</div>
            <div class="user-details">
                <h5>${otherUser.username}</h5>
                <p>${lastMessage.substring(0, 30)}${lastMessage.length > 30 ? '...' : ''}</p>
            </div>
            <span class="message-time">${time}</span>
        `;

        div.onclick = () => onClick(conversation);
        return div;
    }

    static renderMessage(message, currentUserId) {
        const isSent = message.sender._id === currentUserId || message.sender.id === currentUserId;
        const div = document.createElement('div');
        div.className = `message ${isSent ? 'sent' : 'received'}`;
        div.dataset.messageId = message._id;

        const initials = this.getInitials(message.sender.username);
        const time = this.formatDateTime(message.createdAt);

        let contentHTML = '';

        if (message.messageType === 'text') {
            contentHTML = `<div class="message-bubble">${message.content}</div>`;
        } else if (message.messageType === 'image') {
            contentHTML = `
                <div class="message-media">
                    <img src="${message.content}" alt="Image" loading="lazy">
                </div>
            `;
        } else if (message.messageType === 'video') {
            contentHTML = `
                <div class="message-media">
                    <video src="${message.content}" controls></video>
                </div>
            `;
        } else if (message.messageType === 'document') {
            const fileName = message.fileMetadata?.fileName || 'Document';
            contentHTML = `
                <div class="message-document">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                        <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                    <a href="${message.content}" target="_blank">${fileName}</a>
                </div>
            `;
        }

        // WhatsApp-style read receipt status icons (only for sent messages)
        let statusHTML = '';
        if (isSent && message.isRead) {
            // Double blue checkmark - Read
            statusHTML = '<span class="receipt-icon read">✓✓</span>';
        } else if (isSent && message.isDelivered) {
            // Double gray checkmark - Delivered
            statusHTML = '<span class="receipt-icon delivered">✓✓</span>';
        } else if (isSent) {
            // Single gray checkmark - Sent
            statusHTML = '<span class="receipt-icon sent">✓</span>';
        }

        div.innerHTML = `
            ${!isSent ? `<div class="avatar">${initials}</div>` : ''}
            <div class="message-content">
                ${contentHTML}
                <span class="message-time">${statusHTML}${time}</span>
            </div>
            ${isSent ? `<div class="avatar">${initials}</div>` : ''}
        `;

        return div;
    }

    static showTypingIndicator(username) {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.style.display = 'inline';
        }
    }

    static hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    static updateChatHeader(user) {
        const avatar = document.getElementById('chat-user-avatar');
        const username = document.getElementById('chat-username');
        const status = document.getElementById('chat-user-status');

        if (avatar) avatar.textContent = this.getInitials(user.username);
        if (username) username.textContent = user.username;
        if (status) {
            status.textContent = user.isOnline ? 'Online' : 'Offline';
            status.className = `user-status ${user.isOnline ? 'online' : ''}`;
        }
    }

    static scrollToBottom(container) {
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    static setActiveConversation(conversationId) {
        // Remove active class from all conversations
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to selected conversation
        const activeItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    static setActiveUser(userId) {
        // Remove active class from all users
        document.querySelectorAll('.user-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to selected user
        const activeItem = document.querySelector(`[data-user-id="${userId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }
}
