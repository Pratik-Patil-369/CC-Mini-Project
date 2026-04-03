# CodeForge — Cloud Computing Mini Project ☁️⚡

**CodeForge** is a high-performance, secure, and scalable cloud-based code execution platform. It allows users to write, run, and submit code in multiple programming languages, with each execution isolated inside a **hardened Docker container** to ensure security and resource management.

---

## 🚀 Key Features

- **Multi-Language Support**: Seamless execution for **Python 3, C++ (GCC), Java 17, and Node.js**.
- **Docker-Sourced Sandboxing**: 
  - 🚫 **No Network Access**: Containers are isolated from the internet (`--network=none`).
  - 🧠 **Resource Capping**: Limits on RAM (128MB) and CPU (0.5 cores).
  - ⏱️ **Auto-Termination**: Strict 15-second execution timeouts.
- **Judge Engine**: Compares user output against hidden test cases with normalized result detection.
- **Persistent History**: Integrated **SQLite** database to track student/user submission history and pass rates.
- **LeetCode-Style UX**: Modern, resizable IDE using **Monaco Editor** and **shadcn/ui**.
- **Cloud-Ready Architecture**: Designed for containerized deployment via **AWS EC2** and **Docker Hub**.

---

## 🛠️ Tech Stack

### Frontend
- **React 19** + **Vite 8**
- **Tailwind CSS v4** + **shadcn/ui**
- **Monaco Editor** (The engine behind VS Code)
- **Lucide Icons**

### Backend
- **Node.js** + **Express 5**
- **SQLite** (via `better-sqlite3`)
- **Docker-in-Docker** (Dynamic container orchestration)

### Infrastructure
- **AWS EC2** (Hosting)
- **Docker Hub** (Container Registry)

---

## 📂 Project Structure

```
code-executor/
├── server/                 # Express backend orchestration
│   ├── server.js           # Core Judge Engine & API
│   ├── problems.json       # Problem bank with test cases
│   └── submissions.db      # SQLite persistent storage
├── client/                 # React frontend SPA
│   ├── src/pages/          # Problem Catalog & IDE Solver
│   └── src/components/     # Reusable UI hooks & components
├── Dockerfile              # Multi-stage production build
├── docker-compose.yml      # Local orchestration
└── README.md               # Main Documentation
```

---

## ☁️ Deployment (AWS EC2)

The project is designed to be deployed as a containerized service.

1. **Build and Tag**:
   ```bash
   docker build -t pratikpatil369/codeforge:latest .
   ```
2. **Push to Registry**:
   ```bash
   docker push pratikpatil369/codeforge:latest
   ```
3. **Run on EC2**:
   ```bash
   docker run -d -p 3000:3000 \
     -v /var/run/docker.sock:/var/run/docker.sock \
     -v /tmp/codeforge-temp:/app/server/temp \
     -e HOST_TEMP_DIR=/tmp/codeforge-temp \
     --restart unless-stopped \
     pratikpatil369/codeforge:latest
   ```

---

## 📖 Local Setup

1. **Install Dependencies**: `npm run install:all`
2. **Start Development**:
   - Backend: `npm run dev:server`
   - Frontend: `npm run dev:client`
3. **Visit**: `http://localhost:5173` (Dev) or `http://localhost:3000` (Prod mode)
