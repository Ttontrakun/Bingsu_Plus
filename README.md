# บิงซูบอท พลัส (Bingsu Plus)

ระบบ RAG Chatbot สำหรับสร้างบอทจากชุดความรู้ (Knowledge) รองรับการอัปโหลดเอกสาร, Embedding, และแชทกับ AI

---

## สารบัญ

- [Quick start — หลัง git clone รันด้วย Docker](#quick-start--หลัง-git-clone-รันด้วย-docker)
- [ภาพรวมระบบ](#ภาพรวมระบบ)
- [สิ่งที่ต้องมีก่อนติดตั้ง](#สิ่งที่ต้องมีก่อนติดตั้ง)
- [การติดตั้งตั้งแต่ต้น (หลัง Git Clone)](#การติดตั้งตั้งแต่ต้น-หลัง-git-clone)
- [การรันในโหมดพัฒนา](#การรันในโหมดพัฒนา)
- [การรันทั้ง stack ด้วย Docker Compose](#การรันทั้ง-stack-ด้วย-docker-compose-คำสั่งเดียว)
- [การ Deploy แบบ Production (Docker)](#การ-deploy-แบบ-production-docker)
- [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์)
- [แก้ปัญหาเบื้องต้น](#แก้ปัญหาเบื้องต้น)

---

## Quick start — หลัง git clone รันด้วย Docker

สมมติเพิ่ง `git clone` มา และมี **Docker Desktop** (หรือ Docker Engine) ติดตั้งแล้ว ทำแค่ 3 ขั้น:

**1. เข้าโฟลเดอร์โปรเจกต์**

```bash
cd bingsu_plus
```

(ถ้าโคลนทั้ง repo `ask_AA` จะอยู่ที่ `ask_AA/bingsu_plus` → ใช้ `cd ask_AA/bingsu_plus`)

**2. สร้างไฟล์ env สำหรับ Backend**

```powershell
# Windows
copy askaa_backend\env.sample askaa_backend\.env
```

```bash
# macOS / Linux
cp askaa_backend/env.sample askaa_backend/.env
```

แล้วเปิด `askaa_backend/.env` ใส่ค่าที่จำเป็น เช่น `OPENAI_API_KEY` หรือ `GEMINI_API_KEY` (ตามที่ใช้แชท/embedding) — ค่าอื่นใช้จาก sample ได้ก่อน

**3. รันทั้ง stack**

```bash
docker compose up -d --build
```

รอ build และรันครั้งแรกสักครู่ แล้วเปิดเบราว์เซอร์ที่ **http://localhost**

- ปิด stack: `docker compose down`
- ดู log: `docker compose logs -f`

ถ้ายังไม่มี user ให้ seed ก่อน (รันคำสั่งใน container):

```bash
docker compose exec legacy node server/scripts/seed-admins.js
docker compose exec legacy node server/scripts/seed-help-bot.js
```

จากนั้นล็อกอินด้วยบัญชีที่ seed (เช่น `admin@admin.com` ตามที่ตั้งใน seed)

---

## ภาพรวมระบบ

| ส่วน | คำอธิบาย |
|-----|----------|
| **Frontend** | หน้าเว็บ React (Create React App + Tailwind) — Login, Knowledge, Bots, Chat |
| **Backend** | FastAPI (รับ `/api/*`, proxy ไป Node) + Node/Express (Auth, Documents, Bots, Chat, Upload) |
| **Database** | PostgreSQL (ผู้ใช้, Knowledge, Bots, บทสนทนา) |
| **Queue** | Redis (คิวอัปโหลดและประมวลผลเอกสาร) |
| **Vector DB** | Qdrant (เก็บ Embeddings สำหรับ RAG) |

```
┌─────────────┐     /api/*      ┌─────────────┐     proxy      ┌─────────────┐
│   Frontend  │ ───────────────►│   FastAPI   │ ──────────────►│ Node Legacy │
│  (React)    │                 │  (port 5051)│                 │ (port 5052) │
└─────────────┘                 └──────┬──────┘                 └──────┬──────┘
                                       │                                │
                                       │ OCR                            │ DB / Redis / Qdrant
                                       ▼                                ▼
                               ┌───────────────┐              ┌─────────────────────┐
                               │  OCR Service  │              │ Postgres, Redis,    │
                               │  (optional)   │              │ Qdrant (Docker)     │
                               └───────────────┘              └─────────────────────┘
```

---

## สิ่งที่ต้องมีก่อนติดตั้ง

| สิ่งที่ต้องมี | เวอร์ชันที่แนะนำ | ใช้ทำอะไร |
|---------------|------------------|-----------|
| **Node.js** | 20 ขึ้นไป | Backend (Node) + Frontend (React) |
| **Python** | 3.10 ขึ้นไป | Backend (FastAPI + OCR ถ้าใช้) |
| **Docker** | ล่าสุด (Desktop หรือ Engine) | รัน Postgres, Redis, Qdrant |
| **Git** | ล่าสุด | โคลนโปรเจกต์ |

---

## การติดตั้งตั้งแต่ต้น (หลัง Git Clone)

### ขั้นที่ 1 — โคลนโปรเจกต์

```bash
git clone <URL ของ repository>
cd Bingsu_Plus
```

---

### ขั้นที่ 2 — Backend: Infrastructure (Docker)

รันเฉพาะ Postgres, Redis และ Qdrant (ยังไม่รันแอป):

```bash
cd bingsu_plus/askaa_backend
docker compose up -d
```

ตรวจสอบว่ามี container 3 ตัวรันอยู่ (postgres, redis, qdrant):

```bash
docker ps
```

| Service  | พอร์ตบนเครื่องคุณ |
|----------|---------------------|
| Postgres | `5434`              |
| Redis    | `6380`              |
| Qdrant   | `6334`              |

---

### ขั้นที่ 3 — Backend: ไฟล์กำหนดค่า (.env.local)

สร้างไฟล์ `.env.local` จากตัวอย่าง (ในโฟลเดอร์ `bingsu_plus/askaa_backend`):

**Windows (PowerShell หรือ CMD):**

```powershell
copy env.sample .env.local
```

**macOS / Linux:**

```bash
cp env.sample .env.local
```

จากนั้นเปิด `.env.local` แล้วตั้งค่าต่อไปนี้อย่างน้อย:

| ตัวแปร | ความหมาย | ตัวอย่าง |
|--------|-----------|----------|
| `DATABASE_URL` | เชื่อมต่อ Postgres | `postgresql://postgres:postgres@localhost:5434/ask_the_manual?schema=public` |
| `REDIS_URL` | เชื่อมต่อ Redis | `redis://localhost:6380` |
| `QDRANT_URL` | เชื่อมต่อ Qdrant | `http://localhost:6334` |
| `LEGACY_API_URL` | ให้ FastAPI เรียก Node | `http://localhost:5052` |
| `CORS_ORIGINS` | อนุญาต Frontend | `http://localhost:3000` |
| `OPENAI_API_KEY` | คีย์แชท (หรือ Gateway) | คีย์จาก OpenAI หรือ aigateway |
| `EMBEDDING_PROVIDER` | ใช้ embed ที่ไหน | `openai` หรือ `gemini` |
| `EMBEDDING_MODEL` | โมเดล embedding | เช่น `text-embedding-3-large` หรือ `models/gemini-embedding-001` |
| `STORE_RAW_FILES` | เก็บไฟล์ต้นฉบับหรือไม่ | `false` (แนะนำ) |

ถ้าใช้ Embedding แบบ OpenAI ต้องมี `EMBEDDING_API_KEY` และ `EMBEDDING_BASE_URL` (หรือใช้ค่าจาก gateway ของคุณ)

---

### ขั้นที่ 4 — Backend: ติดตั้ง Dependencies และ Database

ยังอยู่ที่โฟลเดอร์ `bingsu_plus/askaa_backend`:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
```

(ถ้าต้องการ) สร้าง user admin และบอทช่วยสอน:

```bash
npm run seed:admins
npm run seed:help-bot
```

---

### ขั้นที่ 5 — Frontend: ไฟล์กำหนดค่า

เข้าโฟลเดอร์ Frontend (จาก `bingsu_plus/askaa_backend` ใช้ `cd ../Frontend`):

```bash
cd ../Frontend
```

**Windows:**

```powershell
copy ..\.env.example .env
```

**macOS / Linux:**

```bash
cp ../.env.example .env
```

สำหรับ **โหมดพัฒนา** (รัน Frontend ที่ `localhost:3000`):

- ไม่จำเป็นต้องตั้ง `REACT_APP_API_BASE_URL` ก็ได้ — ระบบจะใช้ proxy ใน `setupProxy.js` ส่ง `/api` ไปที่ `http://localhost:5051`
- หรือตั้ง `REACT_APP_API_BASE_URL=` (ว่าง) ใน `.env`

ถ้ารัน Frontend แยกเครื่องหรือไม่ใช้ proxy ให้ตั้งเป็น URL ของ Backend เช่น:

```env
REACT_APP_API_BASE_URL=http://localhost:5051
```

---

### ขั้นที่ 6 — Frontend: ติดตั้ง Dependencies

ยังอยู่ที่โฟลเดอร์ `Frontend`:

```bash
npm install
```

---

## การรันในโหมดพัฒนา

ต้องรัน **3 ส่วน** พร้อมกัน (เปิด 3 หน้าต่าง Terminal):

### Terminal 1 — Infrastructure (รันแล้วข้ามได้)

ถ้ารัน `docker compose up -d` ไว้แล้ว ไม่ต้องทำซ้ำ แค่ตรวจสอบว่า container ยังขึ้นอยู่:

```bash
cd bingsu_plus/askaa_backend
docker compose up -d
```

### Terminal 2 — Backend (Node + FastAPI)

**2a) Node Legacy API (port 5052):**

```bash
cd bingsu_plus/askaa_backend
npm run dev:legacy
```

**2b) FastAPI (port 5051)** — เปิด Terminal อีกหนึ่งอัน:

```bash
cd bingsu_plus/askaa_backend
npm run dev:fastapi
```

### Terminal 3 — Frontend (React)

```bash
cd bingsu_plus/Frontend
npm start
```

เบราว์เซอร์จะเปิดที่ `http://localhost:3000`  
ถ้ามีการ seed admin แล้ว ให้ล็อกอินด้วยบัญชี admin (เช่น `admin@admin.com` ตามที่ตั้งใน seed)

| URL | การใช้งาน |
|-----|------------|
| `http://localhost:3000` | หน้าเว็บ (Frontend) |
| `http://localhost:5051/api/health` | ตรวจสอบว่า Backend ตอบหรือไม่ |

---

## การรันทั้ง stack ด้วย Docker Compose (คำสั่งเดียว)

รันทุกอย่างใน Docker โดยไม่ต้องรัน `npm start` / `npm run dev:*` บนเครื่อง:

1. **เตรียม `.env` ในโฟลเดอร์ `askaa_backend`** (ใช้ร่วมกับ Docker):

   ```powershell
   cd bingsu_plus\askaa_backend
   copy env.sample .env
   ```

   แก้ `.env` ใส่ API keys (เช่น `OPENAI_API_KEY` หรือ `GEMINI_API_KEY`) ตามที่ใช้

2. **รันทั้ง stack จากโฟลเดอร์ `bingsu_plus`:**

   ```bash
   cd bingsu_plus
   docker compose up -d --build
   ```

   หรือดู log แบบต่อเนื่อง:

   ```bash
   docker compose up --build
   ```

3. **เข้าใช้งาน:** เปิดเบราว์เซอร์ที่ `http://localhost` (พอร์ต 80)

| Service  | พอร์ต (ถ้า expose) |
|----------|----------------------|
| เว็บ (Nginx + React) | `80` |
| FastAPI (โดยตรง)    | `8000` |
| Postgres            | `5434` |
| Redis               | `6380` |
| Qdrant              | `6334` |

ปิด stack: `docker compose down`

---

## การ Deploy แบบ Production (Docker)

เมื่อต้องการ deploy จริง (รันจากโฟลเดอร์ `bingsu_plus/askaa_backend`):

1. **เตรียม `.env` ในโฟลเดอร์ `bingsu_plus/askaa_backend`** (ไม่ใช้ `.env.local`):

   ```bash
   cd bingsu_plus/askaa_backend
   copy env.sample .env
   ```

   แก้ `.env` ให้เหมาะกับ production (API keys, `CORS_ORIGINS` เป็น URL จริง ฯลฯ)

2. **ให้พอร์ต 80 ว่าง** — ถ้ามีโปรแกรมอื่นใช้พอร์ต 80 อยู่ (เช่น IIS, Nginx อื่น) ต้องปิดหรือย้ายไปพอร์ตอื่น

3. **รันทั้ง stack:**

   ```bash
   cd bingsu_plus/askaa_backend
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. **เข้าใช้งาน:** เปิดเบราว์เซอร์ที่ `http://<IP ของเครื่อง>` (หรือโดเมนที่ชี้มาที่ IP นี้)

ในโหมดนี้ Nginx ใน Docker จะทำหน้าที่:

- เสิร์ฟหน้าเว็บ (React build)
- ส่ง request ที่ขึ้นต้นด้วย `/api/` ไปที่ FastAPI

รายละเอียดเพิ่มเติมดูที่ [bingsu_plus/askaa_backend/README.md](bingsu_plus/askaa_backend/README.md) ส่วน Production deploy

---

## โครงสร้างโปรเจกต์

ใช้ชุด **Docker** เดียว — Frontend และ Backend อยู่ในโฟลเดอร์ `bingsu_plus/`:

```
ask_AA/
├── README.md                 ← คู่มือนี้
├── bingsu_plus/              ← โฟลเดอร์หลักสำหรับรันและ deploy (Docker)
│   ├── docker-compose.yml    ← รันทั้ง stack (Frontend + Backend + DB)
│   ├── .env.example          ← ตัวอย่าง env สำหรับ Frontend
│   ├── askaa_backend/        ← Backend (Node + FastAPI)
│   │   ├── README.md         ← รายละเอียด Backend, OCR, Embedding, Production
│   │   ├── env.sample        ← ตัวอย่าง .env สำหรับ Backend
│   │   ├── docker-compose.prod.yml  ← Production (Nginx + build)
│   │   ├── server/           ← Node/Express (Auth, Documents, Bots, Chat, Upload)
│   │   ├── backend/          ← FastAPI (proxy + OCR)
│   │   ├── prisma/           ← Schema และ migrations
│   │   └── nginx/            ← คอนฟิก Nginx สำหรับ Production
│   └── Frontend/             ← React (Create React App + Tailwind)
│       ├── src/
│       │   ├── config/api.js ← baseURL สำหรับเรียก API
│       │   └── setupProxy.js ← proxy /api → localhost:5051 ตอนพัฒนา
│       └── public/
```

รัน: `cd bingsu_plus` แล้ว `docker compose up -d --build` หรือ deploy ตามหัวข้อด้านบน

---

## แก้ปัญหาเบื้องต้น

| อาการ | แนวทางแก้ |
|--------|------------|
| **พอร์ตถูกใช้อยู่** (เช่น 5051, 5052, 3000) | ปิด process ที่ใช้พอร์ตนั้น หรือเปลี่ยนพอร์ตใน config |
| **Login แล้วขึ้น Network error / Not Found** | ตรวจว่า Backend รันครบ (legacy + FastAPI) และ Frontend ชี้ไปที่ URL ที่ถูก (หรือใช้ proxy) |
| **อัปโหลดเอกสารแล้วไม่ประมวลผล** | โหมด production ต้องมี `worker` รัน (รวมอยู่ใน `docker-compose.prod.yml`) และ `UPLOAD_QUEUE_MODE=redis` |
| **Embedding / แชท error เรื่อง API key** | ตรวจ `OPENAI_API_KEY`, `EMBEDDING_API_KEY` หรือ `GEMINI_API_KEY` ใน `.env.local` / `.env` ว่าถูกต้องและตรงกับ provider ที่เลือก |
| **เปลี่ยน Embedding model แล้ว error** | ใช้ Qdrant collection ใหม่ (ตั้ง `QDRANT_COLLECTION` ใน env) แล้วรัน `npm run reindex:documents` ใน `bingsu_plus/askaa_backend` |

---

## ลิงก์เพิ่มเติม

- **Backend (รายละเอียด OCR, Embedding, Privacy, Production):** [bingsu_plus/askaa_backend/README.md](bingsu_plus/askaa_backend/README.md)
- **Frontend (React, Tailwind):** [bingsu_plus/Frontend/README.md](bingsu_plus/Frontend/README.md)
