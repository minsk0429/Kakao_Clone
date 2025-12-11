const mysql = require('mysql2');

// MySQL 데이터베이스 연결 풀 설정 (더 안정적)
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '1111',
  database: 'kakao',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 프로미스 기반 연결 생성
const connection = pool.promise();

// 연결 테스트
async function testConnection() {
  try {
    await connection.execute('SELECT 1');
    console.log('MySQL 데이터베이스에 연결되었습니다.');
  } catch (err) {
    console.error('데이터베이스 연결 실패:', err);
    // 재시도 로직
    setTimeout(testConnection, 5000);
  }
}

testConnection();

// 기존 코드 호환성을 위해 pool을 export
module.exports = pool;