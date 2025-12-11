const connection = require('../config/database');

// 메시지 생성
exports.createMessage = (room_id, sender_id, message_type, content, callback) => {
  const query = 'INSERT INTO messages (room_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)';
  connection.query(query, [room_id, sender_id, message_type, content], callback);
};

// 채팅방의 메시지 조회 (읽지 않은 사용자 수 포함)
exports.getMessagesByRoomIdWithUnreadCount = (room_id, user_id, limit, offset, callback) => {
  const query = `
    SELECT 
      m.id,
      m.room_id,
      m.sender_id,
      u.username as sender_username,
      u.profile_image as sender_profile_image,
      m.message_type,
      m.content,
      m.created_at,
      (
        SELECT COUNT(DISTINCT crm.user_id)
        FROM chat_room_members crm
        WHERE crm.room_id = m.room_id
        AND crm.user_id != m.sender_id
        AND NOT EXISTS (
          SELECT 1 FROM message_reads mr
          WHERE mr.message_id = m.id
          AND mr.user_id = crm.user_id
        )
      ) as unread_count
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.room_id = ?
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `;
  connection.query(query, [room_id, limit, offset], callback);
};

// 채팅방의 메시지 조회 (기본 버전 - 읽지 않은 사용자 수 포함)
exports.getMessagesByRoomId = (room_id, user_id, callback) => {
  const query = `
    SELECT 
      m.id,
      m.room_id,
      m.sender_id,
      u.username as sender_username,
      u.profile_image as sender_profile_image,
      m.message_type,
      m.content,
      m.created_at,
      (
        SELECT COUNT(DISTINCT crm.user_id)
        FROM chat_room_members crm
        WHERE crm.room_id = m.room_id
        AND crm.user_id != m.sender_id
        AND NOT EXISTS (
          SELECT 1 FROM message_reads mr
          WHERE mr.message_id = m.id
          AND mr.user_id = crm.user_id
        )
      ) as unread_count
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.room_id = ?
    ORDER BY m.created_at ASC
  `;
  connection.query(query, [room_id], callback);
};

// 메시지 읽음 처리
exports.markMessageAsRead = (message_id, user_id, callback) => {
  // 중복 체크 후 삽입
  const checkQuery = 'SELECT COUNT(*) as count FROM message_reads WHERE message_id = ? AND user_id = ?';
  connection.query(checkQuery, [message_id, user_id], (err, result) => {
    if (err) return callback(err);
    
    if (result[0].count === 0) {
      const insertQuery = 'INSERT INTO message_reads (message_id, user_id) VALUES (?, ?)';
      connection.query(insertQuery, [message_id, user_id], callback);
    } else {
      callback(null, { alreadyRead: true });
    }
  });
};

// 채팅방의 모든 메시지 읽음 처리
exports.markAllMessagesAsRead = (room_id, user_id, callback) => {
  const query = `
    INSERT INTO message_reads (message_id, user_id)
    SELECT m.id, ?
    FROM messages m
    WHERE m.room_id = ?
    AND m.sender_id != ?
    AND NOT EXISTS (
      SELECT 1 FROM message_reads mr
      WHERE mr.message_id = m.id
      AND mr.user_id = ?
    )
  `;
  connection.query(query, [user_id, room_id, user_id, user_id], callback);
};

// 읽지 않은 메시지 수 조회
exports.getUnreadMessageCount = (room_id, user_id, callback) => {
  const query = `
    SELECT COUNT(*) as unread_count
    FROM messages m
    WHERE m.room_id = ?
    AND m.sender_id != ?
    AND NOT EXISTS (
      SELECT 1 FROM message_reads mr
      WHERE mr.message_id = m.id
      AND mr.user_id = ?
    )
  `;
  connection.query(query, [room_id, user_id, user_id], callback);
};

// 특정 메시지 조회
exports.getMessageById = (message_id, callback) => {
  const query = `
    SELECT 
      m.id,
      m.room_id,
      m.sender_id,
      u.username as sender_username,
      u.profile_image as sender_profile_image,
      m.message_type,
      m.content,
      m.created_at
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.id = ?
  `;
  connection.query(query, [message_id], callback);
};