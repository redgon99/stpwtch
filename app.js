// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
  // 디버깅을 위한 DOM 요소 확인
  console.log('DOM 로드됨');
  console.log('서버 스위치 요소:', serverSwitch);
  console.log('핀 입력 컨테이너 요소:', pinInputContainer);

  // 서버 스위치 이벤트 리스너 설정
  console.log('DOM 로드됨, 서버 스위치:', serverSwitch);

  // 서버 스위치 이벤트 리스너 다시 설정
  if (serverSwitch) {
    console.log('[init] 서버 스위치 요소 찾음');
    serverSwitch.addEventListener('change', async function () {
      console.log('[서버 스위치 이벤트] 상태 변경:', this.checked);

      if (this.checked) {
        // 1. 서버 스위치가 켜짐
        console.log('[서버 스위치 이벤트] 서버 스위치 ON');
        // 2. 핀 입력창 표시 함수 호출
        togglePinContainer(true);
        // 3. 클라이언트 스위치 끄고 비활성화
        if (clientSwitch) {
          clientSwitch.checked = false;
          clientSwitch.disabled = true;
          console.log('[서버 스위치 이벤트] 클라이언트 스위치 OFF 및 비활성화');
        }
      } else {
        // 서버 스위치가 꺼짐
        console.log('[서버 스위치 이벤트] 서버 스위치 OFF');
        // 세션 비활성화
        await deactivateServerMode();
        // 핀 입력창 숨기기
        togglePinContainer(false);
        if (clientSwitch) {
          clientSwitch.disabled = false;
          console.log('[서버 스위치 이벤트] 클라이언트 스위치 활성화');
        }
      }
    });

    // 수동으로 변경 이벤트 발생 - 페이지 로드 시 이미 체크되어 있는 경우 처리
    console.log('초기 서버 스위치 상태:', serverSwitch.checked);
    if (serverSwitch.checked) {
      console.log('[init] 서버 스위치가 이미 켜져 있음, 핀 입력창 표시');
      togglePinContainer(true);
      if (clientSwitch) clientSwitch.disabled = true;
    }
  } else {
    console.log('[init] 서버 스위치 요소를 찾을 수 없음');
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
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

// 서버 모드 관련 DOM 요소
const serverSwitch = document.getElementById('side-switch');
const clientSwitch = document.getElementById('client-switch');
const pinInputContainer = document.getElementById('pin-container');
const pinInput = document.getElementById('pin-input');
const pinSubmitBtn = document.getElementById('pin-submit-btn');
const serverSwitchLabel = document.querySelector('.side-switch-label');

let examNumber = 0;
let lastExamNumber = 0;
let lastMode = '';
let updateTimeout;

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
    // 타이머 모드
    isStopwatchMode = false;
    startTimer();
  } else {
    // 스탑워치 모드
    isStopwatchMode = true;
    startStopwatch();
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
}

function resetAll() {
  clearInterval(timer);
  isRunning = false;
  elapsedTime = 0;
  timerDuration = 0;
  updateDisplay(0);
}

startBtn.removeEventListener('click', startTimer); // 기존 이벤트 제거
startBtn.addEventListener('click', startTimerOrStopwatch);
pauseBtn.removeEventListener('click', pauseTimer); // 기존 이벤트 제거
pauseBtn.addEventListener('click', pauseAll);
resetBtn.removeEventListener('click', resetTimer); // 기존 이벤트 제거
resetBtn.addEventListener('click', resetAll);

function updateFullscreenIcon() {
  if (document.fullscreenElement) {
    fullscreenBtn.classList.add('fullscreen-active');
  } else {
    fullscreenBtn.classList.remove('fullscreen-active');
  }
}

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});
document.addEventListener('fullscreenchange', updateFullscreenIcon);

// PIN 입력 필드 키 이벤트 (Enter 키 누르면 제출)
pinInput.addEventListener('keypress', function (e) {
  if (e.key === 'Enter') {
    submitPin();
  }
});

// PIN 입력 필드 변화 이벤트 (숫자만 입력 가능)
pinInput.addEventListener('input', function () {
  // 숫자가 아닌 문자 제거
  this.value = this.value.replace(/[^\d]/g, '');

  // 최대 4자리
  if (this.value.length > 4) {
    this.value = this.value.slice(0, 4);
  }
});

// PIN 제출 버튼 클릭 이벤트
pinSubmitBtn.addEventListener('click', submitPin);

// PIN 제출 처리 함수
async function submitPin() {
  const pin = pinInput.value;

  if (pin.length !== 4) {
    alert('PIN은 4자리 숫자로 입력해주세요.');
    return;
  }

  try {
    // Supabase에 PIN 저장 (실제 DB 연동은 Supabase 설정 완료 후)
    if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
      // Supabase가 설정된 경우에만 실행
      const { data, error } = await supabaseClient
        .from('sessions')  // 테이블명은 실제 DB에 맞게 변경
        .insert([{
          pin: pin,
          created_at: new Date().toISOString(),
          status: 'active'
        }])
        .select();

      if (error) {
        console.error('PIN 저장 실패:', error);
        alert('PIN 저장에 실패했습니다: ' + error.message);
        return;
      }

      console.log('PIN 저장 성공:', data);
    } else {
      // 개발 모드: Supabase 미설정 시 콘솔에만 로그
      console.log('개발 모드: PIN이 저장되었다고 가정합니다 -', pin);
    }

    // 서버 모드 활성화
    activateServerMode(pin);

  } catch (err) {
    console.error('오류 발생:', err);
    alert('오류가 발생했습니다: ' + err.message);
  }
}

// 서버 모드 활성화 함수
function activateServerMode(pin) {
  isServerModeActive = true;
  currentPin = pin;

  // PIN 입력 UI 숨기기
  pinInputContainer.style.display = 'none';

  // 서버 모드 활성화 표시
  updateServerLabel(true);

  // 사용자에게 알림
  alert(`서버 모드가 PIN [${pin}]으로 활성화되었습니다.`);

  // 여기에 서버 모드 관련 추가 기능 구현
  console.log('서버 모드 활성화됨 - PIN:', pin);
}

// 서버 모드 비활성화 함수
async function deactivateServerMode() {
  if (!isServerModeActive || !currentPin) return;

  try {
    // Supabase에서 현재 PIN의 상태를 'inactive'로 업데이트
    const { error } = await supabaseClient
      .from('sessions')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
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
    updateServerLabel(false);

    // 타이머 상태 초기화
    stopTimer();
    elapsedTime = 0;
    updateDisplay(0);

    // 응시번호 초기화
    examNumber = 0;
    updateExamNumber();

  } catch (err) {
    console.error('서버 모드 비활성화 오류:', err);
    alert('서버 모드 비활성화 중 오류가 발생했습니다: ' + err.message);
  }
}

// 서버 라벨 업데이트 함수
function updateServerLabel(isActive) {
  // 이미 있는 인디케이터가 있으면 제거
  const existingIndicator = serverSwitchLabel.querySelector('.server-mode-active-indicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }

  if (isActive && currentPin) {
    // 활성화 상태 표시 추가
    const indicator = document.createElement('span');
    indicator.className = 'server-mode-active-indicator';
    indicator.textContent = ` (PIN: ${currentPin})`;
    serverSwitchLabel.appendChild(indicator);
  }
}

// 클라이언트 스위치 change 이벤트 리스너 통합
clientSwitch.addEventListener('change', function () {
  if (this.checked) {
    // 클라이언트 핀 입력창 표시
    clientPinInputContainer.style.display = 'flex';
    clientPinInput.value = '';
    clientPinInput.focus();
    // 서버 스위치 비활성화
    serverSwitch.checked = false;
    serverSwitch.disabled = true;
  } else {
    // 클라이언트 핀 입력창 숨김
    clientPinInputContainer.style.display = 'none';
    // 서버 스위치 활성화
    serverSwitch.disabled = false;
    // 구독 해제
    if (clientChannel) {
      supabaseClient.removeChannel(clientChannel);
      clientChannel = null;
    }
    // 클라이언트 PIN 표시도 제거
    const existingIndicator = clientSwitchLabel.querySelector('.client-mode-active-indicator');
    if (existingIndicator) existingIndicator.remove();
  }
});

// 초기 상태
updateExamNumber();
updateDisplay(0);

// 서버 스위치 변경 이벤트 - 수정된 부분
function togglePinContainer(show) {
  if (pinInputContainer) {
    console.log('[togglePinContainer] 실행, show:', show);
    pinInputContainer.style.display = show ? 'flex' : 'none';
    if (show && pinInput) {
      setTimeout(() => {
        console.log('[togglePinContainer] 핀 입력창에 포커스 시도');
        pinInput.focus();
      }, 100);
    }
  } else {
    console.log('[togglePinContainer] pinInputContainer가 null입니다');
  }
}

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
      updated_at: new Date().toISOString()
    })
    .eq('pin', pin);
  if (error) {
    console.error('DB 업데이트 실패:', error);
  }
}

// 클라이언트 모드 관련 DOM
const clientPinInputContainer = document.getElementById('client-pin-container');
const clientPinInput = document.getElementById('client-pin-input');
const clientPinSubmitBtn = document.getElementById('client-pin-submit-btn');
let clientChannel = null;

// 클라이언트 스위치 라벨
const clientSwitchLabel = document.querySelectorAll('.side-switch-label')[1];

// 클라이언트 핀 확인 버튼
clientPinSubmitBtn.addEventListener('click', function () {
  subscribeToServerSession();
  showClientPinLabel(clientPinInput.value);
  // 핀 입력 후 입력창 숨김
  clientPinInputContainer.style.display = 'none';
});

function showClientPinLabel(pin) {
  // 이미 있는 인디케이터가 있으면 제거
  const existingIndicator = clientSwitchLabel.querySelector('.client-mode-active-indicator');
  if (existingIndicator) existingIndicator.remove();
  if (pin && pin.length === 4) {
    const indicator = document.createElement('span');
    indicator.className = 'client-mode-active-indicator';
    indicator.textContent = ` (PIN: ${pin})`;
    clientSwitchLabel.appendChild(indicator);
  }
}

function subscribeToServerSession() {
  const pin = clientPinInput.value;
  if (pin.length !== 4) {
    alert('서버 PIN은 4자리 숫자로 입력해주세요.');
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
        columns: ['timer_value', 'stopwatch_value', 'exam_number', 'mode']
      },
      (payload) => {
        if (payload.new) {
          applySessionDataToClient(payload.new);
        }
      }
    )
    .subscribe();
}

// 클라이언트 화면에 서버 세션 데이터 반영
function applySessionDataToClient(data) {
  // 타이머/스탑워치/응시번호 UI에 값 반영
  if (data.mode === 'timer') {
    timerDuration = Math.ceil(data.timer_value / 60000);
    elapsedTime = 0;
    updateDisplay(data.timer_value);
    isStopwatchMode = false;
  } else {
    timerDuration = 0;
    elapsedTime = data.stopwatch_value;
    updateDisplay(data.stopwatch_value);
    isStopwatchMode = true;
  }
  examNumber = data.exam_number;
  updateExamNumber();
} 