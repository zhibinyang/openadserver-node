
<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" alt="NestJS Logo" width="100"/>
  <span style="font-size: 80px; vertical-align: middle; margin: 0 20px;">+</span>
  <img src="docs/assets/logo.svg" alt="OpenAdServer" width="300" onerror="this.src='https://via.placeholder.com/300x80?text=OpenAdServer'"/>
</p>

<!-- Note: For local development, if docs/assets/logo.svg is missing, it will fallback or break. Assuming relative path is maintained or similar logo used. -->

<h1 align="center">OpenAdServer (Node.js Edition)</h1>

<p align="center">
  <strong>High-Performance Ad Serving Engine built with NestJS & Fastify</strong><br>
  <em>The next-generation, ultra-fast serving layer for OpenAdServer</em>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-stack">Tech Stack</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D20-green.svg" alt="Node.js 20+"/>
  <img src="https://img.shields.io/badge/framework-NestJS-red.svg" alt="NestJS"/>
  <img src="https://img.shields.io/badge/adapter-Fastify-black.svg" alt="Fastify"/>
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License"/>
</p>

---

## ⚡ Introduction

**OpenAdServer Node** is a rewrite of the serving layer of OpenAdServer, migrated from Python (FastAPI) to **Node.js (NestJS + Fastify)**. 

While the original Python version excels at Data Science and Model Training integrations, this Node.js version is engineered for **pure serving performance**, concurrency, and scalability. It maintains the exact same **5-step Recommendation Pipeline** logic but optimizes it for the V8 engine's asynchronous I/O capabilities.

> **Note:** This project is strictly for the **Serving Engine**. Model training (DeepFM/LR) is still handled by the Python ecosystem, communicating via ONNX or shared storage/DB.

## ✨ Features

### 🚀 High-Performance Serving
- **NestJS + Fastify**: Built on one of the fastest Node.js web frameworks, offering lower overhead than Express.
- **Asynchronous Pipeline**: Fully non-blocking I/O for database and Redis lookups.
- **In-Memory Caching**: Active campaigns and creatives are pre-loaded into hot memory (`Map`) for O(1) retrieval, eliminating DB hits during the critical path.

### 🧠 The 5-Step Pipeline
1.  **Retrieval**: Selects candidates based on Targeting Rules (Geo, OS, Device).
2.  **Filter**: Enforces **Budget** (Redis) and **Frequency Capping** (Redis) in real-time.
3.  **Prediction**: Integration point for CTR/CVR prediction (Statistical or ONNX).
4.  **Ranking**: Calculates **eCPM** (Bid * pCTR * 1000) to maximize revenue.
5.  **Rerank**: Improves result quality with Diversity rules (e.g., max 2 ads per advertiser).

### 🛠 Modern Engineering
- **TypeScript**: Full type safety from Database to API DTOs.
- **Drizzle ORM**: Lightweight, SQL-like, type-safe database access.
- **Modular Architecture**: Clean separation of concerns (Engine, Tracking, Shared resources).

---

## 🏗️ Architecture

```mermaid
graph LR
    User[Client / Device] -->|POST /ad/get| API[Fastify Controller]
    User -->|GET /track| Track[Tracking Controller]
    
    subgraph "Ad Engine (NestJS)"
        API --> Engine[AdEngine Service]
        Engine --> Step1[1. Retrieval]
        Engine --> Step2[2. Filter]
        Engine --> Step3[3. Prediction]
        Engine --> Step4[4. Ranking]
        Engine --> Step5[5. Rerank]
        
        Step1 --> Cache[In-Memory Cache]
        Step2 --> Redis[Redis Checks]
    end
    
    subgraph "Data Store"
        Redis -->|Freq / Budget| RedisStore[(Redis)]
        Cache -->|Refresh 1m| DB[(PostgreSQL)]
        Track -->|Insert| DB
        Track -->|Incr| RedisStore
    end
```

---

## 🛠 Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Framework** | **NestJS** | Structured, scalable, enterprise-grade DI/Module system. |
| **Web Adapter** | **Fastify** | High throughput, low overhead HTTP processing. |
| **Language** | **TypeScript** | Type safety, reliability, and better developer experience. |
| **Database ORM** | **Drizzle** | Best-in-class TypeScript ORM, no runtime overhead like TypeORM/Prisma. |
| **Cache/KV** | **Redis (ioredis)** | Real-time counters for frequency capping and budgeting. |
| **Database** | **PostgreSQL** | Relational data for campaigns, users, and reporting. |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL
- Redis

### 1. Installation

```bash
git clone <repo-url>
cd openadserver-node
npm install
```

### 2. Environment Setup

Create `.env` file:
```bash
cp .env.example .env
```
Edit `.env` and set your `DATABASE_URL` and `REDIS_HOST`.

### 3. Database Initialization

This command will:
1.  Push the schema to your database (using `drizzle-kit push --force`).
2.  Seed the database with test data (Advertisers, Campaigns, Creatives).

```bash
npm run init:db
```

> **Note:** Ensure your `.env` points to a valid database (e.g., `postgres://user:password@localhost:5432/oas`).

### 4. Running the Server

```bash
# Development mode
npm run start:dev

# Production build
npm run build
npm run start:prod
```

### 5. Verification

**Get an Ad:**
```bash
curl -X POST http://localhost:3000/ad/get \
  -H "Content-Type: application/json" \
  -d '{
    "slot_id": "home_banner",
    "user_id": "test_user_1",
    "os": "ios",
    "country": "US"
  }'
```

**Debug Database State:**
```bash
npx ts-node scripts/debug-db.ts
```

---

## 📁 Project Structure

```
src/
├── database/           # Drizzle schema & connection
├── modules/
│   ├── engine/         # Core Ad Serving Logic
│   │   ├── pipeline/   # The 5 Steps (Retrieval...Rerank)
│   │   ├── services/   # CacheService, TargetingMatcher
│   │   └── dto/        # Request/Response DTOs
│   └── tracking/       # Pixel & Event Tracking
└── shared/
    ├── redis/          # Redis Client wrapper
    └── types.ts        # Shared Enums & Interfaces
```

---

## 🤝 Contributing

This node version aims to keep parity with the main Python repo logic-wise unless specific performance optimizations dictate otherwise. Please match the Python implementation's intent when porting features.

### License

Apache License 2.0 (Same as original OpenAdServer)
