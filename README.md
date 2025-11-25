# SmartEats - On-Demand Food Delivery Platform 🚀

<div align="center">

![DevMatrix Logo](https://img.shields.io/badge/DEVMATRIX-SmartEats-00ff6a?style=for-the-badge&logo=matrix&logoColor=white)
![MERN Stack](https://img.shields.io/badge/MERN-FullStack-00ff6a?style=flat-square&logo=mongodb&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-00ff6a?style=flat-square&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-Frontend-00ff6a?style=flat-square&logo=react&logoColor=white)

*A next-generation food delivery platform connecting customers, restaurants, and delivery partners in real-time*

[![Project Status](https://img.shields.io/badge/Status-In%20Development-00ff6a?style=flat-square)]()
[![Team Size](https://img.shields.io/badge/Team-5%20Members-00ff6a?style=flat-square)]()
[![Mentor](https://img.shields.io/badge/Mentor-G.%20Swetha%20Goud-00ff6a?style=flat-square)]()

</div>

## 📋 Project Overview

**SmartEats** is an advanced On-Demand Food Delivery Platform developed using the **MERN stack** (MongoDB, Express.js, React.js, Node.js), designed to seamlessly connect customers, restaurants, and delivery partners through a unified, interactive ecosystem. The platform addresses the growing need for efficient and intelligent food delivery systems capable of handling large-scale, real-time operations in today's digitally transforming food service industry.

### 🎯 Problem Statement

> The rapid digital transformation in the food service industry has increased the need for efficient and intelligent food delivery systems capable of handling large-scale, real-time operations. SmartEats provides a robust, fault-tolerant, and performance-oriented architecture that enhances user experience, optimizes system efficiency, and ensures real-time responsiveness.

## 🏗️ System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌────────────────────┐
│  React Frontend │    │  Node.js/Express │    │  MongoDB Database  │
│                 │    │     API Layer    │    │                    │
└─────────────────┘    └──────────────────┘    └────────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
         ┌───────▼───────┐ ┌─────▼─────┐ ┌───────▼───────┐
         │   Redis       │ │  RabbitMQ │ │   Celery      │
         │  Caching &    │ │ Message   │ │  Async Tasks  │
         │ Session Mgmt  │ │  Broker   │ │   (Python)    │
         └───────────────┘ └───────────┘ └───────────────┘
                 │                       │
         ┌───────▼───────┐       ┌───────▼───────┐
         │  Prometheus   │       │   Logstash    │
         │  Monitoring   │       │   Logging &   │
         │   & Metrics   │       │   Analytics   │
         └───────────────┘       └───────────────┘
```

## 🛠️ Tech Stack

### Core Technologies
- **Frontend**: React.js, HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)

### Advanced Infrastructure
- **Caching & Session Management**: Redis
- **Message Broker**: RabbitMQ
- **Asynchronous Task Processing**: Celery (Python)
- **Containerization**: Docker
- **Web Server**: Nginx

### Monitoring & Observability
- **Metrics Collection**: Prometheus
- **Centralized Logging**: Logstash (ELK Stack)
- **Visualization & Dashboards**: Grafana

### Optional Enhancements
- **Microservices**: FastAPI
- **Real-time Communication**: WebSockets
- **Data Collection**: Web Scraping
- **Advanced Search**: Elasticsearch

## 👥 Team DevMatrix

| Role | Member | ID | Responsibilities |
|------|--------|----|------------------|
| **Backend & Deployment Lead** | TIRUKOTI VINAY | 24BD1A059R | Server architecture, API development, deployment strategies |
| **Frontend React Developer** | PAGIDIPALLI SUNNY KIRAN | 24BD1A059B | UI components, user experience, React implementation |
| **UI/UX + API Research Lead** | CHAKRAPANDA SATHWIK | 24BD1A058D | Interface design, user research, API integration |
| **MongoDB, Redis & Monitoring Engineer** | CILIVERU MANIMUKTESH | 24BD1A058J | Background jobs, task queues, asynchronous operations |
| **Celery / Async Processing Engineer** | RENTALA RISHEETH PREETHAM | 24BD1A059G | Database design, caching strategies, system monitoring |

### 👨‍🏫 Project Mentor
**G. Swetha Goud** - Project Guide & Mentor

## 🚀 Key Features

### 🎯 Core Functionality
- **Real-time Order Management**: Live tracking from order placement to delivery
- **Intelligent Restaurant Matching**: Smart algorithm for optimal restaurant-customer pairing
- **Dynamic Menu Management**: Real-time menu updates and availability
- **Secure Payment Processing**: Integrated payment gateway with JWT security

### ⚡ Performance Optimizations
- **High-Speed Caching**: Redis for session management and quick data retrieval
- **Asynchronous Processing**: Celery for background tasks (notifications, order processing)
- **Load Balancing**: Nginx for efficient request distribution
- **Containerized Deployment**: Docker for consistent environments

### 🔍 Observability & Monitoring
- **Real-time Metrics**: Prometheus for performance monitoring
- **Centralized Logging**: Logstash for system-wide log aggregation
- **Visual Dashboards**: Grafana for operational insights
- **Alerting Mechanisms**: Proactive system health notifications

## 📁 Project Structure

```
SmartEats/
│
│── src/
│ ├── base.css
│ ├── base.js
│ ├── components/ # Reusable UI components
│ └── utils/ # Utility functions
│
├── Users/
│ ├── index.html # Onboarding / Auth
│ ├── products.html # Restaurant menu
│ ├── cart.html # Cart + Checkout
│ ├── order-history.html # Past orders
│ ├── track-order.html # Real-time Order tracking (map + ETA)
│ ├── support.html # User Support
│ ├── profile.html # Profile + Wallet + History
│
├── Restaurants/
│ ├── index.html # Login/Signup
│ ├── menu.html # Menu management
│ ├── orders.html # Incoming order queue
│ ├── sales.html # Sales dashboard
│ ├── support.html # Restaurant Support
│ ├── profile.html # Profile + Earnings + Sales History
│
├── Drivers/
│ ├── index.html # Auth + KYC
│ ├── requests.html # Incoming requests (accept/reject)
│ ├── navigation.html # Navigation (map + pick/deliver buttons)
│ ├── support.html # Driver Support
│ ├── profile.html # Profile + Earnings + Delivery History
│ ├── earnings.html # Earnings dashboard
│
├── backend/ # Node.js/Express API
│ ├── package.json
│ ├── .env
│ ├── server.js
│ ├── controllers/ # Route controllers
│ ├── models/ # Database models
│ ├── middleware/ # Custom middleware
│ ├── routes/ # API routes
│ └── config/ # Config files
│
├── celery-workers/ # Python Celery workers (optional)
│ ├── tasks/ # Async task definitions
│ └── config/ # Celery configuration
│
├── monitoring/ # Observability setup
│ ├── prometheus/ # Metrics configuration
│ ├── grafana/ # Dashboard definitions
│ └── logstash/ # Log processing pipelines
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v5 or higher)
- Redis (v6 or higher)
- Python (v3.8 or higher)
- Docker & Docker Compose

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/devmatrix/SmartEats.git
   cd SmartEats
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Configure environment variables
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # Configure environment variables
   npm start
   ```

4. **Celery Workers**
   ```bash
   cd celery-workers
   pip install -r requirements.txt
   celery -A tasks worker --loglevel=info
   ```

5. **Docker Deployment**
   ```bash
   docker-compose up -d
   ```

## 🔧 Configuration

### Environment Variables
```env
# Database
MONGODB_URI=mongodb+srv://devmatrixteam25_db_user:<db_password>@smarteats25.lici3we.mongodb.net/?appName=SmartEats25
REDIS_URL=redis-18658.c283.us-east-1-4.ec2.cloud.redislabs.com:18658

# JWT Authentication
JWT_SECRET=2e75add36fab6e871007d9df9bfb996e3125bce61d35bb740d594a8cfca5411499db1119fa75875d4128307207ff9f85e7802973c6848635ca56a2668a7f3680
JWT_EXPIRES_IN=3d

# Message Broker
RABBITMQ_URL=amqps://dmulwxje:<RB_password>@puffin.rmq2.cloudamqp.com/dmulwxje

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
```

## 📊 Monitoring & Metrics

The platform includes comprehensive monitoring:

- **API Response Times**: Track endpoint performance
- **Database Query Performance**: Monitor MongoDB operations
- **Cache Hit Rates**: Redis efficiency metrics
- **Queue Depth**: RabbitMQ message processing
- **System Resources**: CPU, memory, and network usage

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.

## 🏆 Acknowledgments

- **G. Swetha Goud** for mentorship and guidance
- **DevMatrix Team** for collaborative development
- **MERN Stack Community** for excellent documentation and support
- **Open Source Contributors** whose libraries power our platform

---

<div align="center">

**Built with 💚 by Team DevMatrix**

*Transforming food delivery through cutting-edge technology*

[📧 Contact Us](mailto:devmatrixteam25@gmail.com) | [🐛 Report Bug](https://github.com/devmatrix25/SmartEats/issues) | [💡 Request Feature](https://github.com/devmatrix25/SmartEats/issues)

</div>
