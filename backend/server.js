const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { router: authRoutes } = require('./routes/auth');
const friendRoutes = require('./routes/friends');
const chatRoomRoutes = require('./routes/chatRooms');
const messageRoutes = require('./routes/messages');

const app = express();
const server = http.createServer(app);

// Socket.IO CORS 설정 개선
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Express CORS 설정
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'], 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Socket.IO 인스턴스를 전역으로 설정
app.set('io', io);

// 라우트 연결 
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/chat-rooms', (req, res, next) => {
  req.io = io;
  next();
}, chatRoomRoutes);
app.use('/api/messages', messageRoutes);

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ 
    message: 'KakaoTalk Clone API Server',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      friends: '/api/friends', 
      chatRooms: '/api/chat-rooms',
      messages: '/api/messages'
    }
  });
});

// Socket.IO 인증 미들웨어
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    console.error('토큰이 없습니다');
    return next(new Error('Authentication error'));
  }
  
  jwt.verify(token, 'yourjwtsecret', (err, decoded) => {
    if (err) {
      console.error('토큰 검증 실패:', err);
      return next(new Error('Authentication error'));
    }
    socket.userId = decoded.id;
    socket.username = decoded.username;
    next();
  });
});

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  console.log(`사용자 ${socket.username} (ID: ${socket.userId}) 연결됨`);
  
  // 채팅방 참여
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`${socket.username}이 채팅방 ${roomId}에 참여`);
    
    // 채팅방 입장 시 모든 메시지를 읽음 처리
    const messageModel = require('./models/messages');
    const chatRoomsModel = require('./models/chatRooms');
    
    // 채팅방 입장 시 숨김 해제
    chatRoomsModel.showChatRoomForUser(roomId, socket.userId, (err) => {
      if (err) {
        console.error('채팅방 숨김 해제 실패:', err);
      } else {
        console.log(`사용자 ${socket.userId}의 채팅방 ${roomId} 숨김 해제됨`);
      }
    });
    
    messageModel.markAllMessagesAsRead(roomId, socket.userId, (err) => {
      if (err) {
        console.error('메시지 읽음 처리 오류:', err);
        return;
      }
      
      // 읽음 상태 업데이트를 방의 모든 사용자에게 알림
      io.to(roomId).emit('messages_read', {
        roomId: roomId,
        userId: socket.userId
      });
      
      // 채팅방 목록 업데이트 알림
      io.emit('chat_room_updated', {
        roomId: roomId,
        action: 'join',
        userId: socket.userId
      });
    });
  });
  
  // 채팅방 나가기
  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
    console.log(`${socket.username}이 채팅방 ${roomId}에서 나감`);
    
    setTimeout(() => {
      io.emit('chat_room_updated', {
        roomId: roomId,
        action: 'leave',
        userId: socket.userId
      });
    }, 100);
  });
  
  // 메시지 전송
  socket.on('send_message', (data) => {
    const { roomId, content, message_type = 'text' } = data;
    const messageModel = require('./models/messages');
    const chatRoomsModel = require('./models/chatRooms');
    
    console.log(`메시지 전송: ${socket.username} -> 방 ${roomId}`);
    
    // DB에 메시지 저장
    messageModel.createMessage(roomId, socket.userId, message_type, content, (err, result) => {
      if (err) {
        console.error('메시지 저장 실패:', err);
        socket.emit('message_error', { error: '메시지 전송 실패' });
        return;
      }
      
      const messageId = result.insertId;
      
      // 메시지 전송 시 숨겨진 멤버들 다시 보이게 하기
      chatRoomsModel.unhideRoomForAllMembers(roomId, socket.userId, (err) => {
        if (err) {
          console.error('채팅방 숨김 해제 실패:', err);
        } else {
          console.log(`채팅방 ${roomId}의 숨겨진 멤버들이 다시 보이게 되었습니다.`);
        }
      });
      
      // 저장된 메시지 정보 조회 (읽지 않은 사용자 수 포함)
      messageModel.getMessagesByRoomIdWithUnreadCount(roomId, socket.userId, 1, 0, (err, messages) => {
        if (err) {
          console.error('메시지 조회 실패:', err);
          return;
        }
        
        if (messages.length > 0) {
          const message = messages[0];
          
          // 같은 방의 모든 사용자에게 메시지 전송
          io.to(roomId).emit('receive_message', message);
          console.log(`메시지 브로드캐스트 완료: ${message.id}`);
          
          // 모든 연결된 사용자에게 채팅방 목록 업데이트 알림
          io.emit('chat_room_updated', {
            roomId: roomId,
            lastMessage: content,
            lastMessageTime: message.created_at
          });
        }
      });
    });
  });
  
  // 메시지 읽음 확인
  socket.on('message_read', (data) => {
    const { messageId, roomId } = data;
    const messageModel = require('./models/messages');
    
    messageModel.markMessageAsRead(messageId, socket.userId, (err) => {
      if (err) {
        console.error('메시지 읽음 처리 오류:', err);
        return;
      }
      
      // 같은 방의 모든 사용자에게 읽음 상태 업데이트 전송
      io.to(roomId).emit('message_read_update', {
        messageId: messageId,
        userId: socket.userId,
        roomId: roomId
      });
      
      console.log(`메시지 ${messageId}가 ${socket.userId}에 의해 읽음 처리됨`);
    });
  });

  // 타이핑 중 상태
  socket.on('typing_start', (roomId) => {
    socket.to(roomId).emit('user_typing', {
      username: socket.username,
      isTyping: true
    });
  });
  
  socket.on('typing_stop', (roomId) => {
    socket.to(roomId).emit('user_typing', {
      username: socket.username,
      isTyping: false
    });
  });
  
  // 연결 해제
  socket.on('disconnect', () => {
    console.log(`사용자 ${socket.username} 연결 해제됨`);
  });
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error('❌ 에러:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 핸들링
app.use((req, res) => {
  console.log(`⚠️ 404: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found' });
});

// 서버 실행
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`KakaoTalk Clone Server running on http://localhost:${PORT}`);
  console.log(`Socket.IO ready for connections`);
});

// 프로세스 에러 핸들링
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGINT', () => {
  console.log('\n서버를 종료합니다...');
  server.close(() => {
    console.log('서버가 정상적으로 종료되었습니다.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM 신호를 받았습니다. 서버를 종료합니다...');
  server.close(() => {
    console.log('서버가 정상적으로 종료되었습니다.');
    process.exit(0);
  });
});
