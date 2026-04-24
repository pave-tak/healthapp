# 운동 관리 앱

Node.js + React + PostgreSQL 풀스택 운동 관리 앱

## 📁 구조

```
HealthApp/
├── server/          Node.js + Express 백엔드 (포트 4000)
├── client/          React + Vite 프론트엔드 (포트 3000)
└── docker-compose.yml  PostgreSQL 컨테이너
```

## ✅ 사전 준비

- [Node.js 18+](https://nodejs.org/) 설치
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치

## 🚀 실행 방법

### 1. PostgreSQL 실행 (Docker)

```bash
docker-compose up -d
```

### 2. 백엔드 실행

```bash
cd server
copy .env.example .env
npm install
npm run dev
```

### 3. 프론트엔드 실행 (새 터미널)

```bash
cd client
npm install
npm run dev
```

### 4. 브라우저에서 열기

```
http://localhost:3000
```

## 🔌 API 엔드포인트

| Method | URL | 설명 |
|--------|-----|------|
| GET | /api/exercises | 운동 종목 목록 |
| POST | /api/exercises | 운동 종목 추가 |
| PUT | /api/exercises/:id | 기본값 수정 |
| GET | /api/workouts | 전체 운동 기록 |
| POST | /api/workouts/:date | 날짜별 기록 저장 |
| DELETE | /api/workouts/:date | 날짜별 기록 삭제 |
| GET | /api/stats | 통계 |
