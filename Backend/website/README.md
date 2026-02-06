# Backend API - FastAPI + Prisma

## Setup

### 1. Install Dependencies

```bash
# สร้าง virtual environment (ถ้ายังไม่มี)
python3 -m venv venv
source venv/bin/activate

# ติดตั้ง dependencies
pip install -r requirements.txt
```

### 2. Configure Database

Edit the `.env` file and set your PostgreSQL connection string:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
```

**Database Configuration:**
- **Server Group**: BSDB (ใช้ตัวบน - ไม่ใช่ PostgreSQL 17)
- **Server Name**: BSDB
- **Database Name**: BS_DB
- **Username**: Bingsu_Db_Admin
- **Host**: (ตรวจสอบจาก connection settings ของ BSDB)
- **Port**: (ตรวจสอบจาก connection settings ของ BSDB)

**สำหรับ PostgreSQL บน localhost:**
- `username`: ชื่อผู้ใช้ PostgreSQL ของคุณ
- `password`: รหัสผ่าน PostgreSQL ของคุณ
- `localhost`: ที่อยู่ของ database (ใช้ `localhost` สำหรับ local)
- `5432`: พอร์ตของ PostgreSQL (default: 5432)
- `database_name`: ชื่อ database ที่ต้องการใช้

**ตัวอย่าง:**
```env
DATABASE_URL="postgresql://Bingsu_Db_Admin:password@localhost:5432/BS_DB"
```

### 3. Setup PostgreSQL Permissions

Prisma ต้องการสิทธิ์ในการสร้าง database (สำหรับ shadow database ใน migrations)

**วิธีที่ 1: ให้สิทธิ์สร้าง database (แนะนำสำหรับ development)**

```bash
# เชื่อมต่อ PostgreSQL
psql -U postgres

# หรือใช้ database ที่มีอยู่
psql -U your_username -d your_database
```

จากนั้นรันคำสั่ง SQL:
```sql
-- แทนที่ 'your_username' ด้วย username PostgreSQL ของคุณ
ALTER USER your_username CREATEDB;

-- หรือถ้าใช้ user 'postgres'
ALTER USER postgres CREATEDB;
```

**วิธีที่ 2: ใช้ prisma db push แทน migrate (ไม่ต้องใช้ shadow database)**

```bash
prisma db push
```

### 4. Setup Prisma

```bash
# Generate Prisma Client (ถ้าใช้ Prisma)
prisma generate

# สร้าง tables ใน database
prisma db push

# หรือใช้ migrations (ต้องมีสิทธิ์สร้าง database)
prisma migrate dev --name init
```

### 5. Check Database Connection

```bash
# เช็คการเชื่อมต่อ database ผ่าน API
curl http://localhost:8000/health/db
```

### 6. Run the Server

**For local development (localhost only):**
```bash
source venv/bin/activate
uvicorn app.main:app --reload
```

**For network access (accessible from other devices on same network):**
```bash
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Server will run at:
- Local: `http://localhost:8000`
- Network: `http://<your-ip-address>:8000` (e.g., `http://192.168.1.100:8000`)

**Note:** To allow other devices on the same network to access the server:
1. Use `--host 0.0.0.0` instead of default `localhost`
2. Find your IP address: `ifconfig | grep "inet " | grep -v 127.0.0.1` (macOS/Linux)
3. Make sure firewall allows connections on port 8000
4. Update frontend `.env` to use your IP: `REACT_APP_API_BASE_URL=http://<your-ip>:8000`

## API Endpoints

### General
- `GET /` - Welcome message
- `GET /health` - Health check
- `GET /health/db` - Database connection check

### Users
- `GET /users` - Get all users (with pagination: ?skip=0&limit=100)
- `GET /users/{user_id}` - Get user by ID
- `POST /users` - Create new user (query params: email, name)
- `PUT /users/{user_id}` - Update user (query params: email, name)
- `DELETE /users/{user_id}` - Delete user

## Project Structure

```
Backend/
├── app/
│   ├── main.py          # FastAPI application
│   ├── database.py      # SQLAlchemy database configuration
│   └── models.py        # SQLAlchemy models
├── prisma/
│   ├── schema.prisma    # Prisma schema (for migrations)
│   └── migrations/      # Database migrations
├── .env                 # Environment variables (not in git)
├── requirements.txt     # Python dependencies
└── README.md           # This file
```
