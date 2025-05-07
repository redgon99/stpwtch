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
    serverSwitch.addEventListener('change', function () {
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

function updateExamNumber() {
  examNumberDisplay.textContent = String(examNumber).padStart(2, '0');
}

plusBtn.addEventListener('click', () => {
  if (examNumber < 99) examNumber++;
  updateExamNumber();
});
minusBtn.addEventListener('click', () => {
  if (examNumber > 0) examNumber--;
  updateExamNumber();
});

function updateDisplay(timeLeft) {
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const milliseconds = Math.floor((timeLeft % 1000) / 10);
  timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
}

function setTimer(minutes) {
  timerDuration = minutes;
  resetTimer();
  updateDisplay(timerDuration * 60 * 1000);
}

timeButtons.forEach(button => {
  button.addEventListener('click', () => {
    setTimer(parseInt(button.dataset.time));
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

startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

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
  if (!isServerModeActive) return;

  try {
    // Supabase에서 현재 PIN의 상태 업데이트 (실제 DB 연동은 Supabase 설정 완료 후)
    if (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && currentPin) {
      // 데이터베이스 연동 시 비활성화 처리
      // ... 예시: await supabaseClient.from('sessions').update({ status: 'inactive' }).eq('pin', currentPin);
      console.log('DB에서 PIN 비활성화:', currentPin);
    }

    isServerModeActive = false;
    updateServerLabel(false);
    console.log('서버 모드 비활성화됨');

    currentPin = null;

  } catch (err) {
    console.error('서버 모드 비활성화 오류:', err);
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

// 클라이언트 스위치 이벤트
clientSwitch.addEventListener('change', function () {
  if (this.checked) {
    // 클라이언트 스위치가 켜지면 서버 스위치는 비활성화
    serverSwitch.checked = false;
    serverSwitch.dispatchEvent(new Event('change')); // 서버 스위치 이벤트 트리거
    serverSwitch.disabled = true;
  } else {
    // 클라이언트 스위치가 꺼지면 서버 스위치 활성화
    serverSwitch.disabled = false;
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
    }
  });
} 