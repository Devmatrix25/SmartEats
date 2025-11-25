// Authentication utilities for driver app
class AuthUtils {
    static getToken() {
        return localStorage.getItem('driverToken');
    }

    static setToken(token) {
        localStorage.setItem('driverToken', token);
    }

    static removeToken() {
        localStorage.removeItem('driverToken');
    }

    static isAuthenticated() {
        const token = this.getToken();
        if (!token) return false;

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp > Date.now() / 1000;
        } catch (error) {
            return false;
        }
    }

    static getDriverId() {
        const token = this.getToken();
        if (!token) return null;

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.userId;
        } catch (error) {
            return null;
        }
    }
}