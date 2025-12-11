import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io, { Socket } from 'socket.io-client';
import './App.css';

// TypeScript 인터페이스
interface User {
  id: number;
  username: string;
  email?: string;
  profile_image?: string;
  status_message?: string;
}

interface Friend {
  id: number;
  username: string;
  profile_image?: string;
  status_message?: string;
}

interface ChatRoom {
  id: number;
  room_name?: string;
  created_at: string;
  last_message?: string;
  last_message_time?: string;
  participants?: User[];
  unread_count?: number;
}

interface Message {
  id: number;
  room_id: number;
  sender_id: number;
  sender_username: string;
  sender_profile_image?: string;
  message_type: 'text' | 'image' | 'file';
  content: string;
  created_at: string;
  unread_count?: number;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [signupForm, setSignupForm] = useState({ username: '', password: '', email: '', status_message: '' });
  const [isSignup, setIsSignup] = useState(false);
  const [message, setMessage] = useState('');
  
  // 메인 앱 상태
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  
  // 모달 상태
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | Friend | null>(null);
  const [friendUsername, setFriendUsername] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('token'));
  
  // Socket.IO 상태
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [selectedChatRoom, setSelectedChatRoom] = useState<number | null>(null);
  const [showChatRoom, setShowChatRoom] = useState(false);
  const [currentChatFriend, setCurrentChatFriend] = useState<Friend | null>(null);
  const [showGroupChatModal, setShowGroupChatModal] = useState(false);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Friend[]>([]);
  const [groupChatName, setGroupChatName] = useState('');
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showStatusMessageModal, setShowStatusMessageModal] = useState(false);
  const [newStatusMessage, setNewStatusMessage] = useState(user?.status_message || '');

  const API_BASE_URL = 'http://localhost:5001/api';

  // API 함수들
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, loginForm);
      const { user, token } = response.data;
      
      // 사용자 정보와 토큰 저장
      setUser(user);
      setAuthToken(token);
      localStorage.setItem('token', token);
      setIsLoggedIn(true);
      setMessage('로그인 성공!');
      
      // Socket.IO 연결
      connectSocket(token);
      
      // 토큰을 직접 전달하여 친구 목록과 채팅방 목록 로드
      loadFriends(token);
      loadChatRooms(token);
    } catch (error: any) {
      console.error("Login Error:", error);
      
      let errorMessage = '로그인 실패';

      // 서버에서 401/400 응답을 받거나, 응답 데이터에 'Invalid credentials'가 포함된 경우
      const serverError = error.response?.data?.error;
      
      if (error.response?.status === 401 || error.response?.status === 400 || (serverError && serverError.includes('Invalid credentials'))) {
        // 메시지 출력
        errorMessage = '아이디 또는 비밀번호를 다시 확인해주세요.';
      } else if (serverError) {
        // 기타 서버에서 정의한 에러 메시지
        errorMessage = serverError;
      } else {
        // 네트워크 오류 등 기타 오류
        errorMessage = '로그인 중 네트워크 문제가 발생했습니다.';
      }

      setMessage(errorMessage);
    }
  };

  // 메시지 자동 숨김 로직
  useEffect(() => {
    if (message) {
      // 메시지가 있으면 설정한 시간 이후에 메시지를 비움
      const timer = setTimeout(() => {
        setMessage('');
      }, 3000); // 3초 설정

      // 컴포넌트가 언마운트되거나 message가 바뀌기 전에 타이머 정리
      return () => clearTimeout(timer);
    }
  }, [message] // message 상태가 변경될 때마다 실행
);

  // Socket.IO 연결 함수
const connectSocket = (token: string) => {
  const newSocket = io('http://localhost:5001', {
    auth: { token }
  });

  newSocket.on('connect', () => {
    console.log('Socket.IO 연결됨');
  });

  // 메시지 읽음 상태 업데이트
  newSocket.on('message_read_update', (data) => {
    if (selectedChatRoom === data.roomId) {
      loadMessages(data.roomId);
    }
  });

  // 전체 메시지 읽음 처리 알림
  newSocket.on('messages_read', (data) => {
    if (selectedChatRoom === data.roomId) {
      loadMessages(data.roomId);
    }
    loadChatRooms();
  });

  newSocket.on('chat_room_updated', (data) => {
    loadChatRooms();
  });

  // 새로운 메시지 수신
  newSocket.on('receive_message', (message) => {
    setMessages(prev => [...prev, message]);
    scrollToBottom();
      
    setTimeout(() => loadChatRooms(), 500);
      
    if (message.sender_id !== user?.id) {
      newSocket.emit('message_read', {
        messageId: message.id,
        roomId: message.room_id,
        readerId: user?.id
      });
    }
  });

  newSocket.on('disconnect', () => {
    console.log('Socket.IO 연결 해제됨');
  });

  setSocket(newSocket);
};

  // 메시지 목록 하단으로 스크롤
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 메시지 전송
  const sendMessage = () => {
    if (!currentMessage.trim() || !socket || !selectedChatRoom) return;

    socket.emit('send_message', {
      roomId: selectedChatRoom,
      content: currentMessage,
      message_type: 'text'
    });

    setCurrentMessage('');
  };

// 1:1 채팅 시작 시 모든 메시지 읽음 처리
const startChat = async (friend: Friend) => {
  try {
    if (!authToken) return;
    
    const response = await axios.post(`${API_BASE_URL}/chat-rooms/create-or-find`, {
      participants: [user?.id, friend.id]
    }, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const roomId = response.data.room.id;
    
    if (socket) {
      if (selectedChatRoom) {
        socket.emit('leave_room', selectedChatRoom);
      }
      
      socket.emit('join_room', roomId);
      setSelectedChatRoom(roomId);
      setCurrentChatFriend(friend);
      setShowChatRoom(true);
      loadMessages(roomId);
      
      setShowProfile(false);
      
      // 채팅방 입장 시 모든 메시지 읽음 처리
      await axios.post(`${API_BASE_URL}/messages/read-all/${roomId}`, {}, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
    }
  } catch (error) {
    console.error('채팅방 생성/조회 실패:', error);
    setMessage('채팅방을 시작할 수 없습니다.');
  }
};

  const createGroupChat = async () => {
    if (selectedGroupMembers.length < 2 || !groupChatName.trim()) {
      alert('그룹 채팅방 이름을 입력하고 2명 이상의 친구를 선택해주세요.');
      return;
    }

    try {
      const participantIds = [user?.id, ...selectedGroupMembers.map(friend => friend.id)];
      const response = await axios.post(
        `${API_BASE_URL}/chat-rooms/create`,
        {
          name: groupChatName,
          room_type: 'group',
          participants: participantIds
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      const chatRoom = response.data.room;
      setSelectedChatRoom(chatRoom.id);
      setCurrentChatFriend({ username: groupChatName, id: chatRoom.id, profile_image: undefined } as Friend);
      setShowChatRoom(true);
      setShowGroupChatModal(false);
      
      // 상태 초기화
      setSelectedGroupMembers([]);
      setGroupChatName('');

      // Socket.IO 채팅방 입장
      if (socket) {
        if (selectedChatRoom) {
          socket.emit('leave_room', selectedChatRoom);
        }
        socket.emit('join_room', chatRoom.id);
        // DB에서 메시지 로드
        loadMessages(chatRoom.id);
      }
    } catch (error) {
      console.error('그룹 채팅방 생성 실패:', error);
    }
  };

  const toggleGroupMember = (friend: Friend) => {
    setSelectedGroupMembers(prev => {
      const isSelected = prev.find(f => f.id === friend.id);
      if (isSelected) {
        return prev.filter(f => f.id !== friend.id);
      } else {
        return [...prev, friend];
      }
    });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/auth/signup`, signupForm);
      setMessage('회원가입 성공! 로그인해주세요.');
      setIsSignup(false);
      setSignupForm({ username: '', password: '', email: '', status_message: '' });
    } catch (error: any) {
      setMessage(error.response?.data?.error || '회원가입 실패');
    }
  };

  const handleLogout = () => {
    // Socket 연결 해제
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    
    // 로컬 데이터 정리
    localStorage.removeItem('token');
    setUser(null);
    setIsLoggedIn(false);
    setAuthToken(null);
    setMessage('');
    setFriends([]);
    setMessages([]);
    setActiveTab('friends');
  };

const handleStatusMessageUpdate = async () => {
  if (!user || newStatusMessage.length > 60) {
    setMessage('상태메시지는 60자 이내여야 합니다.');
    setTimeout(() => setMessage(''), 3000); 
    return;
  }
  
  const authToken = localStorage.getItem('token');
  
  if (!authToken) {
      setMessage('인증 토큰이 없습니다. 다시 로그인해주세요.');
      setTimeout(() => setMessage(''), 3000);
      return;
  }
  
  try {
    const response = await axios.put(`${API_BASE_URL}/auth/profile`, 
      { status_message: newStatusMessage }, // 업데이트할 필드만 전송
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    setUser(prevUser => ({ 
      ...prevUser!, 
      status_message: newStatusMessage // 입력한 새 메시지로 직접 업데이트
    }));
    
    setMessage('상태메시지가 성공적으로 변경되었습니다.');
    setTimeout(() => setMessage(''), 3000);
    
    setShowStatusMessageModal(false);

  } catch (error) {
    // API 호출 실패 시 에러 처리 및 상세 로그 출력
    console.error('상태메시지 변경 실패 (API 호출 오류):', error);
    if (axios.isAxiosError(error) && error.response) {
      const errorMessage = error.response.data?.message || `(코드: ${error.response.status})`;
      // 404 오류는 이제 발생하지 않아야 하지만, 다른 인증 오류(401, 403)를 대비합니다.
      if (error.response.status === 404) {
          setMessage(`상태메시지 변경에 실패했습니다. (코드: 404) - 백엔드 API 경로(PUT /api/auth/profile)를 확인해주세요.`);
      } else if (error.response.status === 401 || error.response.status === 403) {
          setMessage(`상태메시지 변경에 실패했습니다. (인증 오류) - 다시 로그인해주세요.`);
      } else {
          setMessage(`상태메시지 변경에 실패했습니다. ${errorMessage}`);
      }
      console.error('서버 응답 데이터:', error.response.data);
    } else {
      setMessage('상태메시지 변경에 실패했습니다. (네트워크 연결 확인)');
    }
    setTimeout(() => setMessage(''), 5001);
  }
};

  const loadFriends = async (token?: string) => {
    try {
      const currentToken = token || authToken;
      if (!currentToken) {
        console.error('토큰이 없습니다.');
        return;
      }
      
      const response = await axios.get(`${API_BASE_URL}/friends/list`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      setFriends(response.data.friends || []);
      console.log('친구 목록 로드 성공:', response.data.friends);
    } catch (error) {
      console.error('친구 목록 로드 실패:', error);
    }
  };

  const loadChatRooms = async (token?: string) => {
    try {
      const currentToken = token || authToken;
      if (!currentToken) {
        console.error('토큰이 없습니다.');
        return;
      }
      
      const response = await axios.get(`${API_BASE_URL}/chat-rooms/list`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      setChatRooms(response.data.chatRooms || []);
      console.log('채팅방 목록 로드 성공:', response.data.chatRooms);
    } catch (error) {
      console.error('채팅방 목록 로드 실패:', error);
    }
  };

  // 채팅방의 메시지 로드
  const loadMessages = async (roomId: number) => {
    try {
      console.log('메시지 로드 시작 - 채팅방 ID:', roomId);
      if (!authToken) {
        console.error('토큰이 없습니다.');
        return;
      }
      
      const response = await axios.get(`${API_BASE_URL}/messages/room/${roomId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      console.log('메시지 API 응답:', response.data);
      setMessages(response.data.messages || []);
      console.log('메시지 로드 성공:', response.data.messages?.length || 0, '개');
      
      // 메시지 로드 후 스크롤을 맨 아래로
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('메시지 로드 실패:', error);
      setMessages([]);
    }
  };

  // 채팅방 나가기
  const leaveChatRoom = async (roomId: number) => {
    try {
      if (!authToken) {
        console.error('토큰이 없습니다.');
        return;
      }
      
      await axios.post(`${API_BASE_URL}/chat-rooms/${roomId}/leave`, {}, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      console.log('채팅방 나가기 성공:', roomId);
      
      // 현재 채팅방에서 나간 경우 채팅방에서 나가기
      if (selectedChatRoom === roomId) {
        setShowChatRoom(false);
        setSelectedChatRoom(null);
        setCurrentChatFriend(null);
        setMessages([]);
      }
      
      // 채팅방 목록 새로고침
      loadChatRooms();
    } catch (error) {
      console.error('채팅방 삭제 실패:', error);
      alert('채팅방 삭제에 실패했습니다.');
    }
  };

  const addFriend = async () => {
    try {
      if (!authToken) {
        setMessage('로그인이 필요합니다.');
        return;
      }
      
      await axios.post(`${API_BASE_URL}/friends/add`, {
        friend_username: friendUsername
      }, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      setMessage('친구 추가 성공!');
      setShowAddFriend(false);
      setFriendUsername('');
      // 친구 추가 후 목록 새로고침
      loadFriends(authToken);
    } catch (error: any) {
      console.log('친구 추가 에러:', error.response);
      if (error.response?.status === 409) {
        setMessage('이미 친구로 등록된 사용자입니다.');
      } 
      else if(error.response?.status === 404) {
        setMessage('존재하지 않는 사용자입니다.')
      }
      else if(error.response?.status === 400) {
        setMessage('자기 자신을 친구로 등록할 수 없습니다.')
      } else 
        { setMessage(error.response?.data?.error || '친구 추가 실패');
      }
    }
  };
  
  // 채팅 탭 활성화 시 채팅방 목록 새로고침
  useEffect(() => {
    if (isLoggedIn && activeTab === 'chats' && authToken) {
      console.log('채팅 탭 활성화 - 채팅방 목록 새로고침');
      loadChatRooms();
    }
  }, [activeTab, isLoggedIn, authToken]);

  // 주기적 채팅방 목록 업데이트 (3초마다)
  useEffect(() => {
    if (!isLoggedIn || !authToken) return;

    const intervalId = setInterval(() => {
      if (activeTab === 'chats') {
        console.log('주기적 채팅방 목록 업데이트');
        loadChatRooms();
      }
    }, 3000); // 3초마다

    return () => clearInterval(intervalId);
  }, [isLoggedIn, authToken, activeTab]);

  useEffect(() => {
    if (!isLoggedIn || !showChatRoom || !selectedChatRoom) {
        return;
    }

    // 2. 3초마다 loadMessages 호출
    const intervalId = setInterval(() => {
        loadMessages(selectedChatRoom); 
        console.log(`[Polling] ${selectedChatRoom}번 방 메시지 새로고침`);
    }, 3000);

    // 3. 클린업: 컴포넌트가 언마운트되거나 의존성(방 ID, 열림 상태)이 변경되면 타이머를 정리합니다.
    return () => clearInterval(intervalId);
    
}, [isLoggedIn, showChatRoom, selectedChatRoom]);

  if (!isLoggedIn) {
    return (
      <div className="App">
        {/* 화면 크기를 제한하는 컨테이너 */}
        <div className="app-container"> 
          <div className="auth-screen">
            {!isSignup ? (
              // 실제 카카오톡 로그인 화면
              <div className="login-container">
                {/* TALK 로고 */}
                <div>
                  <img src="/images/logo.png" alt="KakaoTalk Logo" className="logo-image" /> 
                </div>

                {/* 로그인 폼 */}
                <form onSubmit={handleLogin} className="login-form">
                  <input
                    type="text"
                    placeholder="카카오계정 (이메일 또는 전화번호)"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                    className="login-input"
                    required
                  />
                  <input
                    type="password"
                    placeholder="비밀번호"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                    className="login-input"
                    required
                  />
                  <button type="submit" className="kakao-login-btn">
                    로그인
                  </button>
                </form>

                {/* 구분선 */}
                <div className="login-divider">
                  <div className="divider-line"></div>
                  <span className="divider-text">또는</span>
                  <div className="divider-line"></div>
                </div>

                {/* QR 코드 로그인 */}
                <button className="qr-login-btn">
                  📱 QR코드 로그인
                </button>

                {/* 자동 로그인 */}
                <div className="auto-login-section">
                  <div className="auto-login-checkbox"></div> 
                  <span className="auto-login-text">자동 로그인</span>
                </div>

                {/* 에러 메시지 */}
                {message && <div className="error-message">{message}</div>}

                {/* 하단 링크 */}
                <div className="bottom-links">
                  <span className="bottom-link" onClick={() => setIsSignup(true)}>
                    회원가입
                  </span>
                  <span className="bottom-link">
                    비밀번호 재설정
                  </span>
                </div>
              </div>
            ) : (
              // 회원가입 화면
              <div className="signup-container">
                <div className="signup-header">
                  {/* 회원가입 kakao 로고 */}
                  <img src="/images/signup_kakao_logo.png" alt="KakaoTalk" className="signup-logo" /> 
                  <h1>카카오톡을 시작합니다</h1>
                  <p>사용하실 이메일과 비밀번호를<br />입력해 주세요.</p>
                </div>
                <form onSubmit={handleSignup} className="signup-form">
                  <div className="input-group">
                    <label>사용자명</label>
                    <input
                      type="text"
                      value={signupForm.username}
                      onChange={(e) => setSignupForm({...signupForm, username: e.target.value})}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>이메일</label>
                    <input
                      type="email"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm({...signupForm, email: e.target.value})}
                    />
                  </div>
                  <div className="input-group">
                    <label>비밀번호</label>
                    <input
                      type="password"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm({...signupForm, password: e.target.value})}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>상태메시지</label>
                    <input
                      type="text"
                      value={signupForm.status_message}
                      onChange={(e) => setSignupForm({...signupForm, status_message: e.target.value})}
                      placeholder="상태메시지를 입력하세요"
                    />
                  </div>
                  <button type="submit" className="signup-btn">회원가입</button>
                </form>
                
                {message && <div className="error-message">{message}</div>}
                
                <div className="auth-links">
                  <span 
                    className="login-link" 
                    onClick={() => setIsSignup(false)}
                  >
                    로그인으로 돌아가기
                  </span>
                </div>
              </div>
            )}
          </div>
        </div> 
      </div>
    );
  }

  // 채팅방이 열려있을 때 채팅 UI
  if (showChatRoom && currentChatFriend) {
    const currentRoom = chatRooms.find(r => r.id === selectedChatRoom);
    const memberCount = currentRoom?.participants?.length || 2;
    return (
      <div className="App chat-mode">
        <div className="chat-room">
          {/* 채팅방 헤더 */}
          <div className="chat-header">
            <div className="chat-header-left">
              <button 
                className="back-btn" 
                onClick={() => {
                  setShowChatRoom(false);
                  setCurrentChatFriend(null);
                  if (socket && selectedChatRoom) {
                    socket.emit('leave_room', selectedChatRoom);
                  }
                  setSelectedChatRoom(null);
                  setChatRooms([]); 
                  loadChatRooms();
                }}
              >
                ←
              </button>
              <img 
                src={currentChatFriend.profile_image || "/images/baseProfile.jpg"} 
                alt="프로필" 
                className="chat-profile-img"
              />
              <div className="chat-info">
                <h3 className="chat-friend-name">{currentChatFriend.username}</h3>
                <span className="chat-member-count">채팅방 인원: {memberCount}명</span>
              </div>
            </div>
            <div className="chat-header-right">
              <button className="header-icon-btn">🔍</button>
              <button className="header-icon-btn">📞</button>
              <button className="header-icon-btn">📹</button>
              <button className="header-icon-btn">☰</button>
            </div>
          </div>

          {/* 채팅 메시지 영역 */}
          <div className="chat-messages">
            {/* 메시지 목록 */}
            <div className="messages-container">
              {(() => {
                // 메시지를 날짜별로 그룹화
                const groupedMessages: { [key: string]: Message[] } = {};
                messages.forEach((message) => {
                  const date = new Date(message.created_at);
                  const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
                  if (!groupedMessages[dateKey]) {
                    groupedMessages[dateKey] = [];
                  }
                  groupedMessages[dateKey].push(message);
                });

                // 날짜별로 렌더링
                return Object.keys(groupedMessages).map((dateKey) => {
                  const messagesForDate = groupedMessages[dateKey];
                  const firstMessage = messagesForDate[0];
                  
                  // 유효성 검사 (첫 메시지가 없을 경우 렌더링 생략)
                  if (!firstMessage) return null; 

                  const date = new Date(firstMessage.created_at);
                  const dateString = date.toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long'
                  });

                  return (
                    <React.Fragment key={dateKey}>
                      {/* 날짜 구분선 */}
                      <div className="date-divider">
                        📅 {dateString}
                      </div>

                      {/* 해당 날짜의 메시지들: 이름 표시 로직이 인라인으로 직접 적용됨 */}
                      {messagesForDate.map((message, index) => {
                        // 내 메시지 여부
                        const isMyMessage = message.sender_id === user?.id;
                        // 발신자 정보 (상대방 채팅일 경우 currentChatFriend 사용)
                        const sender = isMyMessage ? user : currentChatFriend;

                        return (
                          <div 
                            key={message.id || index} 
                            // 기존 CSS 클래스 유지 + 정렬만 Tailwind로
                            className={`message mb-3 px-3 ${isMyMessage ? 'my-message justify-end' : 'friend-message justify-start'}`}
                          >
                            {/* 1. 상대방 메시지일 경우에만 프로필 표시 */}
                            {!isMyMessage && (
                              <img 
                                // message 객체에 sender_profile_image가 있다면 사용, 아니면 friend의 이미지 사용
                                src={message.sender_profile_image || currentChatFriend?.profile_image || "/images/baseProfile.jpg"} 
                                alt="프로필" 
                                className="message-profile-img" // 기존 스타일 클래스 사용
                              />
                            )}
                            
                            {/* 2. 메시지 내용, 이름, 시간 래퍼 */}
                            <div className="message-content">
                                {/* ⭐️ 2-1. 상대방 메시지일 경우에만 이름 표시 ⭐️ */}
                                {!isMyMessage && (
                                    <div className="message-sender-name">
                                        {message.sender_username}
                                    </div>
                                )}
                                
                                {/* 2-2. 버블과 시간 */}
                                <div className="message-info-wrapper"> {/* Flex 정렬을 위한 래퍼 */}
                                    <div className={`message-bubble ${isMyMessage ? 'my-bubble' : 'friend-bubble'}`}>
                                        {message.content}
                                    </div>
                                    <div className="message-info">
                                        {/* 읽지 않은 사용자 수 표시 */}
                                        {message.unread_count !== undefined && message.unread_count > 0 && (
                                          <span className="unread-count">{message.unread_count}</span>
                                        )}
                                        <div className="message-time">
                                            {new Date(message.created_at).toLocaleTimeString('ko-KR', { 
                                                hour: '2-digit', 
                                                minute: '2-digit',
                                                hour12: true 
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                });
              })()}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 메시지 입력창 */}
          <div className="chat-input-area">
            <div className="input-toolbar">
              <button className="toolbar-btn">😊</button>
              <button className="toolbar-btn">📋</button>
              <button className="toolbar-btn">💬</button>
              <button className="toolbar-btn">📁</button>
              <button className="toolbar-btn">📷</button>
              <button className="toolbar-btn">🔄</button>
              <button className="toolbar-btn">😀</button>
            </div>
            <div className="input-container">
              <input
                type="text"
                placeholder="메시지 입력"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    sendMessage();
                  }
                }}
                className="message-input"
              />
              <button 
                onClick={sendMessage}
                className="send-btn"
                disabled={!currentMessage.trim()}
              >
                전송
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  

  // 메인 카카오톡 UI (실제 PC 버전 스타일)
  return (
    <div className="App">
      <div className="kakao-main">
        {/* 왼쪽 탭 사이드바 */}
        <div className="left-sidebar">
          <button 
            className={`tab-item ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            <span className="tab-icon">👥</span>
          </button>
          <button 
            className={`tab-item ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveTab('chats')}
          >
            <span className="tab-icon">💬</span>
          </button>
          <button 
            className={`tab-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <span className="tab-icon">⚙️</span>
          </button>
          
          {/* 하단에 프로필 버튼 */}
          <div style={{marginTop: 'auto', marginBottom: '20px'}}>
            <button 
              className="tab-item" 
              onClick={() => setShowProfile(true)}
              style={{background: 'none'}}
            >
              <img 
                src={user?.profile_image || "/images/baseProfile.jpg"} 
                alt="Profile" 
                style={{width: '32px', height: '32px', borderRadius: '8px'}}
              />
            </button>
          </div>
        </div>

        {/* 메인 컨테이너 */}
        <div className="main-container">
          {/* 친구 탭 */}
          {activeTab === 'friends' && (
            <>
              <div className="friends-sidebar">
                <div className="friends-header">
                  <h2 className="friends-title">친구</h2>
                  <div className="header-actions">
                    <button className="header-btn" onClick={() => setShowAddFriend(true)}>
                      👤+
                    </button>
                    <button className="header-btn" onClick={() => setShowGroupChatModal(true)}>
                      👥
                    </button>
                    <button className="header-btn">🔍</button>
                  </div>
                </div>

                {/* 내 프로필 */}
                <div className="my-profile-section" onClick={() => {
                  setSelectedProfileUser(user); 
                  setShowProfile(true);
                  }}
                  >
                  <img 
                    src={user?.profile_image || "/images/baseProfile.jpg"} 
                    alt="내 프로필" 
                    className="profile-image" 
                  />
                  <div className="profile-info">
                    <div className="profile-name">{user?.username}</div>
                    <div className="profile-status">{user?.status_message || '상태메시지 없음'}</div>
                  </div>
                </div>

                {/* 친구 목록 */}
                <div className="friends-content">
                  {friends.map((friend) => (
                    <div 
                      key={friend.id} 
                      className="friend-item"
                      onClick={() => {
                        setSelectedFriend(friend);
                        setSelectedProfileUser(friend);
                        setShowProfile(true);
                      }}
                    >
                      <img 
                        src={friend.profile_image || "/images/baseProfile.jpg"} 
                        alt="친구" 
                        className="profile-image"
                      />
                      <div className="profile-info">
                        <div className="profile-name">{friend.username}</div>
                        <div className="profile-status">{friend.status_message || '상태메시지 없음'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 우측 안내 영역 */}
              <div className="right-content">
                <div className="welcome-text">
                  <h3>친구를 추가해 보세요</h3>
                  <p>우측 상단의 친구 추가 버튼을 눌러<br />전화번호와 카카오톡 ID로 친구를 찾아보세요.</p>
                </div>
              </div>
            </>
          )}

          {/* 채팅 탭 */}
          {activeTab === 'chats' && (
            <>
              <div className="friends-sidebar">
                <div className="friends-header">
                  <h2 className="friends-title">채팅</h2>
                  <div className="header-actions">
                    <button className="header-btn" onClick={() => setShowGroupChatModal(true)}>
                      👥
                    </button>
                    <button className="header-btn">🔍</button>
                  </div>
                </div>

                {/* 채팅방 목록 */}
                <div className="friends-content">
                  {chatRooms.length > 0 ? (
                    chatRooms.map((room) => (
                      <div 
                        key={room.id} 
                        className={`chat-room-item ${room.unread_count && room.unread_count > 0 ? 'has-unread' : ''}`}
                      >
                        <div 
                          className="chat-room-content"
                          onClick={() => {
                            console.log('채팅방 목록에서 클릭:', room.id);
                            const roomFriend = room.participants?.find((p: any) => p.id !== user?.id) || 
                                              { username: room.room_name || '그룹채팅', id: room.id, profile_image: undefined };
                            
                            if (socket) {
                              if (selectedChatRoom) {
                                console.log('이전 채팅방에서 나가기:', selectedChatRoom);
                                socket.emit('leave_room', selectedChatRoom);
                              }
                              
                              console.log('새 채팅방 참여:', room.id);
                              socket.emit('join_room', room.id);
                              setSelectedChatRoom(room.id);
                              setCurrentChatFriend(roomFriend as Friend);
                              setShowChatRoom(true);
                              loadMessages(room.id);
                              
                              // 채팅방 입장 시 모든 메시지 읽음 처리
                              axios.post(`${API_BASE_URL}/messages/read-all/${room.id}`, {}, {
                                headers: { 'Authorization': `Bearer ${authToken}` }
                              }).catch(err => console.error('읽음 처리 실패:', err));
                            }
                          }}
                        >
                          <img 
                            src={room.participants?.find((p: any) => p.id !== user?.id)?.profile_image || "/images/baseProfile.jpg"} 
                            alt="채팅방" 
                            className="profile-image"
                          />
                          <div className="profile-info">
                            <div className="profile-name">
                              {
                              room.participants && room.participants.length > 2
                              ? (room.room_name || `그룹채팅 (${room.participants.length}명)`)
                              : room.participants?.find((p: any) => p.id !== user?.id)?.username || '알 수 없는 채팅방'
                              }
                            </div>
                            <div className="profile-status">
                              {room.last_message || '아직 메시지가 없습니다'}
                            </div>
                          </div>
                          
                          {/* 오른쪽 정보 영역 */}
                          <div className="chat-room-right">
                            {room.last_message_time && (
                              <span className="room-time">
                                {new Date(room.last_message_time).toLocaleTimeString('ko-KR', { 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  hour12: true 
                                })}
                              </span>
                            )}
                            {room.unread_count && room.unread_count > 0 && (
                              <div className="unread-badge">{room.unread_count}</div>
                            )}
                          </div>
                        </div>
                        
                        <button 
                          className="chat-room-leave-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('이 채팅방을 나가시겠습니까?')) {
                              leaveChatRoom(room.id);
                            }
                          }}
                          title="채팅방 나가기"
                        >
                          🚪
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <p>아직 채팅방이 없습니다</p>
                      <p>친구와 채팅을 시작해보세요!</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 설정 탭 */}
          {activeTab === 'settings' && (
            <div className="welcome-screen">
              <div className="welcome-content">
                <h2>설정</h2>
                <button onClick={handleLogout} className="logout-btn">로그아웃</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 모달들 */}
      {showAddFriend && (
        <div className="modal-overlay" onClick={() => setShowAddFriend(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>친구 추가</h3>
              <button className="close-btn" onClick={() => setShowAddFriend(false)}>×</button>
            </div>
            <div className="modal-content">
              <input
                type="text"
                placeholder="친구의 사용자명을 입력하세요"
                value={friendUsername}
                onChange={(e) => setFriendUsername(e.target.value)}
                className="modal-input"
              />
              <button onClick={addFriend} className="modal-btn">친구 추가</button>
            </div>
          </div>
        </div>
      )}

      {showProfile && selectedProfileUser && (
  <div className="modal-overlay" onClick={() => setShowProfile(false)}>
    <div className="modal friend-profile-modal" onClick={(e) => e.stopPropagation()}>
      <div className="friend-profile-header">
        <img 
          src={selectedProfileUser.profile_image || "/images/baseProfile.jpg"} 
          alt="프로필" 
          className="friend-profile-img"
        />
        <div className="friend-info">
          <h2 className="friend-name">{selectedProfileUser.username}</h2>
          
          {/* 상태메시지 영역: 클릭 기능 제거 (요청 반영) */}
          <p 
            className="friend-status"
          >
            {selectedProfileUser.status_message || '상태메시지 없음'}
          </p>
          
        </div>
        <button className="close-btn" onClick={() => setShowProfile(false)}>×</button>
      </div>
      
      {/* 액션 버튼 영역: "상태메시지 변경" 버튼만 유일한 진입점으로 유지 */}
      <div className="friend-profile-actions">
        {user && selectedProfileUser.id === user.id ? (
          // 내 프로필일 경우: "상태메시지 변경" 버튼만 표시
          <>
            <button 
              className="chat-start-btn" // 스타일 재사용
              onClick={() => {
                if (user) {
                  setNewStatusMessage(user.status_message || '');
                  setShowProfile(false); // 1. 프로필 모달 닫기
                  setShowStatusMessageModal(true); // 2. 편집 모달 열기
                }
              }}
            >
              📝 상태메시지 변경
            </button> 
          </>
        ) : (
          // 친구 프로필일 경우: 기존 1:1 채팅, 통화 버튼 유지
          <>
            <button 
              className="chat-start-btn" 
              onClick={() => startChat(selectedProfileUser)}
            >
              💬 1:1 채팅
            </button>
            <button className="voice-call-btn">
              📞 통화
            </button>
          </>
        )}
      </div>
    </div>
  </div>
)}

      {/* 그룹 채팅 생성 모달 */}
      {showGroupChatModal && (
        <div className="modal-overlay" onClick={() => setShowGroupChatModal(false)}>
          <div className="modal group-chat-modal" onClick={(e) => e.stopPropagation()}>
            <h3>그룹 채팅방 만들기</h3>
            <input
              type="text"
              placeholder="그룹 채팅방 이름을 입력하세요"
              value={groupChatName}
              onChange={(e) => setGroupChatName(e.target.value)}
              className="modal-input"
            />
            <div className="friend-selection">
              <h4>친구 선택</h4>
              <div className="friend-list">
                {friends.map((friend) => (
                  <div 
                    key={friend.id} 
                    className={`selectable-friend ${selectedGroupMembers.find(f => f.id === friend.id) ? 'selected' : ''}`}
                    onClick={() => toggleGroupMember(friend)}
                  >
                    <img 
                      src={friend.profile_image || "/images/baseProfile.jpg"} 
                      alt="친구" 
                      className="profile-image-small"
                    />
                    <span className="friend-name">{friend.username}</span>
                    {selectedGroupMembers.find(f => f.id === friend.id) && (
                      <span className="selected-check">✓</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="selected-members">
                선택된 친구: {selectedGroupMembers.length}명
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowGroupChatModal(false)} className="cancel-btn">취소</button>
              <button onClick={createGroupChat} className="create-btn">만들기</button>
            </div>
          </div>
        </div>
      )}

      {/* 상태메시지 변경 모달 */}
{showStatusMessageModal && user && (
  <div className="modal-overlay">
    <div className="modal-content status-message-modal">
      <h4>상태메시지 변경</h4>
      <textarea
        value={newStatusMessage}
        onChange={(e) => setNewStatusMessage(e.target.value)}
        maxLength={60}
        placeholder="새로운 상태메시지를 입력하세요 (최대 60자)"
      />
      <div className="modal-actions">
        <button 
          onClick={() => setShowStatusMessageModal(false)} 
          className="cancel-btn"
        >
          취소
        </button>
        <button 
          onClick={handleStatusMessageUpdate} 
          className="create-btn"
        >
          저장
        </button>
      </div>
    </div>
  </div>
)}

      {/* 알림 */}
      {message && (
        <div className="notification">
          {message}
        </div>
      )}
    </div>
  );
};

export default App;
