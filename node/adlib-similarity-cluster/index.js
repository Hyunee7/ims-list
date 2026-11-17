//******************************************************************************
// ADLIB 파일 유사도 비교
// ex)
//  D:\node-v26.9.0-win-x64\adlib-similarity-cluster>..\node index.js D:\DOS\MUSIC\DATA\ALLADLIB
//******************************************************************************
 
const fs = require('fs');
const util = require('util');
const path = require('path');
const { Midi } = require('@tonejs/midi');
const levenshtein = require('fast-levenshtein');

// ⚙️ 기본 설정값
const DEFAULT_DIR = './midi_files';  // MIDI 파일이 모여있는 디렉토리 경로
                                     // 파라미터가 없을 때 사용할 기본 디렉토리
const SIMILARITY_THRESHOLD = 0.65;   // 유사도 기준 (0.0 ~ 1.0) -> 65% 이상 같으면 유사한 곡으로 판단
                                     // 유사도 기준 (65% 이상이면 유사 곡)

// 대상 확장명 (확장명간 교차 비교하지 않음)
const TARGET_EXTENSIONS = ['.ims', '.rol', '.sop', '.mid'];

/**
 * 1. CLI(도스 파라미터) 입력 처리
 * 'node index.js D:\MyMusic' 형태로 입력하면 해당 경로를 사용하고, 없으면 기본 디렉토리를 사용합니다.
 */
// CLI(도스 파라미터) 입력 처리
const args = process.argv.slice(2)[0];
const TARGET_DIR = args ? path.resolve(args) : path.resolve(DEFAULT_DIR);
const ymd = getYYYYMMDDHHmmss();

// log.txt 파일을 쓰기 스트림으로 염 (append 모드 원하면 'a' 옵션)
const logFile = fs.createWriteStream(__dirname + `/log_${ymd}.txt`, { flags: 'a' });
const logStdout = process.stdout;

// console.log 재정의
console.log = function (...args) {
  const message = args.map(arg => typeof arg === 'object' ? util.inspect(arg) : arg).join(' ') + '\n';
  logFile.write(message);
  logStdout.write(message);
};

/**
 * 하위 디렉토리를 재귀적으로 탐색하여 대상 파일 목록을 수집하는 함수
 */
function getAllFiles(dirPath, fileList = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // 하위 디렉토리가 있으면 재귀 호출
            getAllFiles(fullPath, fileList);
        } else {
            // 디렉토리 내 지원하는 확장자 파일 필터링
            // 지원하는 확장자인지 확인 후 목록에 추가
            const ext = path.extname(file).toLowerCase();
            if (TARGET_EXTENSIONS.includes(ext)) {
                fileList.push(fullPath);
            }
        }
    });

    return fileList;
}

/**
 * 1. MIDI 파일에서 주요 멜로디(음정 흐름)를 추출하여 문자열 시퀀스로 변환합니다.
 * 2. 파일 분석 함수
 * 1. 파일 분석 함수 (.mid는 음표 추출, 나머지는 바이너리 특징 추출)
 * .mid 파일은 음표 시퀀스를 추출하고, AdLib 파일(.ims, .rol, .sop)은 바이너리 패턴 특징을 추출합니다.
 * 1. 파일 분석 함수
 */
async function getFileSequence(filePath, ext) {
    try {
        const fileBuffer = fs.readFileSync(filePath);

        if (ext === '.mid') {
            // MIDI 파일: 주요 멜로디 트랙의 음정 이름 추출
            const midi = new Midi(fileBuffer);
            // 가장 많은 음표(Note)를 가진 트랙을 멜로디 트랙으로 가정합니다.
            let mainTrack = midi.tracks;
            
            midi.tracks.forEach(track => {
                if (track.notes.length > (mainTrack ? mainTrack.notes.length : 0)) {
                    mainTrack = track;
                }
            });

            // 음표들을 시간 순으로 정렬한 뒤, Pitch(음높이) 이름만 추출하여 문자열로 연결합니다.
            // 예: ["C4", "E4", "G4"] -> "C4E4G4"
            if (!mainTrack || mainTrack.notes.length === 0) return "";
            return mainTrack.notes.sort((a, b) => a.time - b.time).map(note => note.name).join('');
        } else {
            // AdLib 파일 (.ims, .rol, .sop): 핵심 데이터 바이트 시퀀스를 특징 문자열로 변환
            // 전체를 다 비교하면 너무 무거우므로 데이터의 특징적 구간(앞부분 최대 2000바이트)을 16진수 문자열로 압축 변환합니다.
            const sampleSize = Math.min(fileBuffer.length, 2000);
            let hexSequence = "";
            for (let i = 0; i < sampleSize; i++) {
                // 노이즈를 줄이기 위해 값이 0이 아니거나 의미 있는 데이터 위주로 시퀀스화
                hexSequence += fileBuffer[i].toString(16).padStart(2, '0');
            }
            return hexSequence;
        }
    } catch (error) {
        return null;
    }
}

/**
 * 2. 두 문자열 시퀀스의 레벤슈타인 거리를 이용해 유사도를 0~1 사이로 계산합니다.
 * 3. 두 시퀀스의 레벤슈타인 거리를 이용한 유사도 계산
 * 2. 레벤슈타인 거리 기반 유사도 계산 (0 ~ 1)
 * 2. 레벤슈타인 거리 기반 유사도 계산
 */
function calculateSimilarity(seq1, seq2) {
    if (!seq1 || !seq2) return 0;
    if (seq1 === seq2) return 1;

    const distance = levenshtein.get(seq1, seq2);
    const maxLength = Math.max(seq1.length, seq2.length);
    
    // 거리 기반 유사도 계산 (1에 가까울수록 유사)
    return 1 - (distance / maxLength);
}

/**
 * 메인 실행 함수
 */
async function main() {
    console.log(`\n🔍 대상 디렉토리: ${TARGET_DIR} (하위 폴더 포함)`);

    if (!fs.existsSync(TARGET_DIR)) {
        console.error(`❌ 오류: '${TARGET_DIR}' 디렉토리가 존재하지 않습니다.`);
        return;
    }

    // 하위 디렉토리까지 모두 뒤져서 파일 수집
    const absoluteFilePaths = getAllFiles(TARGET_DIR);

    if (absoluteFilePaths.length === 0) {
        console.log(`⚠️ 분석 가능한 파일(${TARGET_EXTENSIONS.join(', ')})이 없습니다.`);
        return;
    }

    console.log(`📂 총 ${absoluteFilePaths.length}개의 파일을 찾았습니다.`);
    console.log(`--------------------------------------------------`);

    // 모든 파일의 멜로디 시퀀스 미리 추출
    // 모든 파일의 시퀀스 데이터 추출
    // [1/2 단계] 파일 특징 추출 진행상황
    const songData = [];
    for (let i = 0; i < absoluteFilePaths.length; i++) {
        const fullPath = absoluteFilePaths[i];
        // 표시용 상대 경로 계산 (예: "Folder1/song.ims")
        const displayPath = path.relative(TARGET_DIR, fullPath);
        const percent = (((i + 1) / absoluteFilePaths.length) * 100).toFixed(1);
        
        // 콘솔에 현재 파일 읽는 중임을 한 줄로 업데이트 표시
        process.stdout.write(`\r[1/2] 파일 특징 추출 중... (${percent}%) - ${displayPath.substring(0, 30).padEnd(30, ' ')}`);

        const ext = path.extname(fullPath).toLowerCase();
        const sequence = await getFileSequence(fullPath, ext);
        
        if (sequence) {
            songData.push({ filename: displayPath, sequence });
        }
    }
    console.log(`\n✅ 파일 특징 추출 완료! (성공: ${songData.length}곡)`);

    // 유사도 기반 클러스터링 (그룹화)
    // 2단계: 유사도 비교 및 클러스터링 진행상황 출력
    // [2/2 단계] 유사도 비교 진행상황 (전체 루프 횟수 기준 퍼센트 계산)
    // [2/2 단계] 유사도 비교 진행상황
    console.log(`\n[2/2] 곡 간 유사도 비교 시작...`);
    const visited = new Set();
    const clusters = [];
    const totalSongs = songData.length;

    for (let i = 0; i < totalSongs; i++) {
        // 비교 진행상황 연산 및 출력 (현재 몇 번째 기준 곡을 검사 중인지 표시)
        const comparePercent = (((i + 1) / totalSongs) * 100).toFixed(1);
        process.stdout.write(`\r      연산 진행률... (${comparePercent}%) [${i + 1}/${totalSongs}] - 기준 곡: ${songData[i].filename.substring(0, 20).padEnd(20, ' ')}`);

        if (visited.has(songData[i].filename)) continue;

        // 그룹의 첫 번째 곡이 '기준 곡(Base Song)'이 됩니다.
        const baseSong = songData[i];
        const currentCluster = {
            baseFilename: baseSong.filename,
            matches: [{ filename: baseSong.filename, score: 100 }] // 자기 자신은 100%
        };
        
        visited.add(baseSong.filename);

        for (let j = i + 1; j < totalSongs; j++) {
            if (visited.has(songData[j].filename)) continue;

            const similarity = calculateSimilarity(baseSong.sequence, songData[j].sequence);
            
            // 기준치 이상으로 유사하면 같은 그룹으로 묶음
            if (similarity >= SIMILARITY_THRESHOLD) {
                currentCluster.matches.push({
                    filename: songData[j].filename,
                    score: (similarity * 100).toFixed(1) // 백분율(%) 변환
                });
                visited.add(songData[j].filename);
            }
        }

        clusters.push(currentCluster);
    }
    console.log(`\n✅ 유사도 분석 완료!\n`);

    // 결과 출력
    // 3단계: 최종 결과 출력
    console.log('==================================================');
    console.log('🎵 유사 곡 그룹화 결과 (Threshold: ' + (SIMILARITY_THRESHOLD * 100) + '%)');
    console.log('==================================================');
    
    clusters.forEach((cluster, index) => {
        console.log(`\n▶️ [그룹 ${index + 1}] ------------------------------------`);
        console.log(`  👑 기준 곡: ${cluster.baseFilename}`);
        console.log(`  👥 유사한 곡 리스트 (총 ${cluster.matches.length}곡):`);
        
        // 유사도가 높은 순으로 정렬하여 출력
        cluster.matches
            .sort((a, b) => b.score - a.score)
            .forEach(match => {
                if (match.filename === cluster.baseFilename) return; // 기준 곡은 제외하고 출력
                console.log(`    - [${match.score}% 일치] ${match.filename}`);
            });
            
        if (cluster.matches.length === 1) {
            console.log(`    (이 곡과 유사한 다른 곡을 찾지 못했습니다.)`);
        }
    });
    console.log('\n==================================================');
    
    //console.log('clusters');
    //console.log( JSON.stringify(clusters) );
    const content = JSON.stringify(clusters);
    fs.writeFile(`similar_${ymd}.json`, content, err => {
        if (err) {
            console.error(err);
        } else {
            // file written successfully
        }
    });
    
}

main();

//---------------------------------
function getYYYYMMDDHHmmss(date = new Date()) {
  const pad = (num) => String(num).padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1); // 월은 0부터 시작하므로 +1 필요
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// 사용 예시
//console.log(getYYYYMMDDHHmmss()); 
// 출력 결과 예: "20261114222130"
//---------------------------------
