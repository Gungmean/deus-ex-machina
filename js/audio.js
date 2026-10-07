// ===== 판타지 레트로 사운드 신디사이저 (Web Audio API) =====
// 외부 오디오 파일 다운로드 없이 브라우저 내장 합성기로 즉시 100% 작동
const Sound = (() => {
  let ctx = null;
  let muted = false;

  function getCtx() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  function playTone(freq, type, duration, startVol = 0.3, endVol = 0.001, pitchDrop = 0) {
    if (muted) return;
    try {
      const c = getCtx();
      if (!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      const now = c.currentTime;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (pitchDrop) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq - pitchDrop), now + duration);
      }

      gain.gain.setValueAtTime(startVol, now);
      gain.gain.exponentialRampToValueAtTime(endVol, now + duration);

      osc.connect(gain);
      gain.connect(c.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  }

  function playNoise(duration, startVol = 0.2, filterFreq = 1200) {
    if (muted) return;
    try {
      const c = getCtx();
      if (!c) return;
      const bufferSize = c.sampleRate * duration;
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = c.createBufferSource();
      noise.buffer = buffer;

      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, c.currentTime);
      filter.frequency.exponentialRampToValueAtTime(100, c.currentTime + duration);

      const gain = c.createGain();
      gain.gain.setValueAtTime(startVol, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);

      noise.start();
    } catch (e) {}
  }

  return {
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },

    // 버튼 클릭
    click() {
      playTone(480, 'sine', 0.06, 0.15, 0.01, 100);
    },

    // 체스말 딱딱 놓는 소리 (묵직한 나무 타격감)
    chessMove(isKnight = false) {
      if (isKnight) {
        // 뛰어오르는 소리 + 착지
        playTone(320, 'triangle', 0.1, 0.18, 0.01, -120);
        setTimeout(() => {
          playNoise(0.08, 0.25, 450);
          playTone(140, 'sine', 0.09, 0.25, 0.01, 60);
        }, 140);
      } else {
        playNoise(0.06, 0.2, 500);
        playTone(160, 'sine', 0.08, 0.25, 0.01, 50);
      }
    },

    // 카드 호버 / 슥 펼치는 소리
    cardHover() {
      playTone(600 + Math.random() * 100, 'sine', 0.04, 0.06, 0.01, 200);
    },

    // 카드 뽑기 (카드 드로우 휘익)
    cardDraw() {
      playTone(280, 'triangle', 0.09, 0.12, 0.01, -250);
      setTimeout(() => playNoise(0.05, 0.08, 2000), 20);
    },

    // 카드 사용 (묵직한 마법 파동)
    cardPlay() {
      playTone(420, 'triangle', 0.2, 0.25, 0.01, -150);
      playNoise(0.18, 0.22, 1800);
    },

    // 카드가 시전자에게 날아가 바스러지는 소리 (파스스 산산조각)
    cardCrumble() {
      playTone(360, 'triangle', 0.15, 0.2, 0.01, -180);
      setTimeout(() => {
        playNoise(0.24, 0.32, 3200);
        playTone(920, 'sine', 0.16, 0.18, 0.01, 350);
        playTone(1350, 'triangle', 0.14, 0.15, 0.01, 400);
      }, 100);
    },

    // 물리 공격 (슬래시 칼베기)
    slash() {
      playNoise(0.12, 0.35, 2400);
      playTone(320, 'sawtooth', 0.14, 0.3, 0.01, 220);
    },

    // 화살 사격 (쉭!)
    arrow() {
      playNoise(0.08, 0.25, 3200);
      playTone(720, 'triangle', 0.1, 0.2, 0.01, 450);
    },

    // 대포/총기 폭발 (쾅!)
    cannon() {
      playTone(130, 'sine', 0.22, 0.45, 0.01, 90);
      playNoise(0.25, 0.45, 800);
    },

    // 마법 시전 & 폭발 (파아앗!)
    magic() {
      playTone(650, 'sine', 0.18, 0.25, 0.01, -250);
      setTimeout(() => {
        playTone(340, 'triangle', 0.15, 0.25, 0.01, 120);
        playNoise(0.14, 0.22, 2600);
      }, 50);
    },

    // 창 찌르기 / 관통 (챙!)
    thrust() {
      playNoise(0.09, 0.3, 3000);
      playTone(580, 'sawtooth', 0.12, 0.28, 0.01, 350);
    },

    // 주먹 강타 (퍽!)
    punch() {
      playTone(160, 'sine', 0.15, 0.4, 0.01, 90);
      playNoise(0.12, 0.35, 1200);
    },

    // 할퀴기 (사악!)
    claw() {
      playNoise(0.14, 0.35, 2800);
      playTone(280, 'sawtooth', 0.13, 0.25, 0.01, 160);
    },

    // 국왕 벼락 / 신성 강타 (콰광!)
    thunder() {
      playTone(440, 'triangle', 0.18, 0.35, 0.01, 300);
      setTimeout(() => {
        playTone(120, 'sawtooth', 0.25, 0.4, 0.01, 80);
        playNoise(0.28, 0.45, 1400);
      }, 40);
    },

    // 피격 (둔탁한 타격음)
    hit() {
      playNoise(0.15, 0.4, 600);
      playTone(110, 'sine', 0.18, 0.45, 0.01, 70);
    },

    // 방패 / 실드 튕기는 쇳소리
    shield() {
      playTone(880, 'sine', 0.15, 0.3, 0.01, 0);
      playTone(1320, 'sine', 0.12, 0.2, 0.01, 0);
    },

    // 치유 / 버프 (영롱한 하프 차임)
    heal() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        setTimeout(() => playTone(freq, 'sine', 0.25, 0.18, 0.01), i * 60);
      });
    },

    // 빙결 사운드 (얼어붙는 날카로운 소리)
    freeze() {
      playTone(980, 'triangle', 0.2, 0.25, 0.01, -300);
      playNoise(0.15, 0.2, 3500);
    },

    // 레벨업 / 전직 팡파르
    levelUp() {
      [440, 554.37, 659.25, 880].forEach((freq, i) => {
        setTimeout(() => playTone(freq, 'triangle', 0.3, 0.3, 0.01), i * 90);
      });
    },

    // 턴 전환 종소리
    turnStart(isPlayer) {
      if (isPlayer) {
        playTone(520, 'sine', 0.35, 0.25, 0.01, -40);
        setTimeout(() => playTone(780, 'sine', 0.4, 0.22, 0.01, -20), 80);
      } else {
        playTone(220, 'sawtooth', 0.3, 0.2, 0.01, 80);
      }
    },

    // 승리 팡파르
    victory() {
      [523, 659, 783, 1046, 1318].forEach((f, i) => {
        setTimeout(() => playTone(f, 'triangle', 0.4, 0.35, 0.01), i * 110);
      });
    },

    // 패배 우울한 저음
    defeat() {
      [220, 196, 174, 146].forEach((f, i) => {
        setTimeout(() => playTone(f, 'sawtooth', 0.45, 0.3, 0.01, 30), i * 160);
      });
    },

    // 슬롯머신 릴 회전음 (차르르르)
    slotSpin() {
      for (let i = 0; i < 4; i++) {
        setTimeout(() => playTone(320 + i * 35, 'triangle', 0.05, 0.14, 0.005), i * 45);
      }
    },

    // 슬롯머신 릴 멈춤 (짠! - 경쾌한 벨)
    slotStop(index = 0) {
      const baseFreq = 587.33 + index * 120;
      playTone(baseFreq, 'sine', 0.22, 0.3, 0.01);
      setTimeout(() => playTone(baseFreq * 1.5, 'triangle', 0.2, 0.25, 0.01), 35);
    },

    // 슬롯머신 3개 완성 (출진 팡파레 & 잭팟)
    slotJackpot() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        setTimeout(() => playTone(f, 'sine', 0.35, 0.3, 0.01), i * 65);
      });
      playNoise(0.2, 0.18, 4000);
    },

    // ===== 데우스 엑스 마키나 : 시간 제어 사운드 엔진 =====
    // 1) 시간 정지 (Time Stop) - 묵직한 시계 태엽 락킹 + 신비로운 공명
    timeStop() {
      playTone(180, 'sine', 0.45, 0.35, 0.001, 80);
      playTone(880, 'triangle', 0.12, 0.28, 0.01, -300);
      playNoise(0.08, 0.35, 1800);
      setTimeout(() => {
        playTone(330, 'sine', 0.5, 0.2, 0.001, 50);
      }, 70);
    },

    // 2) 시간 재개 / 가속 (Time Resume / Flow) - 태엽이 빠르게 풀리는 가속음
    timeResume() {
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          playTone(280 + i * 50, 'triangle', 0.04, 0.16, 0.005);
          playNoise(0.03, 0.12, 2200);
        }, i * 35);
      }
      setTimeout(() => {
        playTone(660, 'sine', 0.3, 0.25, 0.01, -120);
      }, 240);
    },

    // 3) 시간 역행 (Time Rewind / 무르기) - 테이프 되감기 및 인과율 왜곡 사운드
    timeRewind() {
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          const freq = 680 - i * 55;
          playTone(freq, 'sawtooth', 0.06, 0.22, 0.01, -140);
        }, i * 40);
      }
      playNoise(0.35, 0.25, 4500);
      setTimeout(() => {
        playTone(520, 'sine', 0.25, 0.25, 0.01, 200);
      }, 340);
    },

    // 4) 시계 틱 (Tick)
    timeTick() {
      playTone(1200, 'sine', 0.02, 0.1, 0.001, 400);
      playNoise(0.015, 0.08, 3000);
    }
  };
})();

// ===== 항시 재생 BGM 오디오 엔진 & 음소거 컨트롤러 =====
const BGM = (() => {
  let audio = null;
  let isMuted = false;
  let hasStarted = false;

  function init() {
    if (audio) return;
    audio = new Audio('bgm.m4a');
    audio.loop = true;
    audio.volume = 0.5;

    // 로컬 스토리지 음소거 설정 복원
    try {
      isMuted = localStorage.getItem('dem_bgm_muted') === 'true';
      audio.muted = isMuted;
    } catch (e) {
      isMuted = false;
    }

    updateUI();

    // 1) 즉시 자동 재생 시도
    attemptPlay();

    // 2) 브라우저 Autoplay 차단 대비: 첫 인터랙션 시 재생 잠금 해제
    const unlockAudio = () => {
      if (!hasStarted) {
        attemptPlay();
      }
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
  }

  function attemptPlay() {
    if (!audio) return;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          hasStarted = true;
          updateUI();
        })
        .catch(() => {
          // 브라우저 정책으로 첫 클릭 대기
        });
    }
  }

  function toggleMute() {
    if (!audio) init();
    isMuted = !isMuted;
    if (audio) audio.muted = isMuted;

    try {
      localStorage.setItem('dem_bgm_muted', isMuted);
    } catch (e) {}

    // 음소거를 해제했을 때 아직 재생 전이면 재생 시작
    if (!isMuted && audio && audio.paused) {
      attemptPlay();
    }

    updateUI();
    return isMuted;
  }

  function updateUI() {
    const btn = document.getElementById('bgm-mute-btn');
    if (!btn) return;
    if (isMuted) {
      btn.classList.add('muted');
      btn.innerHTML = '<span class="bgm-icon">🔇</span><span class="bgm-label">BGM OFF</span>';
      btn.title = '배경음악 켜기';
    } else {
      btn.classList.remove('muted');
      btn.innerHTML = '<span class="bgm-icon">🔊</span><span class="bgm-label">BGM ON</span>';
      btn.title = '배경음악 끄기 (음소거)';
    }
  }

  // DOM 준비 시 자동 초기화
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      setTimeout(init, 50);
    }
  }

  return {
    init,
    play: attemptPlay,
    toggleMute,
    isMuted: () => isMuted
  };
})();

if (typeof window !== 'undefined') {
  window.BGM = BGM;
}
