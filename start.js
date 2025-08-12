#!/usr/bin/env node

// Railway 최적화 시작 스크립트
console.log('🚀 Railway 서버 시작 중...');

// 환경변수 확인
const requiredEnvVars = ['OPENAI_API_KEY', 'KAKAO_REST_API_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.warn(`⚠️  경고: 다음 환경변수가 설정되지 않음: ${missingVars.join(', ')}`);
} else {
    console.log('✅ 모든 필수 환경변수가 설정됨');
}

// 서버 시작
try {
    require('./server.js');
    console.log('✅ 서버 시작 완료');
} catch (error) {
    console.error('❌ 서버 시작 실패:', error.message);
    process.exit(1);
}
