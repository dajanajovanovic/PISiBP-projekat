# ProjectApp – Microservice Form Platform

A web application for creating, sharing, and analyzing online forms, built with React + Python (FastAPI) and a microservice architecture.
Each service runs independently and communicates via REST APIs.

## Architecture Overview

### Services:
The system is divided into multiple independent microservices, each with a specific responsibility:

auth-service – handles user registration, login, JWT authentication

forms-service – manages form CRUD, questions, collaborators

responses-service – stores user answers, aggregates data, exports XLSX

web-frontend – Vite + JS SPA for UI interaction

PostgreSQL databases – each service has its own DB

## Application Architecture Diagram

![Application Architecture](./appDiagram.png)

*Figure 1. Overview of the FormBuilder architecture: React frontend ↔ FastAPI microservices (auth, forms, responses); each service has its own DB; authentication via JWT.*


## Technologies Used

| Layer            | Technologies                    |
| :--------------- | :------------------------------ |
| Backend          | **Python (FastAPI)**            |
| Frontend         | **Vite + React**                |
| Databases        | **PostgreSQL**                  |
| ORM              | **SQLAlchemy**                  |
| Containerization | **Docker**, **Docker Compose**  |
| CI/CD            | **GitHub Actions**              |
| Testing          | **pytest**, **Playwright (UI)**,|
|                  | **Postman**                     |

## Application Workflow

1. User registers or logs in through **auth-service** (JWT token is generated).  
2. After login, user accesses the **frontend** interface to create new forms.  
3. **forms-service** stores form structure, questions, and collaborators.  
4. Other users or guests fill out the form through **responses-service**.  
5. Responses are stored and can be viewed or exported (e.g., to XLSX).  
6. Each service communicates through REST APIs using internal container network.

## Running the Project (Docker)

1. Build & start
```bash
docker compose build --no-cache
docker compose up -d
```
2. Access

| Component     | URL                                                      |
| :------------ | :------------------------------------------------------- |
| Frontend      | [http://localhost:5173](http://localhost:5173)           |
| Auth API      | [http://localhost:8001/docs](http://localhost:8001/docs) |
| Forms API     | [http://localhost:8002/docs](http://localhost:8002/docs) |
| Responses API | [http://localhost:8003/docs](http://localhost:8003/docs) |


## Environment Variables (.env)
```env
JWT_SECRET=devsecret123
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

AUTH_DB=postgresql+psycopg2://auth:auth@auth-db:5432/auth
FORMS_DB=postgresql+psycopg2://forms:forms@forms-db:5432/forms
RESP_DB=postgresql+psycopg2://resp:resp@responses-db:5432/resp

VITE_AUTH_API=http://auth-service:8000
VITE_FORMS_API=http://forms-service:8000
VITE_RESPONSES_API=http://responses-service:8000
VITE_AUTH_LOGIN_MODE=query
```
## Testing

Unit tests: cover user CRUD, form CRUD, and responses aggregation

Integration tests: cover UI registration, login, form search, and submission

Run tests manually or via Playwright (frontend).

## DevOps

All services containerized with Docker Compose

Each service has its own .dockerignore

Ready for future CI/CD pipeline (GitHub Actions / Jenkins)

Health endpoints for monitoring (/health)

## Folder Structure
```
.
├── services/
│   ├── auth-service/
│   ├── forms-service/
│   └── responses-service/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── Dockerfile
│
├── postman/
├── tests/
│
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

## Improvements and Future Work

- Add analytics dashboard for form response statistics.  
- Implement user roles and permissions per form.  
- Add e-mail notifications and password recovery.  
- Introduce caching and rate-limiting for API optimization. 

## Team Members
- Dajana Jovanović (649/2021)
- Andjela Stojadinović (610/2021)
- Sandra Antanasijević (612/2021)
- Nađa Ivanović (640/2021)

