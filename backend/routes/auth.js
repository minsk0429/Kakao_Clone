const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/users');
const router = express.Router();

// JWT 검증 미들웨어 
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 

  if (token == null) return res.sendStatus(401);

  // 'yourjwtsecret'으로 토큰 검증
  jwt.verify(token, 'yourjwtsecret', (err, user) => {
    if (err) return res.sendStatus(403); 
    req.user = user; 
    next();
  });
};

// POST 타입, 회원가입
router.post('/signup', async (req, res) => {
  try {
    const { username, password, email, status_message } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const password_hash = await bcrypt.hash(password, 10); // 비밀번호 해시

    userModel.createUser(username, password_hash, email, null, status_message, (err) => {
      if (err) {
        // MySQL Duplicate entry for key 'users.username' 등 에러 처리
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'Username already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ 
        success: true, 
        message: 'User created successfully' 
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST, 로그인 
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  userModel.findByUsernameForAuth(username, async (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password_hash); // 비밀번호 비교
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // JWT 토큰 생성 ('yourjwtsecret', 만료시간 1시간)
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username 
      }, 
      'yourjwtsecret', 
      { expiresIn: '1h' }
    );
    
    res.json({ 
      success: true, 
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profile_image: user.profile_image,
        status_message: user.status_message
      }
    });
  });
});

// GET, 사용자 정보 조회
router.get('/profile', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  userModel.findById(userId, (err, results) => {
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
        email: user.email,
        profile_image: user.profile_image,
        status_message: user.status_message,
        created_at: user.created_at
      }
    });
  });
});

// PUT, 프로필 업데이트
router.put('/profile', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { profile_image, status_message } = req.body;
  
  userModel.updateProfile(userId, profile_image, status_message, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ 
      success: true, 
      message: 'Profile updated successfully' 
    });
  });
});

module.exports = { router, authenticateToken };