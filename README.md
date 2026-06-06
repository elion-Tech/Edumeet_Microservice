# Edumeet Microservice

This microservice serves as the backbone for the Edumeet platform. it manages the persistent data, user authentication, and coordinates the educational logic required to power the AI-enhanced curriculum.

## 🏗️ Architecture & Responsibilities

- **User Management**: Handles authentication and role-based access control (RBAC) for Students, Tutors, and Admins.
- **Course Engine**: Manages the storage and retrieval of multi-segment course architectures, including video metadata and transcripts.
- **Assessment Protocol**: Stores quiz results and manages the grading workflow for Capstone projects.
- **Notification System**: Handles system announcements, grade alerts, and broadcast messages from tutors to students.
- **Live Coordination**: API endpoints to schedule and broadcast live meeting links (Google Meet/Zoom).

## 🛡️ Security & Performance

- **Helmet**: Implements secure HTTP headers to protect against common web vulnerabilities.
- **Exponential Backoff**: Integrated retry logic for AI services to handle rate limits (429) and resource exhaustion gracefully.
- **Data Privacy**: Secure handling of user credentials and enrollment records.

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **CLI Utilities**: Commander.js
- **Configuration**: Dotenv

## ⚙️ Deployment & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Configuration**:
   Configure your `.env` file with MongoDB connection strings and API secrets.
3. **Starting the Service**:
   ```bash
   npm start
   ```
4. **Health Check**:
   The service includes a `/health` endpoint accessible via the Admin Dashboard to verify database connectivity and environment status.

## 🌐 API Integration

The frontend communicates with this service via the `apiService.ts` layer. Ensure `VITE_API_URL` on the client points to the active instance of this microservice.

---
© 2024 Edumeet Inc. Production-grade educational infrastructure.