# 운동 관리 앱

React + Vite로 만든 휴대폰 로컬 저장 방식의 운동 관리 앱.
Capacitor로 감싸서 안드로이드 APK로 빌드할 수 있습니다.

## 📁 구조

```
HealthApp/
├── client/
│   ├── src/
│   │   ├── App.jsx          메인 UI
│   │   ├── main.jsx         엔트리
│   │   └── api/
│   │       ├── db.js        Dexie(IndexedDB) 스키마 + 시드
│   │       └── index.js     로컬 DB CRUD / 통계 / 백업·복원 API
│   ├── public/              아이콘·PWA 매니페스트·서비스워커
│   ├── android/             Capacitor 안드로이드 프로젝트
│   ├── vite.config.js
│   └── capacitor.config.json
└── README.md
```

## 🗄 데이터 저장 방식

- **전부 기기 로컬에 저장** — 서버 없음, 네트워크 요청 없음
- IndexedDB 기반 [Dexie](https://dexie.org/) 사용
- 스토어
  - `exerciseTypes` — 운동 종목 마스터 (카테고리·이름·기본 반복 수·기본 휴식초)
  - `workouts` — 날짜(`YYYY-MM-DD`)별 운동 기록
- 첫 실행 시 기본 종목 시드 자동 삽입 ([client/src/api/db.js](client/src/api/db.js))
- 개발 중 초기화: 브라우저 콘솔에서 `window.resetDB()`

## 🚀 개발 실행

```bash
cd client
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속.

## 📱 안드로이드 APK 빌드

사전 준비:
- [Node.js 18+](https://nodejs.org/)
- [Android Studio](https://developer.android.com/studio) + Android SDK

```bash
cd client
npm install
npm run build:apk
```

스크립트 내역 ([client/package.json](client/package.json)):
| 스크립트 | 설명 |
|---|---|
| `npm run dev` | Vite 개발 서버 |
| `npm run build` | 웹 빌드 → `client/dist/` |
| `npm run sync:android` | 빌드 + Capacitor → 안드로이드 프로젝트로 동기화 |
| `npm run open:android` | Android Studio 열기 |
| `npm run build:apk` | 빌드 + 동기화 + 디버그 APK 생성 |

APK 위치: `client/android/app/build/outputs/apk/debug/app-debug.apk`

## 💾 백업 / 복원

앱 내 기능으로 제공 (로컬 DB → JSON 파일):
- `api.exportAll()` — 전체 스토어를 JSON 객체로 반환
- `api.importAll(data)` — JSON을 불러와 기존 데이터 **전체 교체**

## 🧹 참고

- 초기 버전(v0)은 Node.js + Express + PostgreSQL 풀스택으로 작성되었으나, v1에서 휴대폰 로컬 저장 방식으로 전환했습니다.
- `server/`와 `docker-compose.yml`은 더 이상 사용하지 않는 레거시입니다.
- 초기 프로토타입 원본: [운동관리.html](운동관리.html), [운동관리앱.jsx](운동관리앱.jsx)
