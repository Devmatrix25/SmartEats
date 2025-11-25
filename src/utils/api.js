// API utility functions
async function apiCall(endpoint, method = 'GET', data = null) {
    const token = AuthUtils.getToken();
    const headers = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`http://localhost:3000${endpoint}`, config);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'API request failed');
        }

        return {
            success: true,
            data: result
        };
    } catch (error) {
        console.error('API call error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Socket.io connection helper
function connectSocket() {
    const token = AuthUtils.getToken();
    return io({
        auth: {
            token: token
        }
    });
}