// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
  // 디버깅을 위한 DOM 요소 확인
  console.log('DOM 로드됨');

  // 모드 드롭다운 초기화
  initModeDropdown();

  // 초기 상태
  updateExamNumber();
  updateDisplay(0);

  // 커스텀 분 드롭다운 이벤트
  const customMinutesDropdown = document.getElementById('custom-minutes');
  if (customMinutesDropdown) {
    customMinutesDropdown.addEventListener('change', function () {
      const minutes = parseInt(this.value);
      if (!isNaN(minutes)) {
        // 모든 타이머 버튼의 active 클래스 제거
        document.querySelectorAll('.time-btn').forEach(btn => {
          btn.classList.remove('active');
        });
        // 커스텀 드롭다운에 active 클래스 추가
        this.classList.add('active');
        setTimer(minutes);
      }
    });
  }

  enableControls(); // 페이지 로드 시 기본 컨트롤 활성화
});

let timer;
let startTime;
let elapsedTime = 0;
let isRunning = false;
let timerDuration = 0; // 분 단위

// 서버 모드 관련 변수
let isServerModeActive = false;
let currentRoomNum = null;

// Supabase 설정 - 실제 프로젝트 값으로 교체 필요
const SUPABASE_URL = 'https://hppcqgogwufilzjhcpuk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwcGNxZ29nd3VmaWx6amhjcHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTYzMTcsImV4cCI6MjA2MjE5MjMxN30.z2MCk-OVaUKn_kq_hsih6LDnG7fWJrt83fhg1OfFxHo';
console.log('Supabase 연결 시도:', SUPABASE_URL);
let supabaseClient;
try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('Supabase 클라이언트 생성 성공:', supabaseClient);

  // Supabase 연결 테스트
  setTimeout(async () => {
    try {
      const { data, error } = await supabaseClient.from('sessions').select('count').limit(1);
      if (error) {
        console.error('Supabase 연결 테스트 실패:', error);
      } else {
        console.log('Supabase 연결 테스트 성공:', data);
      }
    } catch (e) {
      console.error('Supabase 연결 테스트 중 예외 발생:', e);
    }
  }, 1000);
} catch (e) {
  console.error('Supabase 클라이언트 생성 중 오류 발생:', e);
  supabaseClient = null;
}

// DOM 요소
const timerDisplay = document.getElementById('timer');
const timeButtons = document.querySelectorAll('.time-btn');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const examNumberDisplay = document.getElementById('exam-number');
const plusBtn = document.getElementById('plus-btn');
const minusBtn = document.getElementById('minus-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');

// 서버/클라이언트 모드 관련 DOM 요소
const modeTitle = document.getElementById('mode-title');
const modeSelect = document.getElementById('mode-select');
const roomSelect = document.getElementById('room-select');

let examNumber = 0;
let lastExamNumber = 0;
let lastMode = '';
let updateTimeout;
let clientChannel = null;

// 디바운싱 함수들 - 업데이트 유형별 구분
let runningUpdateTimeout; // for debouncedRunningUpdateSession (타이머/스톱워치 실행 중)

// 일반 업데이트용 디바운싱 (1초) - 응시번호 변경 등에 사용
function debouncedUpdateSession(...args) {
  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    updateSession(...args); // updateSession은 exam_number, mode, time_value 등을 업데이트
  }, 1000);
}

// 실행 중 상태 업데이트용 디바운싱 (8초)
function debouncedRunningUpdateSession(...args) {
  clearTimeout(runningUpdateTimeout);
  runningUpdateTimeout = setTimeout(() => {
    updateSession(...args); // updateSession은 exam_number, mode, time_value 등을 업데이트
  }, 8000);
}

// --- 컨트롤 활성화/비활성화 함수 ---
function enableControls() {
  timeButtons.forEach(btn => btn.disabled = false);
  const customMinutesEl = document.getElementById('custom-minutes');
  if (customMinutesEl) customMinutesEl.disabled = false;
  if (startBtn) startBtn.disabled = false;
  if (pauseBtn) pauseBtn.disabled = false;
  if (resetBtn) resetBtn.disabled = false;
  if (plusBtn) plusBtn.disabled = false;
  if (minusBtn) minusBtn.disabled = false;
  console.log('Controls enabled.');
}

function disableClientControls() {
  timeButtons.forEach(btn => btn.disabled = true);
  const customMinutesEl = document.getElementById('custom-minutes');
  if (customMinutesEl) customMinutesEl.disabled = true;
  if (startBtn) startBtn.disabled = true;
  if (pauseBtn) pauseBtn.disabled = true;
  if (resetBtn) resetBtn.disabled = true;
  if (plusBtn) plusBtn.disabled = true;
  if (minusBtn) minusBtn.disabled = true;
  console.log('Client controls disabled.');
}
// --- END 컨트롤 활성화/비활성화 함수 ---

function updateExamNumber() {
  examNumberDisplay.textContent = String(examNumber).padStart(2, '0');
  // 동기화 비교 로직 제거 - 버튼 클릭 시 직접 updateSession 호출하는 방식으로 변경
}

plusBtn.addEventListener('click', () => {
  if (examNumber < 99) {
    const oldValue = examNumber; // 이전 값 저장
    examNumber++;
    updateExamNumber();

    // 응시번호가 변경된 경우에만 DB에 직접 저장 (동기화 비교 없이)
    if (isServerModeActive && currentRoomNum && oldValue !== examNumber) {
      debouncedUpdateSession(
        currentRoomNum,
        !isStopwatchMode ? (timerDuration * 60 * 1000 - elapsedTime) : elapsedTime,
        examNumber,
        isStopwatchMode ? 'stopwatch' : 'timer'
      );
    }
  }
});

minusBtn.addEventListener('click', () => {
  if (examNumber > 0) {
    const oldValue = examNumber; // 이전 값 저장
    examNumber--;
    updateExamNumber();

    // 응시번호가 변경된 경우에만 DB에 직접 저장 (동기화 비교 없이)
    if (isServerModeActive && currentRoomNum && oldValue !== examNumber) {
      debouncedUpdateSession(
        currentRoomNum,
        !isStopwatchMode ? (timerDuration * 60 * 1000 - elapsedTime) : elapsedTime,
        examNumber,
        isStopwatchMode ? 'stopwatch' : 'timer'
      );
    }
  }
});

function updateDisplay(timeValue) {
  const minutes = Math.floor(timeValue / 60000);
  const seconds = Math.floor((timeValue % 60000) / 1000);
  const milliseconds = Math.floor((timeValue % 1000) / 10);
  timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;

  // 서버모드일 때 DB에 저장 - 1초마다만 업데이트하는 코드 삭제
}

function setTimer(minutes) {
  timerDuration = minutes;
  resetTimer(); // 로컬 상태 리셋 (elapsedTime = 0, display 업데이트)

  // 타이머 설정 시 버튼 색상 변경
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeButton = document.querySelector(`.time-btn[data-time="${minutes}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  }

  // 커스텀 드롭다운의 active 클래스 제거
  const customMinutesDropdown = document.getElementById('custom-minutes');
  if (customMinutesDropdown) {
    customMinutesDropdown.classList.remove('active');
  }

  if (isServerModeActive && currentRoomNum) {
    console.log('서버: 타이머 시간 설정 DB 업데이트 (paused 상태로 값만 변경)');
    supabaseClient
      .from('sessions')
      .update({
        time_value: timerDuration * 60 * 1000,
        mode: 'timer',
        exam_number: examNumber,
        updated_at: getSeoulISOString()
      })
      .eq('room_num', currentRoomNum)
      .then(({ error }) => {
        if (error) console.error('타이머 시간 설정 DB 업데이트 실패:', error);
        else console.log('타이머 시간 설정 DB 업데이트 성공 (paused 상태)');
      });
  }
}

timeButtons.forEach(button => {
  button.addEventListener('click', () => {
    const minutes = parseInt(button.dataset.time);
    setTimer(minutes); // 내부에서 DB 업데이트 (시간 값만, paused 상태로)
    // 타이머 설정 후 바로 시작하지 않음
  });
});

function startTimer() {
  if (isRunning || timerDuration === 0) return;
  isRunning = true;
  startTime = Date.now() - elapsedTime;

  timer = setInterval(() => {
    elapsedTime = Date.now() - startTime;
    const timeLeft = timerDuration * 60 * 1000 - elapsedTime;
    if (timeLeft <= 0) {
      clearInterval(timer);
      isRunning = false;
      updateDisplay(0);

      // 타이머 종료 시 버튼 색상 원래대로
      const activeButton = document.querySelector(`.time-btn[data-time="${timerDuration}"]`);
      if (activeButton) {
        activeButton.classList.remove('active');
      }

      // 타이머 종료 시 서버에 상태 전송
      if (isServerModeActive && currentRoomNum) {
        console.log('서버 로컬 타이머 종료, DB 업데이트 시도');
        supabaseClient
          .from('sessions')
          .update({
            ingox: 'paused',
            time_value: 0,
            started_at: null,
            updated_at: getSeoulISOString()
          })
          .eq('room_num', currentRoomNum)
          .then(({ error }) => {
            if (error) console.error('타이머 종료 DB 업데이트 실패:', error);
            else console.log('타이머 종료 DB 업데이트 성공');
          });
      }
      return;
    }

    updateDisplay(timeLeft);

    if (isServerModeActive && currentRoomNum) {
      debouncedRunningUpdateSession(
        currentRoomNum,
        timeLeft,
        examNumber,
        'timer'
      );
    }
  }, 10);
}

function pauseTimer() {
  if (!isRunning) return;
  clearInterval(timer);
  isRunning = false;
}

function stopTimer() {
  clearInterval(timer);
  isRunning = false;
  // elapsedTime = 0; // elapsedTime은 stop 시점의 값을 유지해야 할 수 있음. resetTimer에서 0으로 설정.
  // DB 업데이트 로직은 이 함수를 호출하는 곳에서 처리 (예: startTimer 내부의 시간 종료 시, resetAll 등)
  console.log('Local timer stopped. isRunning set to false.');
}

function resetTimer() {
  stopTimer();
  elapsedTime = 0;
  updateDisplay(timerDuration * 60 * 1000);

  // 리셋 시 버튼 색상 원래대로
  const activeButton = document.querySelector(`.time-btn[data-time="${timerDuration}"]`);
  if (activeButton) {
    activeButton.classList.remove('active');
  }
}

let isStopwatchMode = false;

function startTimerOrStopwatch() {
  if (timerDuration > 0) { // Timer mode
    isStopwatchMode = false;
    startTimer(); // 로컬 타이머 시작 (DB 호출 없음)

    if (isServerModeActive && currentRoomNum) {
      console.log('서버: 타이머 시작 DB 업데이트');
      const initialTimeValue = timerDuration * 60 * 1000 - elapsedTime; // elapsedTime은 보통 0일 것
      supabaseClient
        .from('sessions')
        .update({
          ingox: 'running',
          started_at: getSeoulISOString(),
          time_value: initialTimeValue,
          mode: 'timer',
          exam_number: examNumber,
          updated_at: getSeoulISOString()
        })
        .eq('room_num', currentRoomNum)
        .then(({ error }) => {
          if (error) console.error('타이머 시작 DB 업데이트 실패:', error);
          else console.log('타이머 시작 DB 업데이트 성공');
        });
    }
  } else { // Stopwatch mode
    isStopwatchMode = true;
    startStopwatch(); // 로컬 스톱워치 시작 (DB 호출 없음)

    if (isServerModeActive && currentRoomNum) {
      console.log('서버: 스톱워치 시작 DB 업데이트');
      supabaseClient
        .from('sessions')
        .update({
          ingox: 'running',
          started_at: getSeoulISOString(),
          time_value: elapsedTime,
          mode: 'stopwatch',
          exam_number: examNumber,
          updated_at: getSeoulISOString()
        })
        .eq('room_num', currentRoomNum)
        .then(({ error }) => {
          if (error) console.error('스톱워치 시작 DB 업데이트 실패:', error);
          else console.log('스톱워치 시작 DB 업데이트 성공');
        });
    }
  }
}

function startStopwatch() {
  if (isRunning) return;
  isRunning = true;
  startTime = Date.now() - elapsedTime;

  // 스톱워치 시작 시 DB 업데이트는 startTimerOrStopwatch에서 통합 처리
  // if (isServerModeActive && currentRoomNum) {
  //   immediateSetSessionStatus(currentRoomNum, 'running');
  // }

  timer = setInterval(() => {
    elapsedTime = Date.now() - startTime;
    updateDisplay(elapsedTime);

    if (isServerModeActive && currentRoomNum) {
      debouncedRunningUpdateSession(
        currentRoomNum,
        elapsedTime,
        examNumber,
        'stopwatch'
      );
    }
  }, 10);
}

function pauseAll() {
  clearInterval(timer); // 로컬 타이머/스톱워치 정지
  isRunning = false;    // 로컬 상태 변경

  if (isServerModeActive && currentRoomNum) {
    console.log('서버: 일시정지 DB 업데이트');
    const currentTimeValue = !isStopwatchMode ? (timerDuration * 60 * 1000 - elapsedTime) : elapsedTime;
    supabaseClient
      .from('sessions')
      .update({
        ingox: 'paused',
        started_at: null, // 일시정지 시 started_at은 null
        time_value: currentTimeValue,
        // mode는 변경되지 않음
        exam_number: examNumber, // 응시번호도 현재 상태 반영
        updated_at: getSeoulISOString()
      })
      .eq('room_num', currentRoomNum)
      .then(({ error }) => {
        if (error) console.error('일시정지 DB 업데이트 실패:', error);
        else console.log('일시정지 DB 업데이트 성공');
      });
  }
}

function resetAll() {
  clearInterval(timer);
  isRunning = false;
  elapsedTime = 0;
  timerDuration = 0;
  updateDisplay(0);

  // 모든 버튼의 active 클래스 제거
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // 커스텀 드롭다운의 active 클래스 제거
  const customMinutesDropdown = document.getElementById('custom-minutes');
  if (customMinutesDropdown) {
    customMinutesDropdown.classList.remove('active');
  }

  if (isServerModeActive && currentRoomNum) {
    console.log('서버: 리셋 DB 업데이트');
    supabaseClient
      .from('sessions')
      .update({
        ingox: 'paused',
        started_at: null,
        time_value: 0,
        mode: isStopwatchMode ? 'stopwatch' : 'timer',
        exam_number: examNumber,
        updated_at: getSeoulISOString()
      })
      .eq('room_num', currentRoomNum)
      .then(({ error }) => {
        if (error) console.error('리셋 DB 업데이트 실패:', error);
        else console.log('리셋 DB 업데이트 성공');
      });
  }
}

// 버튼 이벤트 리스너 - DOM 요소가 존재하는 경우에만 실행
if (startBtn) {
  startBtn.removeEventListener('click', startTimer);
  startBtn.addEventListener('click', startTimerOrStopwatch);
} else {
  console.log('startBtn이 존재하지 않습니다.');
}

if (pauseBtn) {
  pauseBtn.removeEventListener('click', pauseTimer);
  pauseBtn.addEventListener('click', pauseAll);
} else {
  console.log('pauseBtn이 존재하지 않습니다.');
}

if (resetBtn) {
  resetBtn.removeEventListener('click', resetTimer);
  resetBtn.addEventListener('click', resetAll);
} else {
  console.log('resetBtn이 존재하지 않습니다.');
}

function updateFullscreenIcon() {
  if (!fullscreenBtn) return;

  if (document.fullscreenElement) {
    fullscreenBtn.classList.add('fullscreen-active');
  } else {
    fullscreenBtn.classList.remove('fullscreen-active');
  }
}

if (fullscreenBtn) {
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });
}

// 전체화면 변경 이벤트 리스너
document.addEventListener('fullscreenchange', updateFullscreenIcon);

// 서울(Asia/Seoul) 시간 기준 yyyy-mm-dd hh:mm:ss 포맷 반환 함수
function getSeoulISOString() {
  // 현재 로컬 시간 사용
  const now = new Date();

  // yyyy-mm-dd hh:mm:ss 포맷
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

// 모드 드롭다운 초기화
function initModeDropdown() {
  console.log('모드 드롭다운 초기화 시작');
  console.log('modeSelect 요소:', modeSelect);
  console.log('roomSelect 요소:', roomSelect);

  if (modeSelect) {
    modeSelect.addEventListener('change', function () {
      const selectedMode = this.value;
      console.log('모드 선택 변경됨:', selectedMode);

      // 기존 방 선택 초기화
      roomSelect.innerHTML = '<option value="">방 선택</option>';

      if (selectedMode === 'server') {
        // 서버 모드 선택 시
        console.log('서버 모드 선택됨');
        modeTitle.textContent = '서버 모드';
        modeTitle.style.color = '#ffb300'; // 주황색으로 변경
        roomSelect.disabled = true; // 로딩 중에는 비활성화
        roomSelect.innerHTML = '<option value="">로딩 중...</option>';

        // 모드 선택 직후 방 목록 로드
        setTimeout(() => {
          loadActiveRooms();
        }, 10);
        enableControls(); // 서버 모드 시 컨트롤 활성화
      } else if (selectedMode === 'client') {
        // 클라이언트 모드 선택 시
        console.log('클라이언트 모드 선택됨');
        modeTitle.textContent = '클라이언트 모드';
        modeTitle.style.color = '#ffb300'; // 주황색으로 변경 (서버 모드와 동일)
        roomSelect.disabled = true; // 로딩 중에는 비활성화
        roomSelect.innerHTML = '<option value="">로딩 중...</option>';
        // 클라이언트 모드는 subscribeToServerSession 성공 시 disableClientControls 호출
        // 실패하거나 방 미선택 시 enableControls 필요

        // 모드 선택 직후 방 목록 로드
        setTimeout(() => {
          loadAllRooms();
        }, 10);
      } else {
        console.log('모드 선택 취소됨');
        modeTitle.textContent = '모드 선택';
        modeTitle.style.color = '#39c0ed'; // 원래 색상으로 변경
        roomSelect.disabled = true;
        enableControls(); // 모드 미선택 시 컨트롤 활성화
      }

      // 서버/클라이언트 모드 전환 시 기존 활성화된 모드 비활성화
      if (isServerModeActive && selectedMode !== 'server') {
        deactivateServerMode();
      }

      if (clientChannel && selectedMode !== 'client') {
        // 클라이언트 모드 비활성화
        supabaseClient.removeChannel(clientChannel);
        clientChannel = null;
      }
    });
  } else {
    console.error('modeSelect 요소를 찾을 수 없습니다!');
  }

  if (roomSelect) {
    // 드롭다운 클릭 이벤트 제거 (모드 선택 시 이미 로드됨)

    roomSelect.addEventListener('change', function () {
      const selectedRoomNumString = this.value;
      const selectedMode = modeSelect.value;

      // 디버깅을 위한 콘솔 로그 추가
      console.log('--- Room Selection Changed ---');
      console.log('Selected Mode:', selectedMode);
      console.log('Selected Room Number from dropdown (this.value):', selectedRoomNumString);
      console.log('Type of selectedRoomNumString:', typeof selectedRoomNumString);
      console.log('Length of selectedRoomNumString:', selectedRoomNumString ? String(selectedRoomNumString).length : 'N/A');

      if (!selectedRoomNumString) {
        console.log('No Room Number selected (dropdown value is empty). Clearing client subscription if any.'); // PIN -> Room Number
        if (clientChannel) {
          supabaseClient.removeChannel(clientChannel);
          clientChannel = null;
        }
        if (modeSelect.value === 'client') {
          modeTitle.textContent = '클라이언트 모드 (방을 선택해주세요)';
          modeTitle.style.color = '#ffb300'; // 주황색으로 변경 (서버 모드와 동일)
        }
        enableControls(); // 방 미선택 시 컨트롤 활성화
        return;
      }
      const selectedRoomNum = parseInt(selectedRoomNumString, 10);

      const selectedOption = this.options[this.selectedIndex];
      const roomStatus = selectedOption.dataset.status;
      console.log('Selected Option data-status:', roomStatus);

      if (selectedMode === 'server') {
        console.log('Mode is Server. Activating server mode with Room Number:', selectedRoomNum);
        activateServerMode(selectedRoomNum);
      } else if (selectedMode === 'client') {
        console.log('Mode is Client. Checking room status for Room Number:', selectedRoomNum);
        if (roomStatus !== 'active') {
          alert('활성화된 방을 선택해주세요.');
          this.value = ''; // 선택 초기화
          console.log('Inactive room selected. Alerted user and reset dropdown.');
          return;
        }
        console.log('Active room selected. Attempting to subscribe to session with Room Number:', selectedRoomNum);
        subscribeToServerSession(selectedRoomNum);
      }
    });
  } else {
    console.error('roomSelect 요소를 찾을 수 없습니다!');
  }
}

// 활성화된 방 목록 로드 (서버 모드)
async function loadActiveRooms(roomToSelect = null) {
  console.log('서버 모드 방 목록 로드 시작');

  try {
    let options = '<option value="">방 선택</option>';
    console.log('Supabase 세션 데이터 요청 중...');
    const { data, error } = await supabaseClient
      .from('sessions')
      .select('room_num, status')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rooms = data; // data.slice(0, 10) 대신 data를 직접 사용
    console.log('Rooms data received from Supabase (for Server Mode):', rooms);

    rooms.forEach((room, index) => {
      console.log(`Processing room (Server Mode): RoomNum=${room.room_num}, Type=${typeof room.room_num}, Status=${room.status}`);
      const roomNumForValue = room.room_num;
      const roomNumForDisplay = room.room_num;
      const isActive = room.status === 'active';
      const statusIndicator = isActive ? '🟢' : '⚫';
      options += `<option value="${roomNumForValue}" data-status="${room.status}">방번호: ${roomNumForDisplay} ${statusIndicator}</option>`;
    });

    roomSelect.innerHTML = options;
    roomSelect.disabled = false;
    if (roomToSelect !== null) {
      roomSelect.value = String(roomToSelect);
      console.log(`서버 모드 드롭다운에서 선택된 방 설정 시도: ${roomToSelect}`);
    }
    console.log('Room list populated for server mode.');

  } catch (err) {
    console.error('(Server Mode) 방 목록 로드 실패:', err);
    roomSelect.innerHTML = '<option value="">방 목록 로드 실패</option>';
    alert(`(서버 모드) 방 목록을 가져오는 중 오류가 발생했습니다: ${err.message || err}`);
    setTimeout(() => {
      roomSelect.innerHTML = '<option value="">방 선택</option>';
      roomSelect.disabled = false;
    }, 2000);
  }
}

// 모든 방 목록 로드 (클라이언트 모드) - 이전 로직으로 복원
async function loadAllRooms() {
  console.log('클라이언트 모드 방 목록 로드 시작');

  try {
    let options = '<option value="">방 선택</option>';
    console.log('Supabase 세션 데이터 요청 중...');
    const { data, error } = await supabaseClient
      .from('sessions')
      .select('room_num, status')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rooms = data; // data.slice(0, 10) 대신 data를 직접 사용
    console.log('Rooms data received from Supabase (for Client Mode):', rooms);

    rooms.forEach((room, index) => {
      console.log(`Processing room (Client Mode): RoomNum=${room.room_num}, Type=${typeof room.room_num}, Status=${room.status}`);
      const roomNumForValue = room.room_num;
      const roomNumForDisplay = room.room_num;
      const isActive = room.status === 'active';
      const statusIndicator = isActive ? '🟢' : '⚫';
      // 클라이언트 모드: 비활성 방은 disabled 처리
      options += `<option value="${roomNumForValue}" data-status="${room.status}" ${!isActive ? 'disabled' : ''}>방번호: ${roomNumForDisplay} ${statusIndicator}</option>`;
    });

    roomSelect.innerHTML = options;
    roomSelect.disabled = false;
    console.log('Room list populated for client mode.');

  } catch (err) {
    console.error('(Client Mode) 방 목록 로드 실패:', err);
    roomSelect.innerHTML = '<option value="">방 목록 로드 실패</option>';
    alert(`(클라이언트 모드) 방 목록을 가져오는 중 오류가 발생했습니다: ${err.message || err}`);
    setTimeout(() => {
      roomSelect.innerHTML = '<option value="">방 선택</option>';
      roomSelect.disabled = false;
    }, 2000);
  }
}

// 서버 모드 활성화 함수 (수정)
function activateServerMode(roomNumber) {
  isServerModeActive = true;
  currentRoomNum = roomNumber;

  // 방 상태를 active로 설정
  supabaseClient
    .from('sessions')
    .update({
      status: 'active',
      updated_at: getSeoulISOString()
    })
    .eq('room_num', roomNumber)
    .then(({ error }) => {
      if (error) {
        console.error('방 활성화 실패:', error);
      } else {
        console.log('방이 활성화되었습니다:', roomNumber);

        // 방 목록을 다시 로드하여 상태 표시 업데이트 및 선택된 방 유지
        if (modeSelect.value === 'server') {
          loadActiveRooms(currentRoomNum);
        }
      }
    });

  // 서버 모드 활성화 표시 (사용자에게는 원래 문자열 PIN 표시 -> 방번호 표시)
  modeTitle.textContent = `서버 모드 (방번호: ${roomNumber})`;
  modeTitle.style.color = '#ffb300'; // 주황색으로 변경
  enableControls(); // 서버 모드 활성화 시 컨트롤 활성화

  // 사용자에게 알림 (사용자에게는 원래 문자열 PIN 표시 -> 방번호 표시)
  alert(`서버 모드가 방번호 [${roomNumber}]으로 활성화되었습니다.`);

  // 서버 모드 관련 추가 기능 구현
  console.log('서버 모드 활성화됨 - 방번호:', roomNumber);
}

// 서버 모드 비활성화 함수 (수정)
async function deactivateServerMode() {
  if (!isServerModeActive || !currentRoomNum) return;

  try {
    // Supabase에서 현재 PIN의 상태를 'inactive'로 업데이트
    const { error } = await supabaseClient
      .from('sessions')
      .update({
        status: 'inactive',
        updated_at: getSeoulISOString()
      })
      .eq('room_num', currentRoomNum);

    if (error) {
      console.error('세션 비활성화 실패:', error);
      alert('세션 비활성화에 실패했습니다: ' + error.message);
      return;
    }

    console.log('세션 비활성화 성공:', currentRoomNum);

    // 서버 모드 관련 변수 초기화
    isServerModeActive = false;
    currentRoomNum = null;

    // 모드 선택 UI 초기화
    modeTitle.textContent = '모드 선택';
    modeTitle.style.color = '#39c0ed'; // 원래 색상으로 변경
    modeSelect.value = '';
    roomSelect.innerHTML = '<option value="">방 선택</option>';
    roomSelect.disabled = true;

    // 타이머/스톱워치 상태 초기화
    clearInterval(timer);
    isRunning = false;
    elapsedTime = 0;
    timerDuration = 0;
    isStopwatchMode = false;
    startTime = 0;

    // 타이머 표시 초기화
    updateDisplay(0);

    // 응시번호 초기화
    examNumber = 0;
    lastExamNumber = 0;
    lastMode = '';
    updateExamNumber();

    // 모든 커스텀 선택 초기화 - DOM에서 직접 요소를 가져와서 초기화
    const customMinutesEl = document.getElementById('custom-minutes');
    if (customMinutesEl) {
      customMinutesEl.selectedIndex = 0;
    }
    enableControls(); // 서버 모드 비활성화 시 컨트롤 활성화

    console.log('모든 값이 초기화되었습니다.');
    alert('서버 모드가 비활성화되고 모든 값이 초기화되었습니다.');

  } catch (err) {
    console.error('서버 모드 비활성화 오류:', err);
    alert('서버 모드 비활성화 중 오류가 발생했습니다: ' + err.message);
  }
}

// 클라이언트 모드 연결 함수 (수정)
function subscribeToServerSession(roomNumber) {
  // 함수 시작 시 전달받은 pin 값 로깅
  console.log('--- Inside subscribeToServerSession ---');
  console.log('Received Room Number for subscription:', roomNumber);
  console.log('Type of received Room Number:', typeof roomNumber);

  if (!roomNumber || isNaN(roomNumber) || roomNumber < 1) {
    alert('올바른 서버 방번호를 선택해주세요.');
    console.error('Invalid Room Number for subscription. Alerted user.', { room_num: roomNumber });
    return;
  }

  // 기존 구독 해제
  if (clientChannel) {
    supabaseClient.removeChannel(clientChannel);
    clientChannel = null;
  }

  // 최초 값 동기화
  supabaseClient
    .from('sessions')
    .select('*')
    .eq('room_num', roomNumber)
    .single()
    .then(({ data, error }) => {
      if (error || !data) {
        alert('해당 방번호의 서버 세션이 없습니다.');
        return;
      }

      // 클라이언트 모드 표시 업데이트
      modeTitle.textContent = `클라이언트 모드 (방번호: ${roomNumber})`;
      modeTitle.style.color = '#ffb300'; // 주황색으로 변경 (서버 모드와 동일)
      disableClientControls(); // 클라이언트 모드 성공적 연결 시 컨트롤 비활성화

      // 최초 값 적용
      console.log('최초 세션 데이터 적용:', data);
      applySessionDataToClient(data);
    });

  // 실시간 구독 - 필요한 필드만 선택
  clientChannel = supabaseClient
    .channel('session-sync-room-' + roomNumber)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `room_num=eq.${roomNumber}`,
        // 모든 관련 필드 포함
        columns: ['time_value', 'stopwatch_value', 'exam_number', 'mode', 'ingox', 'started_at', 'status', 'room_num', 'updated_at']
      },
      (payload) => {
        if (payload.new) {
          // 세션 상태가 변경된 경우 방 상태 표시 업데이트
          if (payload.new.status !== payload.old?.status) {
            updateRoomStatusIndicator(payload.new.room_num, payload.new.status === 'active');
          }

          console.log('실시간 세션 업데이트 감지:', payload.new);
          // 실시간 업데이트 적용
          applySessionDataToClient(payload.new);
        }
      }
    )
    .subscribe((status) => {
      console.log(`Subscription status: ${status}`);
      if (status === 'SUBSCRIBED') {
        console.log('실시간 동기화가 활성화되었습니다.');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('실시간 동기화 연결에 실패했습니다.');
        alert('서버와의 실시간 연결에 실패했습니다. 페이지를 새로고침하고 다시 시도해주세요.');
      }
    });
}

// 방 상태 표시 업데이트
function updateRoomStatusIndicator(roomNumber, isActive) {
  const options = roomSelect.querySelectorAll('option');

  for (const option of options) {
    // option.value는 문자열이므로, roomNumber를 문자열로 변환하여 비교하거나, option.value를 숫자로 변환
    if (option.value === String(roomNumber)) {
      // 모든 기존 상태 표시(녹색 또는 검은색 동그라미)를 제거합니다.
      const baseText = option.textContent.replace(/[🟢⚫]/g, '').trim(); // 'g' 플래그를 사용하여 모든 일치 항목을 제거
      option.textContent = `${baseText} ${isActive ? '🟢' : '⚫'}`;
      break;
    }
  }
}

// 서버모드: 값 변경 시 DB에 저장 함수 (부분 업데이트용)
//主に debouncedUpdateSession 와 debouncedRunningUpdateSession 에서 호출됩니다.
async function updateSession(roomNumber, timeValue, examNumber, mode) {
  if (!isServerModeActive || !roomNumber) return;
  console.log(`Partial updateSession: room=${roomNumber}, time=${timeValue}, examNum=${examNumber}, mode=${mode}`);

  const updateData = {};
  if (timeValue !== undefined) updateData.time_value = timeValue;
  if (examNumber !== undefined) updateData.exam_number = examNumber;
  if (mode !== undefined) updateData.mode = mode;

  if (Object.keys(updateData).length === 0) {
    console.log('No data to update in updateSession');
    return;
  }
  updateData.updated_at = getSeoulISOString();

  const { data, error } = await supabaseClient
    .from('sessions')
    .update(updateData)
    .eq('room_num', roomNumber);
  if (error) {
    console.error('DB partial update 실패:', error);
  }
}

// 클라이언트 화면에 서버 세션 데이터 반영 (진행중이면 자동 실행)
function applySessionDataToClient(data) {
  console.log('Applying session data to client. Raw data:', data); // Log raw data as object

  const baseTimeValue = (typeof data.time_value === 'number' && !isNaN(data.time_value)) ? data.time_value : 0;
  let calculatedTime = baseTimeValue;

  if (data.ingox === 'running' && data.started_at) {
    const startedAtTimestamp = new Date(data.started_at.replace(' ', 'T') + '+09:00'); // KST offset
    if (!isNaN(startedAtTimestamp.getTime())) {
      const now = new Date();
      const elapsedMillis = now.getTime() - startedAtTimestamp.getTime();
      if (data.mode === 'timer') {
        calculatedTime = baseTimeValue - elapsedMillis;
      } else { // stopwatch mode
        calculatedTime = baseTimeValue + elapsedMillis;
      }
    } else {
      console.warn('Invalid data.started_at received:', data.started_at, '- using baseTimeValue for calculations. CalculatedTime will be baseTimeValue.');
      // calculatedTime remains baseTimeValue
    }
  }

  // Ensure calculatedTime is not negative, default to 0 if it became NaN somehow (shouldn't with above)
  calculatedTime = (typeof calculatedTime === 'number' && !isNaN(calculatedTime)) ? Math.max(0, calculatedTime) : 0;

  console.log(`Applying data: mode=${data.mode}, ingox=${data.ingox}, baseTimeValue=${baseTimeValue}, final calculatedTime=${calculatedTime}`);

  // 현재 타이머/스톱워치 상태가 실행 중인지 여부 저장
  const wasRunning = isRunning;

  // 실행 중인 타이머가 있다면 정리
  if (isRunning) {
    clearInterval(timer);
    isRunning = false;
  }

  if (data.mode === 'timer') {
    const actualRemainingTimeMs = calculatedTime; // MS 단위

    updateDisplay(actualRemainingTimeMs); // 현재 남은 시간을 화면에 표시
    isStopwatchMode = false; // 타이머 모드임을 명확히 함

    // 클라이언트의 타이머 실행 기준을 서버의 현재 상태에 맞게 재설정
    // timerDuration (전역 변수, 분 단위)을 현재 남은 시간으로 설정
    timerDuration = actualRemainingTimeMs / (60 * 1000);
    // elapsedTime (전역 변수, ms 단위)을 0으로 설정
    elapsedTime = 0;

    if (data.ingox === 'running' && actualRemainingTimeMs > 0) {
      // 서버 상태가 running이면 항상 타이머 시작 - 이전 상태 관계없이
      console.log('타이머 실행 중 - 서버 상태 동기화: running');
      startTimer();
    } else {
      // 서버에서 타이머가 일시 중지되었거나 종료됨
      console.log('타이머 중지됨 - 서버 상태 동기화: 일시정지 또는 종료');
      isRunning = false;
      if (actualRemainingTimeMs <= 0) {
        updateDisplay(0); // 시간이 다 되었으면 화면에 0 표시
      }
    }
  } else { // stopwatch mode
    const swValue = calculatedTime;
    timerDuration = 0;
    elapsedTime = swValue; // For stopwatch, elapsedTime is the current count
    updateDisplay(swValue);
    isStopwatchMode = true;

    if (data.ingox === 'running') {
      console.log('스톱워치 실행 중 - 서버 상태 동기화: running');
      startStopwatch();
    } else {
      console.log('스톱워치 중지됨 - 서버 상태 동기화: 일시정지');
      isRunning = false;
    }
  }

  examNumber = (typeof data.exam_number === 'number' && !isNaN(data.exam_number)) ? data.exam_number : 0;
  updateExamNumber();
} 