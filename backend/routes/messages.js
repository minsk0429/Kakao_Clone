const express = require('express');
const messageModel = require('../models/messages');
const { authenticateToken } = require('./auth');
const router = express.Router();

// 메시지 전송
router.post('/send', authenticateToken, (req, res) => {
    const { room_id, message_type = 'text', content } = req.body;
    const sender_id = req.user.id;
    
    if (!room_id || !content) {
        return res.status(400).json({ error: 'room_id and content are required' });
    }
    
    // 메시지 타입 유효성 검사
    const validTypes = ['text', 'image', 'file'];
    if (!validTypes.includes(message_type)) {
        return res.status(400).json({ error: 'Invalid message_type. Must be text, image, or file' });
    }
    
    messageModel.createMessage(room_id, sender_id, message_type, content, (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        const message_id = result.insertId;
        
        // 생성된 메시지 정보 반환
        messageModel.getMessageById(message_id, (err, messages) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            if (messages.length === 0) {
                return res.status(404).json({ error: 'Message not found' });
            }
            
            const message = messages[0];
            res.json({
                success: true,
                message: {
                    id: message.id,
                    room_id: message.room_id,
                    sender_id: message.sender_id,
                    sender_username: message.sender_username,
                    sender_profile_image: message.sender_profile_image,
                    message_type: message.message_type,
                    content: message.content,
                    created_at: message.created_at
                }
            });
        });
    });
});

// 채팅방 메시지 조회
router.get('/room/:room_id', authenticateToken, (req, res) => {
    const { room_id } = req.params;
    const user_id = req.user.id;
    
    messageModel.getMessagesByRoomId(room_id, user_id, (err, messages) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json({
            success: true,
            messages: messages.map(message => ({
                id: message.id,
                room_id: message.room_id,
                sender_id: message.sender_id,
                sender_username: message.sender_username,
                sender_profile_image: message.sender_profile_image,
                message_type: message.message_type,
                content: message.content,
                created_at: message.created_at,
                unread_count: message.unread_count || 0
            }))
        });
    });
});

// 채팅방의 모든 메시지 읽음 처리 
router.post('/read-all/:roomId', authenticateToken, (req, res) => {
    const roomId = req.params.roomId;
    const userId = req.user.id;

    console.log(`모든 메시지 읽음 처리 - 채팅방: ${roomId}, 사용자: ${userId}`);

    messageModel.markAllMessagesAsRead(roomId, userId, (err, result) => {
        if (err) {
            console.error('메시지 읽음 처리 오류:', err);
            return res.status(500).json({ error: '메시지 읽음 처리에 실패했습니다.' });
        }
        
        console.log('모든 메시지 읽음 처리 완료');
        res.json({ 
            success: true, 
            message: '모든 메시지를 읽음 처리했습니다.',
            affectedRows: result.affectedRows || 0
        });
    });
});

// 특정 메시지 읽음 처리 
router.post('/read/:messageId', authenticateToken, (req, res) => {
    const messageId = req.params.messageId;
    const userId = req.user.id;

    messageModel.markMessageAsRead(messageId, userId, (err, result) => {
        if (err) {
            console.error('메시지 읽음 처리 오류:', err);
            return res.status(500).json({ error: '메시지 읽음 처리에 실패했습니다.' });
        }
        
        res.json({ 
            success: true,
            alreadyRead: result?.alreadyRead || false
        });
    });
});

// 읽지 않은 메시지 수 조회 
router.get('/unread/:roomId', authenticateToken, (req, res) => {
    const roomId = req.params.roomId;
    const userId = req.user.id;

    messageModel.getUnreadMessageCount(roomId, userId, (err, result) => {
        if (err) {
            console.error('읽지 않은 메시지 수 조회 오류:', err);
            return res.status(500).json({ error: '읽지 않은 메시지 수를 조회할 수 없습니다.' });
        }
        
        res.json({ 
            success: true,
            unreadCount: result[0]?.unread_count || 0 
        });
    });
});

// 특정 메시지 조회
router.get('/:message_id', authenticateToken, (req, res) => {
    const { message_id } = req.params;
    
    messageModel.getMessageById(message_id, (err, messages) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (messages.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        const message = messages[0];
        res.json({
            success: true,
            message: {
                id: message.id,
                room_id: message.room_id,
                sender_id: message.sender_id,
                sender_username: message.sender_username,
                sender_profile_image: message.sender_profile_image,
                message_type: message.message_type,
                content: message.content,
                created_at: message.created_at
            }
        });
    });
});

// 채팅방의 최근 메시지 조회
router.get('/room/:room_id/latest', authenticateToken, (req, res) => {
    const { room_id } = req.params;
    
    messageModel.getLatestMessageByRoomId(room_id, (err, messages) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (messages.length === 0) {
            return res.status(404).json({ error: 'No messages found' });
        }
        
        const message = messages[0];
        res.json({
            success: true,
            message: {
                id: message.id,
                room_id: message.room_id,
                sender_id: message.sender_id,
                sender_username: message.sender_username,
                sender_profile_image: message.sender_profile_image,
                message_type: message.message_type,
                content: message.content,
                created_at: message.created_at
            }
        });
    });
});

module.exports = router;