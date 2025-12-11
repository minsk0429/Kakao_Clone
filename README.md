# KakaoTalk Clone

실시간 채팅 기능을 갖춘 카카오톡 클론 프로젝트입니다.

## 프로젝트 개요

Node.js와 React를 사용하여 구현한 실시간 메신저 애플리케이션으로, 카카오톡의 핵심 기능들을 재현했습니다.

## 주요 기능

### 사용자 관리
- 회원가입 및 로그인
- JWT 기반 인증
- 프로필 이미지 및 상태 메시지 관리
- bcrypt를 이용한 비밀번호 암호화

### 친구 관리
- 사용자명으로 친구 추가
- 친구 목록 조회
- 친구 삭제

### 채팅 기능
- 1:1 채팅
- 그룹 채팅
- 실시간 메시지 송수신 (Socket.IO)
- 메시지 읽음 처리
- 안 읽은 메시지 카운트
- 채팅방 나가기 및 숨김 처리

### 실시간 기능
- WebSocket 기반 실시간 통신
- 채팅방 입장/퇴장 알림
- 실시간 메시지 전송 및 수신
- 타이핑 상태 표시

## 기술 스택

### Backend
- Node.js
- Express.js
- Socket.IO (실시간 통신)
- MySQL (데이터베이스)
- JWT (인증)
- bcrypt (비밀번호 암호화)

### Frontend
- React 18
- TypeScript
- Vite
- Socket.IO Client
- Axios
- Styled Components

## 프로젝트 구조

```
kakao-main/
├── backend/
│   ├── config/
│   │   └── database.js          # MySQL 연결 설정
│   ├── models/
│   │   ├── users.js             # 사용자 모델
│   │   ├── chatRooms.js         # 채팅방 모델
│   │   └── messages.js          # 메시지 모델
│   ├── routes/
│   │   ├── auth.js              # 인증 라우트
│   │   ├── friends.js           # 친구 라우트
│   │   ├── chatRooms.js         # 채팅방 라우트
│   │   └── messages.js          # 메시지 라우트
│   ├── server.js                # Express 서버 및 Socket.IO 설정
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # 메인 애플리케이션
│   │   ├── App.css              # 스타일
│   │   ├── main.tsx             # 진입점
│   │   └── types/               # TypeScript 타입 정의
│   ├── public/
│   ├── vite.config.ts
│   └── package.json
└── db/
    └── database.sql             # 데이터베이스 스키마

```

## 데이터베이스 스키마

### users
사용자 정보 저장

### friends
친구 관계 저장 (양방향)

### chat_rooms
채팅방 정보 저장

### chat_room_members
채팅방 참여자 정보

### messages
메시지 내용 저장

### message_reads
메시지 읽음 상태 추적

## 설치 및 실행

### 사전 요구사항
- Node.js 14 이상
- MySQL 5.7 이상
- npm 또는 yarn

### 데이터베이스 설정

1. MySQL 서버를 실행합니다.

2. 데이터베이스를 생성합니다:
```bash
mysql -u root -p
CREATE DATABASE kakao;
```

3. 스키마를 적용합니다:
```bash
mysql -u root -p kakao < db/database.sql
```

4. `backend/config/database.js` 파일에서 MySQL 연결 정보를 설정합니다:
```javascript
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'your_password',  // MySQL 비밀번호 입력
  database: 'kakao',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

### Backend 실행

```bash
cd backend
npm install
npm run dev
```

백엔드 서버는 http://localhost:5001 에서 실행됩니다.

### Frontend 실행

```bash
cd frontend
npm install
npm run dev
```

프론트엔드는 http://localhost:3000 에서 실행됩니다.

## API 엔드포인트

### 인증
- POST /api/auth/signup - 회원가입
- POST /api/auth/login - 로그인
- GET /api/auth/me - 현재 사용자 정보

### 친구
- POST /api/friends/add - 친구 추가
- GET /api/friends - 친구 목록 조회
- DELETE /api/friends/:friendId - 친구 삭제

### 채팅방
- POST /api/chat-rooms/create - 채팅방 생성
- GET /api/chat-rooms - 채팅방 목록 조회
- DELETE /api/chat-rooms/:roomId/leave - 채팅방 나가기

### 메시지
- GET /api/messages/:roomId - 채팅방 메시지 조회
- POST /api/messages/send - 메시지 전송

## Socket.IO 이벤트

### Client to Server
- join_room - 채팅방 입장
- leave_room - 채팅방 퇴장
- send_message - 메시지 전송
- typing - 타이핑 상태 전송

### Server to Client
- receive_message - 메시지 수신
- user_joined - 사용자 입장 알림
- user_left - 사용자 퇴장 알림
- chat_room_updated - 채팅방 업데이트

## 보안

- JWT 기반 토큰 인증
- bcrypt를 이용한 비밀번호 해싱
- CORS 설정으로 허용된 출처만 접근 가능
- Socket.IO 연결 시 JWT 토큰 검증

## 개발자

이 프로젝트는 학습 목적으로 제작되었습니다.