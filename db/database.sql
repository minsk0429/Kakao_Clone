USE kakao;

-- 사용자 테이블: 유저 정보
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,           -- 고유 ID
  username VARCHAR(50) NOT NULL UNIQUE,       -- 유저 이름
  email VARCHAR(100) UNIQUE,                  -- 이메일 (선택)
  password_hash VARCHAR(255) NOT NULL,        -- 비밀번호 암호화 값
  profile_image VARCHAR(255),                 -- 프로필 사진 URL
  status_message VARCHAR(255),                -- 상태 메시지
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 친구 관계 테이블
CREATE TABLE friends (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,                        -- 본인
  friend_id INT NOT NULL,                      -- 친구
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (friend_id) REFERENCES users(id)
);

-- 채팅방 테이블
CREATE TABLE chat_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_name VARCHAR(100),                      -- 채팅방 이름 (그룹채팅용)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 메시지 테이블
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,                        -- 메시지가 속한 채팅방
  sender_id INT NOT NULL,                      -- 보낸 사람 ID
  message_type ENUM('text','image','file') DEFAULT 'text',  -- 메시지 타입
  content TEXT,                                -- 메시지 내용
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- 채팅방 멤버 테이블
CREATE TABLE chat_room_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,                        -- 채팅방 ID
  user_id INT NOT NULL,                        -- 멤버 유저 ID
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  hidden BOOLEAN DEFAULT FALSE,                -- 사용자에게 채팅방 숨김 여부
  left_at TIMESTAMP NULL,                      -- 채팅방을 떠난 시간
  last_read_message_id INT NULL,			   -- 사용자가 마지막으로 읽은 메시지 ID *추가*
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
  );

-- 메시지 읽음 상태 테이블
CREATE TABLE message_reads (
id INT AUTO_INCREMENT PRIMARY KEY,
message_id INT NOT NULL,						-- 읽은 메시지 ID
user_id INT NOT NULL,							-- 읽은 사용자 ID
read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,	-- 읽은 시간 
FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
FOREIGN KEY (user_id) REFERENCES users(id),
UNIQUE KEY unique_read (message_id, user_id)	-- 중복 읽음 방지
);

-- 사용자 추가 예시
-- 첫 번째 사용자 추가
INSERT INTO users (username, email, password_hash, status_message) 
VALUES ('MINSEOK', 'MINSEOK@example.com', '0000', '테스트1!');

-- 두 번째 사용자 추가
INSERT INTO users (username, email, password_hash, status_message) 
VALUES ('SEUNGJUN', 'SEUNGJUN@example.com', '1111', '테스트2!');

-- 세 번째 사용자 추가
INSERT INTO users (username, email, password_hash, status_message) 
VALUES ('DAUN', 'DAUN@example.com', '2222', '테스트3!');

-- 추가된 사용자 확인
SELECT * FROM users;