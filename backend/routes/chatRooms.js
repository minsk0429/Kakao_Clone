const express = require('express');
const chatRoomModel = require('../models/chatRooms');
const messageModel = require('../models/messages');
const { authenticateToken } = require('./auth');
const router = express.Router();

// 채팅방 생성 (그룹 채팅 지원)
router.post('/create', authenticateToken, (req, res) => {
    const { name, room_type = 'group', participants } = req.body;
    const current_user_id = req.user.id;
    
    // 채팅방 생성
    chatRoomModel.createChatRoom(name, (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        const room_id = result.insertId;
        
        // 모든 참여자를 채팅방에 추가
        if (participants && participants.length > 0) {
            let memberCount = 0;
            let hasError = false;
            
            participants.forEach(participant_id => {
                chatRoomModel.addChatRoomMember(room_id, participant_id, (err) => {
                    memberCount++;
                    if (err) hasError = true;
                    
                    // 모든 멤버 추가 완료
                    if (memberCount === participants.length) {
                        if (hasError) {
                            return res.status(500).json({ error: 'Failed to add some members' });
                        }
                        // Socket.IO로 채팅방 생성 알림
                        if (req.io) {
                            req.io.emit('chat_room_updated', {
                                roomId: room_id,
                                action: 'created',
                                room_name: name
                            });
                        }

                        res.json({
                            success: true,
                            room: {
                                id: room_id,
                                name: name,
                                room_type: room_type
                            },
                            message: 'Chat room created successfully'
                        });
                    }
                });
            });
        } else {
            // Socket.IO로 채팅방 생성 알림
            if (req.io) {
                req.io.emit('chat_room_updated', {
                    roomId: room_id,
                    action: 'created',
                    room_name: name
                });
            }

            res.json({
                success: true,
                room: {
                    id: room_id,
                    name: name,
                    room_type: room_type
                },
                message: 'Chat room created successfully'
            });
        }
    });
});

// 사용자의 채팅방 목록 조회
router.get('/list', authenticateToken, (req, res) => {
    const current_user_id = req.user.id;
    
    chatRoomModel.getUserChatRooms(current_user_id, (err, rooms) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json({
            success: true,
            chatRooms: rooms
        });
    });
});

// 채팅방 정보 조회
router.get('/:room_id', authenticateToken, (req, res) => {
    const { room_id } = req.params;
    
    chatRoomModel.getChatRoomById(room_id, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Chat room not found' });
        }
        
        const chatRoom = results[0];
        
        // 채팅방 멤버 조회
        chatRoomModel.getChatRoomMembers(room_id, (err, members) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            res.json({
                success: true,
                chat_room: {
                    id: chatRoom.id,
                    room_name: chatRoom.room_name,
                    created_at: chatRoom.created_at,
                    members: members
                }
            });
        });
    });
});

// 채팅방에 멤버 추가
router.post('/:room_id/members', authenticateToken, (req, res) => {
    const { room_id } = req.params;
    const { user_id } = req.body;
    
    chatRoomModel.addChatRoomMember(room_id, user_id, (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json({
            success: true,
            message: 'Member added to chat room successfully'
        });
    });
});

// 채팅방 멤버 조회
router.get('/:room_id/members', authenticateToken, (req, res) => {
    const { room_id } = req.params;
    
    chatRoomModel.getChatRoomMembers(room_id, (err, members) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json({
            success: true,
            members: members
        });
    });
});

// 1:1 채팅방 생성 또는 찾기
router.post('/create-or-find', authenticateToken, (req, res) => {
    const { participants } = req.body; // [user1_id, user2_id]
    const current_user_id = req.user.id;
    
    if (!participants || participants.length !== 2) {
        return res.status(400).json({ error: '1:1 채팅에는 정확히 2명의 참가자가 필요합니다.' });
    }
    
    // 두 사용자가 이미 채팅방을 가지고 있는지 확인
    chatRoomModel.findPrivateChatRoom(participants[0], participants[1], (err, existingRoom) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (existingRoom.length > 0) {
            // 기존 채팅방이 있으면 현재 사용자의 숨김 상태 해제
            const roomId = existingRoom[0].id;
            chatRoomModel.showChatRoomForUser(roomId, current_user_id, (err) => {
                if (err) {
                    console.error('채팅방 숨김 해제 실패:', err);
                } else {
                    console.log(`사용자 ${current_user_id}의 채팅방 ${roomId} 숨김 해제됨`);
                }
                
                // 숨김 해제 성공 여부와 관계없이 채팅방 정보 반환
                return res.json({
                    success: true,
                    room: existingRoom[0],
                    isNew: false
                });
            });
            return; // 여기서 함수 종료
        }
        
        // 새 채팅방 생성
        chatRoomModel.createChatRoom(null, (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            const room_id = result.insertId;
            
            // 두 사용자를 채팅방에 추가
            let memberCount = 0;
            let hasError = false;
            
            participants.forEach(participant_id => {
                chatRoomModel.addChatRoomMember(room_id, participant_id, (err) => {
                    memberCount++;
                    if (err) hasError = true;
                    
                    if (memberCount === participants.length) {
                        if (hasError) {
                            return res.status(500).json({ error: 'Failed to add members to chat room' });
                        }
                        
                        // 새로운 1:1 채팅방이 생성되었으므로 업데이트 이벤트 발생
                        if (req.io) {
                            req.io.emit('chat_room_updated', {
                                room: { id: room_id, room_name: null },
                                action: 'created',
                                type: 'private'
                            });
                        }
                        
                        res.json({
                            success: true,
                            room: { id: room_id, room_name: null },
                            isNew: true
                        });
                    }
                });
            });
        });
    });
});

// 채팅방 나가기 (숨기기)
router.post('/:room_id/leave', authenticateToken, (req, res) => {
    const { room_id } = req.params;
    const user_id = req.user.id;
    
    // 사용자가 해당 채팅방의 멤버인지 확인
    chatRoomModel.getChatRoomMembersByRoomId(room_id, (err, members) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        const isMember = members.some(member => member.user_id == user_id);
        if (!isMember) {
            return res.status(403).json({ error: '채팅방에 대한 권한이 없습니다.' });
        }
        
        // 사용자의 채팅방을 숨김 처리
        chatRoomModel.hideChatRoomForUser(room_id, user_id, (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // 모든 멤버가 나갔는지 확인
            chatRoomModel.checkAllMembersLeft(room_id, (checkErr, allLeft) => {
                if (checkErr) {
                    console.error('멤버 확인 오류:', checkErr);
                } else if (allLeft) {
                    // 모든 멤버가 나갔으면 채팅방 완전 삭제
                    chatRoomModel.deleteChatRoom(room_id, (deleteErr) => {
                        if (deleteErr) {
                            console.error('채팅방 삭제 오류:', deleteErr);
                        } else {
                            console.log(`채팅방 ${room_id} 자동 삭제됨 (모든 멤버가 나감)`);
                        }
                    });
                }
            });
            
            // Socket.IO로 채팅방 업데이트 알림
            if (req.io) {
                req.io.emit('chat_room_updated', {
                    roomId: room_id,
                    action: 'left',
                    userId: user_id
                });
            }
            
            res.json({
                success: true,
                message: '채팅방을 나갔습니다.'
            });
        });
    });
});

module.exports = router;
