// 데이터베이스 스키마와 일치하는 TypeScript 인터페이스들

// 사용자 인터페이스 (users 테이블)
export interface User {
  id: number;
  username: string;
  email?: string;
  password_hash?: string; // 보안상 일반적으로 프론트엔드에서는 사용하지 않음
  profile_image?: string;
  status_message?: string;
  created_at: string;
}

// 친구 관계 인터페이스 (friends 테이블)
export interface Friend {
  id: number;
  user_id: number;
  friend_id: number;
  created_at: string;
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

// 메시지 인터페이스 (messages 테이블)
export interface Message {
  id: number;
  room_id: number;
  sender_id: number;
  message_type: 'text' | 'image' | 'file';
  content: string;
  created_at: string;
}

// API 응답용 확장 인터페이스들
export interface UserProfile extends Omit<User, 'password_hash'> {
  // password_hash 제외한 사용자 프로필
}

export interface FriendWithProfile extends Friend {
  username: string;
  profile_image?: string;
  status_message?: string;
}

export interface MessageWithSender extends Message {
  sender_username: string;
  sender_profile_image?: string;
}

export interface ChatRoomWithMembers extends ChatRoom {
  members: UserProfile[];
}

// API 요청/응답 인터페이스들
export interface LoginRequest {
  username: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  password: string;
  email?: string;
  status_message?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: UserProfile;
  error?: string;
}

export interface AddFriendRequest {
  friend_username: string;
}

export interface SendMessageRequest {
  room_id: number;
  message_type?: 'text' | 'image' | 'file';
  content: string;
}

export interface CreateChatRoomRequest {
  room_name?: string;
  member_ids?: number[];
}

// API 응답 공통 인터페이스
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}