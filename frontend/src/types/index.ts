// 데이터베이스 스키마와 일치하는 TypeScript 인터페이스

// 사용자 인터페이스 (users 테이블)
export interface User {
  id: number;
  username: string;
  email?: string;
  profile_image?: string;
  status_message?: string;
  created_at: string;
}

// 인증용 사용자 인터페이스 (password_hash 포함)
export interface UserWithAuth extends User {
  password_hash: string;
}

// 친구 관계 인터페이스 (friends 테이블)
export interface Friend {
  id: number;
  user_id: number;
  friend_id: number;
  created_at: string;
}

// 친구 목록용 인터페이스 (JOIN된 결과)
export interface FriendWithInfo {
  id: number;
  username: string;
  profile_image?: string;
  status_message?: string;
}

// 채팅방 인터페이스 (chat_rooms 테이블)
export interface ChatRoom {
  id: number;
  room_name?: string;
  created_at: string;
}

// 채팅방 멤버 인터페이스 (chat_room_members 테이블)
export interface ChatRoomMember {
  id: number;
  room_id: number;
  user_id: number;
  joined_at: string;
}

// 채팅방 멤버 정보 포함 인터페이스 (JOIN된 결과)
export interface ChatRoomMemberWithInfo {
  id: number;
  username: string;
  profile_image?: string;
  status_message?: string;
  joined_at: string;
}

// 상세 채팅방 정보 인터페이스
export interface ChatRoomDetail extends ChatRoom {
  members: ChatRoomMemberWithInfo[];
}

// 메시지 타입
export type MessageType = 'text' | 'image' | 'file';

// 메시지 인터페이스 (messages 테이블)
export interface Message {
  id: number;
  room_id: number;
  sender_id: number;
  message_type: MessageType;
  content: string;
  created_at: string;
}

// 메시지 전송자 정보 포함 인터페이스 (JOIN된 결과)
export interface MessageWithSender extends Message {
  sender_username: string;
  sender_profile_image?: string;
}

// API 응답 인터페이스들

// 공통 API 응답
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

// 인증 관련 API 응답
export interface AuthResponse extends ApiResponse {
  token?: string;
  user?: User;
}

// 친구 목록 API 응답
export interface FriendsResponse extends ApiResponse {
  friends: FriendWithInfo[];
}

// 채팅방 목록 API 응답
export interface ChatRoomsResponse extends ApiResponse {
  chat_rooms: ChatRoom[];
}

// 메시지 목록 API 응답
export interface MessagesResponse extends ApiResponse {
  messages: MessageWithSender[];
}

// 로그인 요청 데이터
export interface LoginRequest {
  username: string;
  password: string;
}

// 회원가입 요청 데이터
export interface SignupRequest {
  username: string;
  password: string;
  email?: string;
  status_message?: string;
}

// 친구 추가 요청 데이터
export interface AddFriendRequest {
  friend_username: string;
}

// 프로필 업데이트 요청 데이터
export interface UpdateProfileRequest {
  profile_image?: string;
  status_message?: string;
}

// 채팅방 생성 요청 데이터
export interface CreateChatRoomRequest {
  room_name?: string;
  member_ids?: number[];
}

// 메시지 전송 요청 데이터
export interface SendMessageRequest {
  room_id: number;
  message_type?: MessageType;
  content: string;
}

// Socket.IO 이벤트 타입들
export interface SocketEvents {
  // 클라이언트에서 서버로
  'join-room': (room_id: number) => void;
  'leave-room': (room_id: number) => void;
  'send-message': (message: SendMessageRequest) => void;
  
  // 서버에서 클라이언트로
  'message-received': (message: MessageWithSender) => void;
  'user-joined': (user: User, room_id: number) => void;
  'user-left': (user: User, room_id: number) => void;
  'typing': (user: User, room_id: number) => void;
  'stop-typing': (user: User, room_id: number) => void;
}