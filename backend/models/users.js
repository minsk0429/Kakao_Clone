const connection = require('../config/database');

// 사용자 생성 (회원가입)
exports.createUser = (username, password_hash, email = null, profile_image = null, status_message = null, callback) => {
  const query = 'INSERT INTO users (username, password_hash, email, profile_image, status_message) VALUES (?, ?, ?, ?, ?)';
  connection.query(query, [username, password_hash, email, profile_image, status_message], callback);
};

// 사용자명으로 사용자 찾기
exports.findByUsername = (username, callback) => {
  const query = 'SELECT id, username, email, profile_image, status_message, created_at FROM users WHERE username = ?';
  connection.query(query, [username], callback);
};

// 사용자 ID로 사용자 찾기
exports.findById = (id, callback) => {
  const query = 'SELECT id, username, email, profile_image, status_message, created_at FROM users WHERE id = ?';
  connection.query(query, [id], callback);
};

// 로그인용 사용자 찾기 (password_hash 포함)
exports.findByUsernameForAuth = (username, callback) => {
  const query = 'SELECT id, username, email, password_hash, profile_image, status_message, created_at FROM users WHERE username = ?';
  connection.query(query, [username], callback);
};

// 사용자 프로필 업데이트
exports.updateProfile = (id, profile_image, status_message, callback) => {
  const query = 'UPDATE users SET profile_image = ?, status_message = ? WHERE id = ?';
  connection.query(query, [profile_image, status_message, id], callback);
};

// 친구 추가
exports.addFriend = (user_id, friend_id, callback) => {
  const query = 'INSERT INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)';
  connection.query(query, [user_id, friend_id, friend_id, user_id], callback);
};

// 친구 관계 확인
exports.isFriend = (user_id, friend_id, callback) => {
  const query = 'SELECT COUNT(*) AS count FROM friends WHERE user_id = ? AND friend_id = ?';
  connection.query(query, [user_id, friend_id], callback);
};

// 친구 목록 조회
exports.getFriendsList = (user_id, callback) => {
  const query = `
    SELECT u.id, u.username, u.profile_image, u.status_message 
    FROM friends f 
    JOIN users u ON f.friend_id = u.id 
    WHERE f.user_id = ?
    ORDER BY u.username
  `;
  connection.query(query, [user_id], callback);
};