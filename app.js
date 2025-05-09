// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
  // 디버깅을 위한 DOM 요소 확인
  console.log('DOM 로드됨');

  // 모드 드롭다운 초기화
  initModeDropdown();

  // 초기 상태
  updateExamNumber();
  updateDisplay(0);

  // 주기적으로 방 목록 갱신 (30초마다)
  initRoomListRefresh();

  // 커스텀 분 드롭다운 이벤트
  const customMinutesDropdown = document.getElementById('custom-minutes');
  if (customMinutesDropdown) {
    customMinutesDropdown.addEventListener('change', function () {
      const minutes = parseInt(this.value);
      if (!isNaN(minutes)) {
        setTimer(minutes);
        startTimer(); // 드롭다운 선택 시 즉시 타이머 시작
      }
    });
  }
});

let timer;
let startTime;
let elapsedTime = 0;
let isRunning = false;
let timerDuration = 0; // 분 단위

// 서버 모드 관련 변수
let isServerModeActive = false;
let currentPin = null;

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

function debouncedUpdateSession(...args) {
  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    updateSession(...args);
  }, 1000); // 1초 동안 추가 업데이트가 없을 때만 실행
}

function updateExamNumber() {
  examNumberDisplay.textContent = String(examNumber).padStart(2, '0');
  // 상태가 변경되었을 때만 업데이트
  if (isServerModeActive && currentPin &&
    (lastExamNumber !== examNumber || lastMode !== (isStopwatchMode ? 'stopwatch' : 'timer'))) {
    debouncedUpdateSession(
      currentPin,
      !isStopwatchMode ? (timerDuration * 60 * 1000 - elapsedTime) : 0,
      isStopwatchMode ? elapsedTime : 0,
      examNumber,
      isStopwatchMode ? 'stopwatch' : 'timer'
    );
    lastExamNumber = examNumber;
    lastMode = isStopwatchMode ? 'stopwatch' : 'timer';
  }
}

plusBtn.addEventListener('click', () => {
  if (examNumber < 99) examNumber++;
  updateExamNumber();
});
minusBtn.addEventListener('click', () => {
  if (examNumber > 0) examNumber--;
  updateExamNumber();
});

function updateDisplay(timeValue) {
  const minutes = Math.floor(timeValue / 60000);
  const seconds = Math.floor((timeValue % 60000) / 1000);
  const milliseconds = Math.floor((timeValue % 1000) / 10);
  timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;

  // 서버모드일 때 DB에 저장 - 1초마다만 업데이트
  if (isServerModeActive && currentPin) {
    if (Math.floor(elapsedTime / 1000) !== Math.floor((elapsedTime - 10) / 1000)) {
      debouncedUpdateSession(
        currentPin,
        !isStopwatchMode ? timeValue : 0,
        isStopwatchMode ? timeValue : 0,
        examNumber,
        isStopwatchMode ? 'stopwatch' : 'timer'
      );
    }
  }
}

function setTimer(minutes) {
  timerDuration = minutes;
  resetTimer();
  updateDisplay(timerDuration * 60 * 1000);
}

timeButtons.forEach(button => {
  button.addEventListener('click', () => {
    const minutes = parseInt(button.dataset.time);
    setTimer(minutes);
    startTimer(); // 버튼 클릭 시 즉시 타이머 시작
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
      stopTimer();
      updateDisplay(0);
      return;
    }
    updateDisplay(timeLeft);
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
  elapsedTime = 0;
}

function resetTimer() {
  stopTimer();
  elapsedTime = 0;
  updateDisplay(timerDuration * 60 * 1000);
}

let isStopwatchMode = false;

function startTimerOrStopwatch() {
  if (timerDuration > 0) {
    isStopwatchMode = false;
    startTimer();
    if (isServerModeActive && currentPin) setSessionStatus(currentPin, 'running');
  } else {
    isStopwatchMode = true;
    startStopwatch();
    if (isServerModeActive && currentPin) setSessionStatus(currentPin, 'running');
  }
}

function startStopwatch() {
  if (isRunning) return;
  isRunning = true;
  startTime = Date.now() - elapsedTime;
  timer = setInterval(() => {
    elapsedTime = Date.now() - startTime;
    updateDisplay(elapsedTime);
  }, 10);
}

function pauseAll() {
  clearInterval(timer);
  isRunning = false;
  if (isServerModeActive && currentPin) setSessionStatus(currentPin, 'paused');
}

function resetAll() {
  clearInterval(timer);
  isRunning = false;
  elapsedTime = 0;
  timerDuration = 0;
  updateDisplay(0);
  if (isServerModeActive && currentPin) setSessionStatus(currentPin, 'paused');
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
  const now = new Date();
  // 서울 UTC+9
  const offset = 9 * 60;
  const local = new Date(now.getTime() + (offset - now.getTimezoneOffset()) * 60000);
  // yyyy-mm-dd hh:mm:ss 포맷
  const yyyy = local.getFullYear();
  const mm = String(local.getMonth() + 1).padStart(2, '0');
  const dd = String(local.getDate()).padStart(2, '0');
  const hh = String(local.getHours()).padStart(2, '0');
  const min = String(local.getMinutes()).padStart(2, '0');
  const ss = String(local.getSeconds()).padStart(2, '0');
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
        console.log('서버 모드 선택됨, loadActiveRooms 호출');
        loadActiveRooms();
        modeTitle.textContent = '서버 모드';
        roomSelect.disabled = false;
      } else if (selectedMode === 'client') {
        // 클라이언트 모드 선택 시
        console.log('클라이언트 모드 선택됨, loadAllRooms 호출');
        loadAllRooms();
        modeTitle.textContent = '클라이언트 모드';
        roomSelect.disabled = false;
      } else {
        console.log('모드 선택 취소됨');
        modeTitle.textContent = '모드 선택';
        roomSelect.disabled = true;
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
    roomSelect.addEventListener('change', function () {
      const selectedPin = this.value;
      const selectedMode = modeSelect.value;
      console.log('방 선택 변경됨:', selectedPin, '모드:', selectedMode);

      if (!selectedPin) return;

      if (selectedMode === 'server') {
        // 서버 모드에서 방 선택 시
        activateServerMode(selectedPin);
      } else if (selectedMode === 'client') {
        // 클라이언트 모드에서 방 선택 시
        subscribeToServerSession(selectedPin);
      }
    });
  } else {
    console.error('roomSelect 요소를 찾을 수 없습니다!');
  }
}

// 활성화된 방 목록 로드 (서버 모드)
async function loadActiveRooms() {
  console.log('서버 모드 방 목록 로드 시작');
  roomSelect.disabled = true;
  roomSelect.innerHTML = '<option value="">로딩 중...</option>';

  try {
    // 방 선택 옵션만 추가
    let options = '<option value="">방 선택</option>';

    // 클라이언트와 동일하게 모든 방 목록 가져오기 (status 조건 제거)
    console.log('Supabase 세션 데이터 요청 중...');
    const { data, error } = await supabaseClient
      .from('sessions')
      .select('pin, status')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 최대 10개 방 표시
    const rooms = data.slice(0, 10);

    rooms.forEach((room, index) => {
      const isActive = room.status === 'active';
      const statusIndicator = isActive ? '🟢' : '⚫';
      options += `<option value="${room.pin}">PIN: ${room.pin}</option>`;
    });

    rooms.forEach((room, index) => {
      const isActive = room.status === 'active';
      const statusIndicator = isActive ? '🟢' : '⚫';
      options += `<option value="${room.pin}">PIN: ${room.pin} ${statusIndicator}</option>`;
    });

    rooms.forEach((room, index) => {
      const isActive = room.status === 'active';
      const statusIndicator = isActive ? '🟢' : '⚫';
      options += `<option value="${room.pin}">PIN: ${room.pin} ${statusIndicator}</option>`;
    });

    console.log('방 목록 생성 완료:', options);
    roomSelect.innerHTML = options;
    roomSelect.disabled = false;

  } catch (err) {
    console.error('방 목록 로드 실패:', err);
    roomSelect.innerHTML = '<option value="">방 목록 로드 실패</option>';
    alert(`방 목록을 가져오는 중 오류가 발생했습니다: ${err.message || err}`);
    setTimeout(() => {
      roomSelect.innerHTML = '<option value="">방 선택</option>';
      roomSelect.disabled = false;
    }, 2000);
  }
}

// 모든 방 목록 로드 (클라이언트 모드)
async function loadAllRooms() {
  roomSelect.disabled = true;
  roomSelect.innerHTML = '<option value="">로딩 중...</option>';

  try {
    // 방 선택 옵션만 추가
    let options = '<option value="">방 선택</option>';

    // 클라이언트와 동일하게 모든 방 목록 가져오기 (status 조건 제거)
    console.log('Supabase 세션 데이터 요청 중...');
    const { data, error } = await supabaseClient
      .from('sessions')
      .select('pin, status')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 최대 10개 방 표시
    const rooms = data.slice(0, 10);

    rooms.forEach((room, index) => {
      const isActive = room.status === 'active';
      const statusIndicator = isActive ? '🟢' : '⚫';
      options += `<option value="${room.pin}">PIN: ${room.pin} ${statusIndicator}</option>`;
    });

    roomSelect.innerHTML = options;
    roomSelect.disabled = false;

  } catch (err) {
    console.error('방 목록 로드 실패:', err);
    roomSelect.innerHTML = '<option value="">방 목록 로드 실패</option>';
    setTimeout(() => {
      roomSelect.innerHTML = '<option value="">방 선택</option>';
      roomSelect.disabled = false;
    }, 2000);
  }
}

// 서버 모드 활성화 함수 (수정)
function activateServerMode(pin) {
  isServerModeActive = true;
  currentPin = pin;

  // 방 상태를 active로 설정
  supabaseClient
    .from('sessions')
    .update({
      status: 'active',
      updated_at: getSeoulISOString()
    })
    .eq('pin', pin)
    .then(({ error }) => {
      if (error) {
        console.error('방 활성화 실패:', error);
      } else {
        console.log('방이 활성화되었습니다:', pin);

        // 방 목록을 다시 로드하여 상태 표시 업데이트
        if (modeSelect.value === 'server') {
          loadActiveRooms();
        }
      }
    });

  // 서버 모드 활성화 표시
  modeTitle.textContent = `서버 모드 (PIN: ${pin})`;

  // 사용자에게 알림
  alert(`서버 모드가 PIN [${pin}]으로 활성화되었습니다.`);

  // 서버 모드 관련 추가 기능 구현
  console.log('서버 모드 활성화됨 - PIN:', pin);
}

// 서버 모드 비활성화 함수 (수정)
async function deactivateServerMode() {
  if (!isServerModeActive || !currentPin) return;

  try {
    // Supabase에서 현재 PIN의 상태를 'inactive'로 업데이트
    const { error } = await supabaseClient
      .from('sessions')
      .update({
        status: 'inactive',
        updated_at: getSeoulISOString()
      })
      .eq('pin', currentPin);

    if (error) {
      console.error('세션 비활성화 실패:', error);
      alert('세션 비활성화에 실패했습니다: ' + error.message);
      return;
    }

    console.log('세션 비활성화 성공:', currentPin);

    // 로컬 상태 초기화
    isServerModeActive = false;
    currentPin = null;
    modeTitle.textContent = '서버 모드';

    // 타이머 상태 초기화
    stopTimer();
    elapsedTime = 0;
    updateDisplay(0);

    // 응시번호 초기화
    examNumber = 0;
    updateExamNumber();

    // 방 목록 다시 로드
    if (modeSelect.value === 'server') {
      loadActiveRooms();
    }

  } catch (err) {
    console.error('서버 모드 비활성화 오류:', err);
    alert('서버 모드 비활성화 중 오류가 발생했습니다: ' + err.message);
  }
}

// 클라이언트 모드 연결 함수 (수정)
function subscribeToServerSession(pin) {
  if (!pin || pin.length !== 4) {
    alert('올바른 서버 PIN을 선택해주세요.');
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
    .eq('pin', pin)
    .single()
    .then(({ data, error }) => {
      if (error || !data) {
        alert('해당 PIN의 서버 세션이 없습니다.');
        return;
      }

      // 클라이언트 모드 표시 업데이트
      modeTitle.textContent = `클라이언트 모드 (PIN: ${pin})`;

      applySessionDataToClient(data);
    });

  // 실시간 구독 - 필요한 필드만 선택
  clientChannel = supabaseClient
    .channel('session-sync-' + pin)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `pin=eq.${pin}`,
        // 필요한 필드만 선택
        columns: ['timer_value', 'stopwatch_value', 'exam_number', 'mode', 'ingox', 'started_at', 'status']
      },
      (payload) => {
        if (payload.new) {
          // 세션 상태가 변경된 경우 방 상태 표시 업데이트
          if (payload.new.status !== payload.old?.status) {
            updateRoomStatusIndicator(pin, payload.new.status === 'active');
          }

          applySessionDataToClient(payload.new);
        }
      }
    )
    .subscribe();
}

// 방 상태 표시 업데이트
function updateRoomStatusIndicator(pin, isActive) {
  const options = roomSelect.querySelectorAll('option');

  for (const option of options) {
    if (option.value === pin) {
      const baseText = option.textContent.replace(/[🟢⚫]/, '').trim();
      option.textContent = `${baseText} ${isActive ? '🟢' : '⚫'}`;
      break;
    }
  }
}

// 주기적으로 방 목록 갱신
function initRoomListRefresh() {
  setInterval(() => {
    if (modeSelect.value === 'server') {
      loadActiveRooms();
    } else if (modeSelect.value === 'client') {
      loadAllRooms();
    }
  }, 30000); // 30초마다 갱신
}

// 서버모드: 값 변경 시 DB에 저장 함수
async function updateSession(pin, timerValue, stopwatchValue, examNumber, mode) {
  if (!pin) return;
  const { data, error } = await supabaseClient
    .from('sessions')
    .update({
      timer_value: timerValue,
      stopwatch_value: stopwatchValue,
      exam_number: examNumber,
      mode: mode,
      updated_at: getSeoulISOString()
    })
    .eq('pin', pin);
  if (error) {
    console.error('DB 업데이트 실패:', error);
  }
}

// 클라이언트 화면에 서버 세션 데이터 반영 (진행중이면 자동 실행)
function applySessionDataToClient(data) {
  // 타이머/스탑워치/응시번호 UI에 값 반영
  if (data.mode === 'timer') {
    // 남은 시간 보정
    let remain = data.timer_value;
    if (data.ingox === 'running' && data.started_at) {
      const now = new Date();
      const startedAt = new Date(data.started_at.replace(' ', 'T') + '+09:00');
      const elapsed = (now - startedAt) / 1000; // 초
      remain = data.timer_value - elapsed * 1000;
    }
    timerDuration = Math.ceil(remain / 60000);
    elapsedTime = 0;
    updateDisplay(remain > 0 ? remain : 0);
    isStopwatchMode = false;
    if (data.ingox === 'running' && remain > 0) startTimer();
    else { isRunning = false; clearInterval(timer); }
  } else {
    // 스탑워치 경과 시간 보정
    let swValue = data.stopwatch_value;
    if (data.ingox === 'running' && data.started_at) {
      const now = new Date();
      const startedAt = new Date(data.started_at.replace(' ', 'T') + '+09:00');
      const elapsed = (now - startedAt) / 1000; // 초
      swValue = data.stopwatch_value + elapsed * 1000;
    }
    timerDuration = 0;
    elapsedTime = swValue;
    updateDisplay(swValue);
    isStopwatchMode = true;
    if (data.ingox === 'running') startStopwatch();
    else { isRunning = false; clearInterval(timer); }
  }
  examNumber = data.exam_number;
  updateExamNumber();
}

// --- status, started_at 동기화용 함수 추가 ---
async function setSessionStatus(pin, status) {
  await supabaseClient
    .from('sessions')
    .update({
      ingox: status,
      started_at: status === 'running' ? getSeoulISOString() : null,
      updated_at: getSeoulISOString()
    })
    .eq('pin', pin);
} 