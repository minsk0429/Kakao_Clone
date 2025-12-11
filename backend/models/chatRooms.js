const connection = require('../config/database');

// 채팅방 생성
exports.createChatRoom = (room_name = null, callback) => {
  const query = 'INSERT INTO chat_rooms (room_name) VALUES (?)';
  connection.query(query, [room_name], callback);
};

// 채팅방 멤버 추가
exports.addChatRoomMember = (room_id, user_id, callback) => {
  const query = 'INSERT INTO chat_room_members (room_id, user_id) VALUES (?, ?)';
  connection.query(query, [room_id, user_id], callback);
};

// 채팅방 멤버 조회
exports.getChatRoomMembers = (room_id, callback) => {
  const query = `
    SELECT u.id, u.username, u.profile_image, u.status_message, crm.joined_at
    FROM chat_room_members crm
    JOIN users u ON crm.user_id = u.id
    WHERE crm.room_id = ?
    ORDER BY crm.joined_at
  `;
  connection.query(query, [room_id], callback);
};

// 사용자의 채팅방 목록 조회 (참가자 정보와 마지막 메시지 포함)
exports.getUserChatRooms = (user_id, callback) => {
  const query = `
    SELECT 
      cr.id, 
      cr.room_name, 
      cr.created_at,
      crm.left_at,
      (
        SELECT content 
        FROM messages 
        WHERE room_id = cr.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) as last_message,
      (
        SELECT created_at 
        FROM messages 
        WHERE room_id = cr.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) as last_message_time,
      (
        SELECT COUNT(*) 
        FROM messages m
        WHERE m.room_id = cr.id
        AND m.sender_id != ?
        AND m.id NOT IN (
          SELECT mr.message_id 
          FROM message_reads mr 
          WHERE mr.user_id = ?
        )
        AND (crm.left_at IS NULL OR m.created_at > crm.left_at)
      ) as unread_count
    FROM chat_room_members crm
    JOIN chat_rooms cr ON crm.room_id = cr.id
    WHERE crm.user_id = ? AND crm.hidden = FALSE
    ORDER BY COALESCE(
      (SELECT created_at FROM messages WHERE room_id = cr.id ORDER BY created_at DESC LIMIT 1),
      cr.created_at
    ) DESC
  `;
  connection.query(query, [user_id, user_id, user_id], (err, rooms) => {
    if (err) return callback(err);
    
    if (rooms.length === 0) {
      return callback(null, []);
    }
    
    // 각 채팅방의 참가자 정보를 가져옴
    let processedCount = 0;
    const roomsWithParticipants = [];
    
    rooms.forEach((room, index) => {
      const participantsQuery = `
        SELECT u.id, u.username, u.profile_image, u.status_message
        FROM chat_room_members crm
        JOIN users u ON crm.user_id = u.id
        WHERE crm.room_id = ?
      `;
      
      connection.query(participantsQuery, [room.id], (err, participants) => {
        if (err) {
          console.error('참가자 조회 오류:', err);
          participants = [];
        }
        
        roomsWithParticipants[index] = {
          ...room,
          participants: participants || []
        };
        
        processedCount++;
        if (processedCount === rooms.length) {
          callback(null, roomsWithParticipants);
        }
      });
    });
  });
};

// 채팅방 정보 조회
exports.getChatRoomById = (room_id, callback) => {
  const query = 'SELECT id, room_name, created_at FROM chat_rooms WHERE id = ?';
  connection.query(query, [room_id], callback);
};

// 두 사용자 간의 기존 1:1 채팅방 찾기
exports.findPrivateChatRoom = (user1_id, user2_id, callback) => {
  const query = `
    SELECT cr.id, cr.room_name, cr.created_at
    FROM chat_rooms cr
    WHERE cr.id IN (
      SELECT room_id 
      FROM chat_room_members 
      WHERE user_id = ?
    )
    AND cr.id IN (
      SELECT room_id 
      FROM chat_room_members 
      WHERE user_id = ?
    )
    AND (
      SELECT COUNT(*) 
      FROM chat_room_members 
      WHERE room_id = cr.id
    ) = 2
    ORDER BY cr.created_at DESC
    LIMIT 1
  `;
  connection.query(query, [user1_id, user2_id], callback);
};

// 채팅방 삭제
exports.deleteChatRoom = (room_id, callback) => {
  // 먼저 채팅방 멤버와 메시지를 삭제하고 채팅방을 삭제
  const deleteMessages = 'DELETE FROM messages WHERE room_id = ?';
  const deleteMembers = 'DELETE FROM chat_room_members WHERE room_id = ?';
  const deleteChatRoom = 'DELETE FROM chat_rooms WHERE id = ?';
  
  connection.query(deleteMessages, [room_id], (err) => {
    if (err) return callback(err);
    
    connection.query(deleteMembers, [room_id], (err) => {
      if (err) return callback(err);
      
      connection.query(deleteChatRoom, [room_id], callback);
    });
  });
};

// 채팅방 ID로 멤버 조회
exports.getChatRoomMembersByRoomId = (room_id, callback) => {
  const query = `
    SELECT crm.user_id, u.username, u.profile_image 
    FROM chat_room_members crm
    JOIN users u ON crm.user_id = u.id
    WHERE crm.room_id = ?
  `;
  connection.query(query, [room_id], callback);
};

// 사용자가 채팅방 숨기기 (나가기)
exports.hideChatRoomForUser = (room_id, user_id, callback) => {
  const query = `
    UPDATE chat_room_members 
    SET hidden = TRUE, left_at = CURRENT_TIMESTAMP 
    WHERE room_id = ? AND user_id = ?
  `;
  connection.query(query, [room_id, user_id], callback);
};

// 사용자가 채팅방 다시 보이기 (새 메시지가 오면)
exports.showChatRoomForUser = (room_id, user_id, callback) => {
  const query = `
    UPDATE chat_room_members 
    SET hidden = FALSE, left_at = NULL 
    WHERE room_id = ? AND user_id = ?
  `;
  connection.query(query, [room_id, user_id], callback);
};

// 채팅방의 숨겨진 멤버들 다시 보이게 하기 (메시지 전송 시 호출)
exports.unhideRoomForAllMembers = (room_id, sender_id, callback) => {
  const query = `
    UPDATE chat_room_members 
    SET hidden = FALSE, left_at = NULL 
    WHERE room_id = ? AND user_id != ? AND hidden = TRUE
  `;
  connection.query(query, [room_id, sender_id], callback);
};

// 사용자가 채팅방에서 나간 시간 확인
exports.getUserLeftTime = (room_id, user_id, callback) => {
  const query = `
    SELECT left_at, hidden 
    FROM chat_room_members 
    WHERE room_id = ? AND user_id = ?
  `;
  connection.query(query, [room_id, user_id], callback);
};

// 모든 멤버가 채팅방을 나갔는지 확인
exports.checkAllMembersLeft = (room_id, callback) => {
  const query = `
    SELECT COUNT(*) as total_members,
           COUNT(CASE WHEN hidden = TRUE THEN 1 END) as left_members
    FROM chat_room_members 
    WHERE room_id = ?
  `;
  connection.query(query, [room_id], (err, results) => {
    if (err) return callback(err, false);
    
    const { total_members, left_members } = results[0];
    const allLeft = total_members > 0 && total_members === left_members;
    callback(null, allLeft);
  });
};
