# Contributing to SmartEats – On-Demand Food Delivery Application

Welcome to the codebase for **SmartEats**, an advanced on-demand food delivery application built and maintained by the **DevMatrix Team**. This repository contains all source code, modules, and supporting documentation for SmartEats.

---

## Introduction

SmartEats is a scalable, full-stack food delivery solution enabling users to order meals from local restaurants quickly and reliably. The platform utilizes Node.js (Express) for the backend, React.js for the frontend, MongoDB for database management, and Celery for background task orchestration.

This repository powers the SmartEats platform, and its content is managed exclusively by the DevMatrix Team.

---

## Who Can Contribute

Only the following **5 official DevMatrix Team members** are authorized to contribute code, push commits, create branches, or merge pull requests:

- **Vinay**
- **Sunny Kiran**
- **Sathwik**
- **Manimukthesh**
- **Risheeth Preetham**

**External contributors** may:
- Open issues
- Submit feature requests or bug reports

_External users **cannot** push code, create branches, or open pull requests._

---

## Repository Rules

### Branch Strategy

- **main** (`protected`)
  - Serves as the stable release branch.
  - All merges require pull requests and at least one team member review.
  - _Direct pushes are not permitted._

- **dev**
  - Active development branch.
  - All new work and PRs should target this branch.

- **feature/** or **bugfix/**
  - All features and fixes must be developed on separate branches named by convention:
    - `feature/<feature-name>`
    - `bugfix/<issue-id>-<short-desc>`

### Permissions

- Only authorized team members can:
  - Commit
  - Create/merge pull requests
  - Push changes
  - Create/delete branches

---

## Commit Rules

- **Team members only** may commit.
- Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format:
  - `feat:` - New feature
  - `fix:` - Bug fix
  - `docs:` - Documentation changes
  - `style:` - Code style, format
  - `refactor:` - Non-functional code changes
  - `test:` - Add/modify tests
  - `chore:` - Misc changes

**Example commit message:**
```
feat: add user profile update API
```

---

## Pull Request Workflow

- **Only team members** may open and merge pull requests.
- **Review required:** PRs must be reviewed by _at least one other_ team member before merging.
- All PRs should:
  - Provide a clear summary of changes
  - Reference related issues (if applicable)
  - Pass all CI checks

### Steps for Opening a PR:

1. Create a feature/bugfix branch from `dev`.
2. Commit your changes (Conventional Commits).
3. Push the branch to GitHub.
4. Open a pull request targeting `dev` (or `main` for critical releases).
5. Request review from at least one teammate.
6. Merge once approved.

---

## Local Setup Guide

### 1. Clone the Repository

```bash
git clone https://github.com/Devmatrix25/SmartEats.git
cd SmartEats
```

### 2. Install Dependencies

- **Backend** (`Node.js/Express`)
  ```bash
  cd backend
  npm install
  ```

- **Frontend** (`React.js`)
  ```bash
  cd ../frontend
  npm install
  ```

- **Celery Worker**
  ```bash
  cd ../worker
  pip install -r requirements.txt
  ```

### 3. Configure Environment Variables

Provide a `.env` file in each service, based on `.env.example`.

Example:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp worker/.env.example worker/.env
```

Edit the `.env` files with actual secrets and credentials.

### 4. Run the Application

- **Backend API Server:**
  ```bash
  cd backend
  npm start
  ```

- **Frontend (React):**
  ```bash
  cd frontend
  npm start
  ```

- **Celery Worker:**
  ```bash
  cd worker
  celery -A tasks worker --loglevel=info
  ```

---

## Environment Variables

Each service provides a `.env.example` file. Copy this template and fill in actual values.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp worker/.env.example worker/.env
```

**Never commit real secrets or credentials!**

---

## Coding Standards

- **Backend (Node.js + Express):**
  - Use Express Router for API endpoints.
  - Keep middleware modular.
  - Validate all inputs.
  - Follow RESTful API design principles.
- **Frontend (React.js):**
  - Functional components and hooks preferred.
  - Consistent naming and file structure.
  - Smart/dumb component separation.
- **Database (MongoDB):**
  - Use Mongoose schemas.
  - Proper validation and indexing.
  - Keep model files organized in `/models`.
- **Celery Task Structure:**
  - Modularize tasks in `/tasks`.
  - Ensure idempotency for retryable tasks.
  - Use descriptive names for task functions.

---

## Issue Reporting

- **External users** may open issues or suggestions for:
  - Bug reports
  - Feature requests
  - Documentation improvement

Please use the issue template and provide:
- Step-by-step reproduction (if a bug)
- Screenshots/logs (optional)
- Suggested solutions (if applicable)

---

## Contact

For general questions, partnership inquiries, or support:

**Official Team Email:**  
[devmatrixteam25@gmail.com](mailto:devmatrixteam25@gmail.com)

---

Thank you for supporting SmartEats and the DevMatrix Team!
