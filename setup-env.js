#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 러닝 코스 생성기 환경변수 설정 도우미\n');

// .env 파일 경로
const envPath = path.join(__dirname, '.env');

// 환경변수 템플릿
const envTemplate = `# OpenAI API 설정
OPENAI_API_KEY=your_openai_api_key_here

# 카카오맵 API 설정
KAKAO_REST_API_KEY=your_kakao_rest_api_key_here

# 서버 포트 설정 (선택사항)
PORT=3000

# 환경 설정
NODE_ENV=development
`;

// .env 파일이 이미 존재하는지 확인
if (fs.existsSync(envPath)) {
    console.log('⚠️  .env 파일이 이미 존재합니다.');
    console.log('기존 파일을 백업하고 새로 생성하시겠습니까? (y/N)');
    
    // 사용자 입력 대기 (간단한 구현)
    console.log('\n📝 수동으로 .env 파일을 편집하세요:');
    console.log('1. 프로젝트 루트에 .env 파일 생성');
    console.log('2. 위의 템플릿을 복사하여 붙여넣기');
    console.log('3. your_openai_api_key_here를 실제 API 키로 교체');
    console.log('4. your_kakao_rest_api_key_here를 실제 API 키로 교체');
} else {
    console.log('📝 .env 파일을 생성합니다...');
    
    try {
        fs.writeFileSync(envPath, envTemplate);
        console.log('✅ .env 파일이 생성되었습니다!');
        console.log('\n🔑 다음 단계:');
        console.log('1. .env 파일을 열어서 API 키를 입력하세요');
        console.log('2. your_openai_api_key_here를 실제 OpenAI API 키로 교체');
        console.log('3. your_kakao_rest_api_key_here를 실제 카카오 API 키로 교체');
        console.log('\n⚠️  주의: .env 파일은 절대 깃허브에 커밋하지 마세요!');
    } catch (error) {
        console.error('❌ .env 파일 생성 실패:', error.message);
        console.log('\n📝 수동으로 .env 파일을 생성하세요:');
        console.log('프로젝트 루트에 .env 파일을 만들고 다음 내용을 입력하세요:');
        console.log('\n' + envTemplate);
    }
}

console.log('\n🌐 Vercel 배포 시에는 Vercel 대시보드에서 환경변수를 설정하세요.');
console.log('📚 자세한 내용은 README.md 파일을 참고하세요.');
