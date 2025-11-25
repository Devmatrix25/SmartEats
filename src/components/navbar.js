// Reusable navbar component
class SmartEatsNavbar extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        const role = this.getAttribute('role') || 'customer';
        this.innerHTML = this.getNavbarHTML(role);
        this.attachEventListeners();
    }

    getNavbarHTML(role) {
        const baseNavbar = `
            <nav class="navbar navbar-expand-lg navbar-light bg-white sticky-top">
                <div class="container-fluid">
                    <a class="navbar-brand fw-bold" href="./${role}/index.html">
                        <i class="fas fa-utensils me-2"></i>SmartEats
                    </a>
                    
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarContent">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    
                    <div class="collapse navbar-collapse" id="navbarContent">
                        ${this.getNavItems(role)}
                        ${this.getNavControls(role)}
                    </div>
                </div>
            </nav>
        `;

        return baseNavbar;
    }

    getNavItems(role) {
        const navItems = {
            customer: `
                <ul class="navbar-nav me-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="./restaurants.html">
                            <i class="fas fa-store me-1"></i>Restaurants
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="./order-history.html">
                            <i class="fas fa-history me-1"></i>Orders
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="./support.html">
                            <i class="fas fa-headset me-1"></i>Support
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="./cart.html">
                            <i class="fas fa-shopping-cart me-1"></i>Cart
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="./track-order.html">
                            <i class="fas fa-truck me-1"></i>Track Order
                        </a>
                    </li>
                </ul>
            `,
            driver: `
                <ul class="navbar-nav me-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="./requests.html">
                            <i class="fas fa-bell me-1"></i>Requests
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="./navigation.html">
                            <i class="fas fa-map-marker-alt me-1"></i>Navigation
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="./earnings.html">
                            <i class="fas fa-rupee-sign me-1"></i>Earnings
                        </a>
                    </li>
                </ul>
            `,
            restaurant: `
                <ul class="navbar-nav me-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="./orders.html">
                            <i class="fas fa-list-alt me-1"></i>Orders
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="./menu.html">
                            <i class="fas fa-utensils me-1"></i>Menu
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="./sales.html">
                            <i class="fas fa-chart-bar me-1"></i>Analytics
                        </a>
                    </li>
                </ul>
            `,
            admin: `
                <ul class="navbar-nav me-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="./dashboard.html">
                            <i class="fas fa-tachometer-alt me-1"></i>Dashboard
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="./users.html">
                            <i class="fas fa-users me-1"></i>Users
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="./restaurants.html">
                            <i class="fas fa-store me-1"></i>Restaurants
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="./drivers.html">
                            <i class="fas fa-motorcycle me-1"></i>Drivers
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="./analytics.html">
                            <i class="fas fa-chart-line me-1"></i>Analytics
                        </a>
                    </li>
                </ul>
            `
        };

        return navItems[role] || '';
    }

    getNavControls(role) {
        return `
            <div class="d-flex align-items-center gap-3">
                <button class="btn btn-outline-secondary btn-sm theme-toggle" title="Toggle theme">
                    <i class="fas fa-moon"></i>
                </button>
                
                <div class="dropdown">
                    <button class="btn btn-outline-primary dropdown-toggle" type="button" 
                            data-bs-toggle="dropdown" id="userMenu">
                        <i class="fas fa-user me-1"></i>Account
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li class="guest-only">
                            <a class="dropdown-item" href="../${role}/index.html?auth=login">
                                <i class="fas fa-sign-in-alt me-2"></i>Login
                            </a>
                        </li>
                        <li class="guest-only">
                            <a class="dropdown-item" href="../${role}/index.html?auth=signup">
                                <i class="fas fa-user-plus me-2"></i>Sign Up
                            </a>
                        </li>
                        <li class="auth-only">
                            <a class="dropdown-item" href="../${role}/profile.html">
                                <i class="fas fa-user-circle me-2"></i>Profile
                            </a>
                        </li>
                        <li class="auth-only">
                            <hr class="dropdown-divider">
                        </li>
                        <li class="auth-only">
                            <a class="dropdown-item logout-btn" href="#">
                                <i class="fas fa-sign-out-alt me-2"></i>Logout
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        // Event listeners are handled by base.js
    }
}

customElements.define('smart-eats-navbar', SmartEatsNavbar);