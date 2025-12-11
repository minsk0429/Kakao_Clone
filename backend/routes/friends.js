const express = require('express');
const userModel = require('../models/users');
const { authenticateToken } = require('./auth'); // auth.js에서 미들웨어 가져오기 
const router = express.Router();

// 친구 추가 라우트 
router.post('/add', authenticateToken, async (req, res) => {
    const current_user_id = req.user.id;    // JWT 미들웨어에서 추출된 현재 사용자 ID
    const { friend_username } = req.body;

    if (!friend_username) {  // 친구 이름 없으면 에러 출력
        return res.status(400).json({ error: 'friend_username is required' });
    }

    // 1. 친구로 추가할 사용자 존재 확인 및 ID 반환 
    userModel.findByUsername(friend_username, async (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const friend_user = results[0];
        const friend_id = friend_user.id;

        if (current_user_id === friend_id) {
            return res.status(400).json({ error: "You cannot add yourself as a friend" });
        }

        // 2. 이미 친구인지 확인 
        userModel.isFriend(current_user_id, friend_id, (err, friendCheckResults) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // 3. 이미 친구인 경우 
            if (friendCheckResults[0].count > 0) {
                return res.status(409).json({ error: 'Already friends' });
            }

            // 4. 친구 추가 (friends 테이블에 양방향 저장)
            userModel.addFriend(current_user_id, friend_id, (err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ 
                    success: true, 
                    message: `${friend_username} added as a friend.`,
                    friend: {
                        id: friend_user.id,
                        username: friend_user.username,
                        profile_image: friend_user.profile_image,
                        status_message: friend_user.status_message
                    }
                });
            });
        });
    });
});

// 친구 목록 확인 라우트
router.get('/list', authenticateToken, (req, res) => {
    const current_user_id = req.user.id;    // JWT 미들웨어에서 현재 사용자 ID 추출

    // users.js의 getFriendsList 함수 호출
    userModel.getFriendsList(current_user_id, (err, results) => {
        if (err) {
            console.error('Error fetching friends list:', err);
            return res.status(500).json({ error: "Failed to fetch friends list" });
        }
        // 성공 : 친구 목록 (배열) 반환
        res.json({ 
            success: true,
            friends: results 
        });
    });
});

// 친구 검색 라우트
router.get('/search', authenticateToken, (req, res) => {
    const { username } = req.query;
    
    if (!username) {
        return res.status(400).json({ error: 'username parameter is required' });
    }
    
    userModel.findByUsername(username, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = results[0];
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                profile_image: user.profile_image,
                status_message: user.status_message
            }
        });
    });
});

module.exports = router;