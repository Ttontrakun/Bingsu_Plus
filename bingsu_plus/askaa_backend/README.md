## `askaa_backend` (FastAPI main + Node legacy)

Backend สำหรับชุด **Bingsu Plus** (ported จาก `ask_AA`) โดยให้ **FastAPI เป็น entrypoint หลัก** และ **proxy ไป Node legacy** สำหรับ route ที่ยังไม่ได้ย้าย

### ภาพรวมสถาปัตย์

| ส่วน | ทำอะไร | เทคโนโลยี |
|---|---|---|
| **FastAPI (main)** | รับ `/api/*` และ proxy ต่อไป legacy (รวม OCR endpoint) | Python + FastAPI |
| **Node/Express (legacy)** | API หลัก (auth, documents, bots, chat, upload queue) | Node.js + Express |
| **Database** | เก็บ user/knowledge/chat ฯลฯ | Postgres + Prisma |
| **Queue** | ทำงาน upload processing แบบแยก worker | Redis |
| **Vector DB** | เก็บ embeddings สำหรับ RAG | Qdrant |

Frontend ควรเรียกแค่ URL เดียว เช่น `https://your-domain/api/...`

### พอร์ต (ตอนรัน local ตามค่า default)

- **FastAPI main**: `http://localhost:5051`
- **Node legacy**: `http://localhost:5052`
- **Postgres (Docker)**: `localhost:5434`
- **Redis (Docker)**: `localhost:6380`
- **Qdrant (Docker)**: `http://localhost:6334`

---

## Local quickstart (แนะนำ)

### Prerequisites

- Node.js (แนะนำ 20+)
- Python 3.10+ (ถ้าจะใช้ FastAPI/OCR)
- Docker Desktop (สำหรับ infra: Postgres/Redis/Qdrant)

### 1) Start infra (Postgres + Redis + Qdrant)

รันจากโฟลเดอร์ `bingsu_plus/askaa_backend`:

```bash
docker compose up -d
```

### 2) สร้างไฟล์ `.env.local`

Windows (PowerShell/cmd):

```bash
copy env.sample .env.local
```

macOS/Linux:

```bash
cp env.sample .env.local
```

**ค่าที่ควรตั้งอย่างน้อย**
- **DB/Infra**: `DATABASE_URL`, `REDIS_URL`, `QDRANT_URL`
- **FastAPI → Legacy**: `LEGACY_API_URL="http://localhost:5052"`
- **Chat**: `OPENAI_API_KEY` (+ `GATEWAY_BASE_URL` ถ้าใช้ gateway)
- **Embeddings**: `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL` (+ key ของ provider ที่เลือก)
- **Privacy**: `STORE_RAW_FILES="false"` (ไม่เก็บไฟล์ต้นฉบับ)

### 3) ติดตั้ง Node deps + Prisma

```bash
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
```

(optional) seed admin/support:

```bash
npm run seed:admins
```

### 4) Start APIs (2 process)

เปิด 2 terminal:

```bash
# terminal 1: Node legacy (PORT=5052)
npm run dev:legacy
```

```bash
# terminal 2: FastAPI main (PORT=5051)
npm run dev:fastapi
```

ทดสอบ:
- FastAPI health: `GET http://localhost:5051/api/health`

---

## Privacy mode (แนะนำ): เก็บเฉพาะ text + embeddings

ตั้งค่า:
- `STORE_RAW_FILES="false"`

ผลลัพธ์:
- เก็บเฉพาะ **ข้อความที่สกัดแล้ว** (`text/blocks` ใน `Document.sourceFiles`) + **embeddings** ใน Qdrant
- **ไม่เก็บไฟล์ต้นฉบับ** ลง `.files/`
- ปิด endpoint ดาวน์โหลดไฟล์ดิบ:
  - `GET /api/documents/:id/files/:index/download` → `404`

หมายเหตุ: ระบบยังเก็บไฟล์ชั่วคราวระหว่างอัปโหลดใน `.uploads/` (เพื่อ assemble parts) แล้วจะลบทิ้งหลังประมวลผลเสร็จ

---

## OCR (optional)

Node legacy จะเรียก OCR ที่:
- `OCR_API_URL` + `/api/ocr/extract`

ถ้าคุณรัน FastAPI main อยู่แล้ว ให้ชี้ OCR ไปตัวเดียวกันได้:
- `OCR_ENABLED="true"`
- `OCR_API_URL="http://localhost:5051"`

เลือก provider:
- `OCR_PROVIDER="paddle"`: รัน PaddleOCR ภายใน (ดาวน์โหลดโมเดลครั้งแรกค่อนข้างหนัก)
- `OCR_PROVIDER="typhoon"`: เรียก Typhoon OCR API (ต้องตั้ง `TYPHOON_OCR_API_KEY`)

ติดตั้ง Python deps:

```bash
python -m pip install -r backend/requirements.txt
```

---

## เปลี่ยน embedding model/provider (สำคัญ)

ถ้าคุณเปลี่ยน embedding model/provider ให้ใช้ **Qdrant collection ใหม่** เพื่อเลี่ยง vector size mismatch แล้วค่อย reindex:

```bash
npm run reindex:documents
```

---

## Production deploy (Docker) สำหรับชุด Bingsu Plus

ไฟล์ที่เกี่ยวข้อง:
- `docker-compose.prod.yml`
- `Dockerfile.web` (build CRA `../Frontend` แล้วเสิร์ฟด้วย nginx)
- `Dockerfile.legacy` (Node legacy)
- `nginx/default.prod.conf` (เสิร์ฟ SPA + proxy `/api` → FastAPI)

### ขั้นตอนบน server

```bash
cd bingsu_plus/askaa_backend
cp env.sample .env
# แก้ .env ใส่ค่า prod จริง (CORS_ORIGINS, keys, ฯลฯ)
docker compose -f docker-compose.prod.yml up -d --build
```

เข้าเว็บได้ที่:
- `http://<server-ip>/`

API:
- `http://<server-ip>/api/*`

**บัญชีแอดมิน (ต้อง seed ก่อน):** หลัง deploy ครั้งแรกให้รัน seed เพื่อสร้าง admin/support:
```bash
docker compose -f docker-compose.prod.yml exec legacy node server/scripts/seed-admins.js
```
จากนั้นล็อกอินด้วย `admin@admin.com` / `admin1234`

---

## Troubleshooting

- **Port ชนกัน**: เปลี่ยนพอร์ต หรือปิด process ที่ใช้พอร์ตนั้นอยู่
- **Upload queue**: production แนะนำ `UPLOAD_QUEUE_MODE=redis` และต้องมี `worker` ทำงานอยู่
- **OCR ช้า/หนัก**: ถ้าไม่ใช้ให้ปิด `OCR_ENABLED="false"`
