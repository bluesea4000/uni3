// 필요한 모듈 불러오기
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// Express 앱 초기화
const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_MODEL = 'gpt-4o-search-preview';
const DATA_DIR = path.join(__dirname, 'data');
const COURSES_FILE = path.join(DATA_DIR, 'courses.json');
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || 'YOUR_KAKAO_REST_API_KEY';
const APP_DOMAIN = process.env.APP_DOMAIN || 'https://2025-unithon-main-production.up.railway.app';

// 환경변수 검증
app.use((req, res, next) => {
    if (req.path === '/health') {
        return res.json({
            status: 'OK',
            port: process.env.PORT,
            environment: process.env.NODE_ENV,
            openai_key: process.env.OPENAI_API_KEY ? '설정됨' : '설정되지 않음',
            kakao_key: process.env.KAKAO_REST_API_KEY ? '설정됨' : '설정되지 않음'
        });
    }
    next();
});

// 미들웨어 설정
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? [APP_DOMAIN, 'https://2025-unithon-main.railway.app']
        : true,
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// 정적 파일 제공
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// GPT API를 통한 러닝 코스 생성 엔드포인트
app.post('/api/generate-course', async (req, res) => {
    try {
        const { formData, coordinates } = req.body;
        const apiKey = process.env.OPENAI_API_KEY;
        console.log('🔑 OpenAI API 키 확인:', apiKey ? `설정됨 (${apiKey.substring(0, 10)}...)` : '설정되지 않음');
        
        if (!apiKey) {
            console.error('❌ OpenAI API 키가 설정되지 않았습니다.');
            return res.status(500).json({ 
                error: 'OpenAI API 키가 설정되지 않았습니다.',
                detail: 'Railway 환경변수에서 OPENAI_API_KEY를 설정해주세요.'
            });
        }
        
        if (apiKey === 'your_openai_api_key_here' || apiKey === 'YOUR_OPENAI_API_KEY') {
            console.error('❌ OpenAI API 키가 기본값으로 설정되어 있습니다.');
            return res.status(500).json({ 
                error: 'OpenAI API 키가 기본값으로 설정되어 있습니다.',
                detail: '실제 OpenAI API 키로 교체해주세요.'
            });
        }

        console.log('--- OpenAI API 요청 시작 ---');
        console.log('🔑 API 키 상태:', apiKey ? `설정됨 (${apiKey.substring(0, 10)}...)` : '설정되지 않음');
        
        const prompt = generatePrompt(formData, coordinates);
        console.log('📝 프롬프트 길이:', prompt.length, '자');
        
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: OPENAI_MODEL,
                web_search_options: {},
                messages: [
                    { role: 'system', content: '당신은 러닝 코스 생성 전문가입니다. 사용자의 요청에 따라 검색하여 올바른 근거를 바탕으로 답변해야 합니다.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: "text" },
                max_tokens: 1500
            },
            { headers: { 'Authorization': `Bearer ${apiKey}` } }
        );
        console.log(response.data.choices[0].message.content)
        const gptResponse = response.data.choices[0].message.content;
        console.log('--- OpenAI API 응답 (JSON 파싱 전) ---', gptResponse);
        const courseData = parseGptResponse(gptResponse, formData, coordinates);
        console.log('--- 파싱된 코스 데이터 (경로 생성 전) ---', courseData);
        console.log("위도 경도", courseData.course.waypoints[0].location.latitude, courseData.course.waypoints[0].location.longitude);
        const kakaoApiKey = process.env.KAKAO_REST_API_KEY;
        console.log(`--- 카카오 API 키 로드: ${kakaoApiKey ? '성공 (키의 일부: ' + kakaoApiKey.substring(0, 4) + '...)' : '실패'} ---`);

        if (kakaoApiKey )//&& courseData.course.waypoints && courseData.course.waypoints.length > 1 && courseData.course.waypoints[0].location.latitude) {
        {
            console.log('--- 카카오맵 경로 탐색 시작 ---');
            const origin = `${courseData.course.waypoints[0].location.longitude},${courseData.course.waypoints[0].location.latitude}`;
            const destination = `${courseData.course.waypoints[courseData.course.waypoints.length - 1].location.longitude},
                                    ${courseData.course.waypoints[courseData.course.waypoints.length - 1].location.latitude}`;
            //const waypointsStr = courseData.course.waypoints.slice(1, -1).map(wp => `${wp.lng},${wp.lat}`).join('|');

            const waypointsArr = courseData.course.waypoints.slice(1, -1);
            const waypointsStr = waypointsArr.length > 0
                ? waypointsArr.map(wp => `${wp.location.longitude},${wp.location.latitude}`).join('|')
                : undefined;

            const params = {
            origin,
            destination,
            priority: 'RECOMMEND'
            };
            if (waypointsStr) {
                params.waypoints = waypointsStr;
            }

            const kakaoResponse = await axios.get('https://apis-navi.kakaomobility.com/v1/directions', {
                params,
                headers: { 
                    Authorization: `KakaoAK ${kakaoApiKey}`,
                    'KA': 'sdk/1.0 os/javascript sdkver/1.0 app/ver/1.0',
                    'os': 'web',
                    'origin': 'https://2025-unithon-main-production.up.railway.app'
                }
            });

/*
            console.log("waypointsStr",waypointsStr );
            const kakaoResponse = await axios.get('https://apis-navi.kakaomobility.com/v1/directions', {
                params: { origin, destination, waypoints: waypointsStr, priority: 'RECOMMEND' },
                headers: { 
                    Authorization: `KakaoAK ${kakaoApiKey}`,
                    'KA': 'sdk/1.0 os/javascript sdkver/1.0 app/ver/1.0',
                    'os': 'web',
                    'origin': 'https://2025-unithon-main-production.up.railway.app'
                }
            });
*/
            const route = kakaoResponse.data.routes[0];
            if (route && route.sections) {
                const linePath = [];
                route.sections.forEach(section => {
                    section.roads.forEach(road => {
                        for (let i = 0; i < road.vertexes.length; i += 2) {
                            linePath.push({ lat: road.vertexes[i + 1], lng: road.vertexes[i] });
                        }
                    });
                });
                courseData.course.path = linePath;
                console.log(`--- 카카오맵 경로 탐색 성공: ${linePath.length}개의 좌표 발견 ---`);
            }
        } else {
            console.log('--- 카카오맵 경로 탐색 건너뜀 (조건 불충족) ---');
            courseData.path = generatePathCoordinates(coordinates, formData.distance);
        }
        
        //courseData.waypoints = courseData.waypoints.map(wp => wp.name || wp);
        //res.json(courseData);
        courseData.course.waypoints = courseData.course.waypoints.map(wp => ({
          name: wp.name || "",
          location: {
            latitude: wp.location?.latitude || 0,
            longitude: wp.location?.longitude || 0,
          }
        }));

        // 값 정규화(필드명 변형 및 기본값 보정)
        const src = courseData.course || {};
        const toNumber = (v, fallback = 0) => {
          const n = typeof v === 'number' ? v : parseFloat(String(v||'').replace(/[^0-9.+-]/g,''));
          return isNaN(n) ? fallback : n;
        };

        const total_distance_km = (src.total_distance_km !== undefined)
          ? toNumber(src.total_distance_km, toNumber(formData.distance, 0))
          : toNumber(formData.distance, 0);

        const expected_duration_minutes = (src.expected_duration_minutes !== undefined)
          ? toNumber(src.expected_duration_minutes,
              src.estimated_time_minutes !== undefined ? toNumber(src.estimated_time_minutes, 0) : 0)
          : (src.estimated_time_minutes !== undefined ? toNumber(src.estimated_time_minutes, 0)
             : (formData.difficulty === 'walking' ? Math.round(toNumber(formData.distance, 0) * 15)
               : Math.round(toNumber(formData.distance, 0) * 6)));

        const elevation_change_meters = (src.elevation_change_meters !== undefined)
          ? toNumber(src.elevation_change_meters,
              src.elevation_change_m !== undefined ? toNumber(src.elevation_change_m, 0) : 0)
          : (src.elevation_change_m !== undefined ? toNumber(src.elevation_change_m, 0)
             : Math.round(toNumber(formData.distance, 0) * 8));

        const difficultyKorean = src.difficulty || difficultyToKorean(formData.difficulty);
        const emotional_recommendation = src.emotional_recommendation || src.emotion || "";

        const formattedCourseData = {
          course: {
            description: src.description || "",
            waypoints: src.waypoints,
            running_tips: Array.isArray(src.running_tips) ? src.running_tips : [],
            total_distance_km,
            expected_duration_minutes,
            elevation_change_meters,
            emotional_recommendation,
            difficulty: difficultyKorean,
            path: src.path,
          }
        };

        res.json(formattedCourseData);


    } catch (error) {
        const status = error?.response?.status;
        const message = error?.response?.data?.error?.message || error?.message;
        const stack = error?.stack;
        
        console.error('🚨 API 오류 발생 상세 정보:');
        console.error('Status:', status);
        console.error('Message:', message);
        console.error('Stack:', stack);
        console.error('Full Error:', error);
        
        res.status(500).json({ 
            error: '코스 생성 중 오류가 발생했습니다.', 
            detail: message,
            timestamp: new Date().toISOString(),
            path: '/api/generate-course'
        });
    }
});


// 카카오 길찾기 REST API 프록시
app.get('/api/road-path', async (req, res) => {
    const { origin, destination } = req.query;
    if (!origin || !destination) return res.status(400).json({ error: 'origin, destination required' });
    try {
        const url = `https://apis-navi.kakaomobility.com/v1/directions`;
        const [originLng, originLat] = origin.split(',');
        const [destLng, destLat] = destination.split(',');
        const response = await axios.get(url, {
            headers: { 
                Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
                'KA': 'sdk/1.0 os/javascript sdkver/1.0 app/ver/1.0',
                'os': 'web',
                'origin': 'https://2025-unithon-main-production.up.railway.app'
            },
            params: {
                origin: `${originLng},${originLat}`,
                destination: `${destLng},${destLat}`,
                priority: 'RECOMMEND',
                car_fuel: 'GASOLINE',
                car_hipass: false,
                alternatives: false,
                road_details: true
            }
        });
        res.json(response.data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------- Persistent course storage (local file) ----------
ensureDataStore();

app.get('/api/courses', (req, res) => {
    try {
        const list = readCourses();
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: '기록을 불러오지 못했습니다.' });
    }
});

app.post('/api/courses', (req, res) => {
    try {
        const courses = readCourses();
        const course = req.body || {};
        const id = Date.now();
        const saved = { id, ...course };
        courses.push(saved);
        writeCourses(courses);
        res.status(201).json(saved);
    } catch (e) {
        res.status(500).json({ error: '기록 저장에 실패했습니다.' });
    }
});

app.delete('/api/courses/:id', (req, res) => {
    try {
        const id = Number(req.params.id);
        const courses = readCourses();
        const next = courses.filter(c => Number(c.id) !== id);
        writeCourses(next);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: '기록 삭제에 실패했습니다.' });
    }
});

function ensureDataStore() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (!fs.existsSync(COURSES_FILE)) fs.writeFileSync(COURSES_FILE, '[]', 'utf-8');
    } catch (e) {
        console.error('데이터 디렉터리 초기화 실패:', e.message);
    }
}

function readCourses() {
    const raw = fs.readFileSync(COURSES_FILE, 'utf-8');
    try { return JSON.parse(raw); } catch (_) { return []; }
}

function writeCourses(list) {
    fs.writeFileSync(COURSES_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

// GPT API 프롬프트 생성 함수
function generatePrompt(formData, coordinates) {
    const { location, distance, difficulty, time, additionalInfo, emotion } = formData;
    const preferences = Array.isArray(formData.preferences) ? formData.preferences : [];
    
    // 감정 정보 처리
    let emotionText = '';
    let emotionAdvice = '';
    const emotionValue = parseInt(emotion || 50);
    
    if (emotionValue < 33) {
        emotionText = '슬픔/우울';
        emotionAdvice = '마음을 달래고 기분 전환이 될 수 있는 코스를 추천해주세요. 조용하고 평화로운 환경, 아름다운 자연 경관, 또는 친근한 커뮤니티 공간을 포함하는 코스가 좋겠습니다.';
    } else if (emotionValue < 66) {
        emotionText = '보통/평온';
        emotionAdvice = '일상적인 러닝을 즐길 수 있는 균형잡힌 코스를 추천해주세요.';
    } else {
        emotionText = '기쁨/행복';
        emotionAdvice = '에너지가 넘치고 활기찬 분위기의 코스를 추천해주세요. 경사가 있는 도전적인 구간이나 다양한 경관을 볼 수 있는 코스가 좋겠습니다.';
    }
    
    // 선호 환경 텍스트 변환
    const preferencesText = preferences.map(pref => {
        const prefMap = {
            'park': '공원',
            'river': '강/하천',
            'trail': '트레일',
            'urban': '도심'
        };
        return prefMap[pref] || pref;
    }).join(', ');
    
    // 난이도 텍스트 변환
    const difficultyText = {
        'walking': '산책',
        'easy': '쉬움 (평지 위주)',
        'medium': '보통',
        'hard': '어려움 (언덕 포함)'
    }[difficulty] || '보통';
    
    // 시간대 텍스트 변환
    const timeText = {
        'morning': '아침',
        'afternoon': '오후',
        'evening': '저녁',
        'night': '밤'
    }[time] || '오후';
    
    // 프롬프트 생성
    return `다음 조건에 맞는 러닝 코스를 생성해주세요:

위치: ${location} (좌표: 위도 ${coordinates.lat}, 경도 ${coordinates.lng})
거리: ${distance}km
난이도: ${difficultyText}
선호 환경: ${preferencesText || '없음'}
러닝 시간대: ${timeText}
현재 감정 상태: ${emotionText} (${emotionValue}/100)
추가 요청사항: ${additionalInfo || '없음'}

감정에 따른 특별 고려사항: ${emotionAdvice}

다음 JSON 형식에 맞게 답변해주세요 
"course": {
    "description",
    "waypoints": [
      {
        "name":
        "location": {
          "latitude": 
          "longitude": 
        }
      }
    ],
    "running_tips": []
    "total_distance_km",
    "expected_duration_minutes",
    "elevation_change_meters",
    "emotional_recommendation"
  }
}
1. 코스 설명 (환경, 특징, 장점 등) - 감정 상태를 고려한 설명
2. 주요 경유지 목록을 실제 도로명 주소에 기반해 나열 (start, waypoints, end") 
waypoint의 시작과 끝 인덱스의 name은 현재 주소로 작성해주세요
거리는 1에서 10까지 제공되는데 거리가 크면 경유지를 최대 2개로 잡고 거리가 작을수록 경유지를 0에 가깝게 해주세요
3. 러닝 팁 (시간대, 난이도, 준비물 등에 맞는 조언) - 감정 상태에 맞는 조언 포함
4. 총 거리, 예상 소요 시간, 고도 변화
5. 감정 상태에 따른 특별한 추천사항
6. 링크 출처 빼주세요
JSON 형식으로 응답해주세요.`;
}

// GPT 응답 파싱 함수
function parseGptResponse(gptResponse, formData, coordinates) {
    // GPT 응답에서 JSON 추출 시도
    try {
        // JSON 형식으로 응답했을 경우
        const jsonMatch = gptResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (error) {
        console.error('GPT 응답 파싱 실패:', error);
    }
    
    // JSON 파싱 실패 시 기본 응답 생성
    console.log('JSON 파싱 실패 시 기본 응답 생성');
    const estimatedTime = formData.difficulty === 'walking' 
        ? Math.round(formData.distance * 15) + '분' // 산책: 1km당 약 15분
        : Math.round(formData.distance * 6) + '분'; // 러닝: 1km당 약 6분
    
    return {
        totalDistance: formData.distance,
        estimatedTime: estimatedTime,
        elevation: '+' + Math.round(formData.distance * 8) + 'm',
        difficulty: difficultyToKorean(formData.difficulty),
        description: `이 코스는 ${formData.location} 주변의 ${formData.distance}km 코스로, ${difficultyToKorean(formData.difficulty)} 난이도의 지형을 포함하고 있습니다.`,
        waypoints: [
            `출발점: ${formData.location}`,
            `${(formData.distance * 0.3).toFixed(1)}km 지점: 첫 번째 경유지`,
            `${(formData.distance * 0.5).toFixed(1)}km 지점: 중간 지점`,
            `${(formData.distance * 0.8).toFixed(1)}km 지점: 마지막 경유지`,
            `도착점: ${formData.location} (원점)`
        ],
        tips: [
            timeBasedTip(formData.time),
            formData.difficulty === 'walking' 
                ? `${formData.distance}km 산책이므로 편안한 신발과 여유로운 마음으로 즐기세요.`
                : `${formData.distance}km 거리이므로 약 ${Math.round(formData.distance * 0.1)}L의 물을 준비하세요.`,
            difficultyBasedTip(formData.difficulty)
        ]
    };
}

// 난이도 영어 -> 한글 변환 함수
function difficultyToKorean(difficulty) {
    const map = {
        'walking': '산책',
        'easy': '쉬움',
        'medium': '보통',
        'hard': '어려움'
    };
    return map[difficulty] || '보통';
}

// 시간대별 팁 생성 함수
function timeBasedTip(time) {
    const tips = {
        'morning': '아침 러닝은 체온이 낮으므로 충분한 준비운동을 하세요.',
        'afternoon': '오후에는 자외선이 강하니 자외선 차단제와 모자를 준비하세요.',
        'evening': '저녁 시간에는 기온이 떨어지므로 얇은 겉옷을 준비하세요.',
        'night': '야간 러닝 시에는 반사 소재의 의류나 LED 라이트를 착용하세요.'
    };
    return tips[time] || tips['afternoon'];
}

// 난이도별 팁 생성 함수
function difficultyBasedTip(difficulty) {
    const tips = {
        'walking': '산책은 편안한 신발과 여유로운 마음으로 즐기세요. 천천히 걷면서 주변 경관을 감상하는 것이 좋습니다.',
        'easy': '초보자에게 적합한 코스입니다. 편안한 페이스로 즐기세요.',
        'medium': '중간 난이도 코스로, 중간중간 페이스 조절이 필요합니다.',
        'hard': '고난도 코스입니다. 충분한 체력과 경험이 필요합니다.'
    };
    return tips[difficulty] || tips['medium'];
}

// 카카오맵 API를 통한 경로 좌표 생성 함수
async function generatePathCoordinates(center, distance) {
    // 실제 구현 시에는 카카오맵 API를 활용하여 경로 생성
    // 현재는 더미 데이터 생성
    
    const path = [];
    const numPoints = Math.max(10, Math.round(distance * 2)); // 거리에 비례하여 포인트 수 결정
    const radius = distance * 100; // 거리에 비례한 반경 (미터 단위)
    
    // 시작점 (중심 좌표)
    const startPoint = { lat: center.lat, lng: center.lng };
    path.push(startPoint);
    
    // 원형 경로 생성
    for (let i = 1; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        const dx = radius * Math.cos(angle) / 10000; // 경도 변화량
        const dy = radius * Math.sin(angle) / 10000; // 위도 변화량
        
        // 약간의 랜덤성 추가
        const jitter = 0.0002 * (Math.random() - 0.5);
        
        const point = {
            lat: parseFloat(center.lat) + dy + jitter,
            lng: parseFloat(center.lng) + dx + jitter
        };
        
        path.push(point);
    }
    
    // 경로 닫기 (시작점으로 돌아오기)
    path.push(startPoint);
    
    return path;
}

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버 시작됨 - 포트: ${PORT}, 환경: ${process.env.NODE_ENV || 'development'}`);
});