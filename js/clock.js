// ===== 크로노스 아르카나 : 거대 앤티크 픽셀 시계 컷씬 엔진 (Deus Ex Machina) =====
// 레퍼런스: ultimate_pure_clock.html 기반 캔버스 렌더러
// 평소에는 화면에 노출되지 않으며, [내 턴 시작], [상대 턴 시작], [수 무르기] 시
// 화면 중앙에 크고 웅장하게 출현하여 상황별 시간 왜곡/정지/역행 연출을 수행합니다.

const ChronosClock = (() => {
  let canvas = null;
  let ctx = null;
  let overlay = null;
  let animId = null;

  const W = 620;
  const H = 620;
  const CX = 310;
  const CY = 310;
  const RADIUS = 280;

  let secondAngle = 0;
  let minuteAngle = 0;
  let hourAngle = 0;
  let gearAngle = 0;
  let baseSpeed = 0.016;
  let burstSpeed = 0;
  let isRewinding = false;
  let isStopped = false;
  let currentTheme = 'gold'; // 'gold' | 'cyan' | 'purple'

  let freezeImpact = 0; // 0.0 ~ 1.0 정지 순간 폭발적인 발광 & 쇼크웨이브
  let freezeParticles = [];
  let shockwaveRadius = 0;

  const ROMAN = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];

  function ensureOverlay() {
    if (overlay && document.body.contains(overlay)) return;

    overlay = document.getElementById('chronos-cutscene-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'chronos-cutscene-overlay';
      overlay.className = 'chronos-cutscene-overlay';
      overlay.style.display = 'none';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="chronos-cutscene-modal">
        <div class="chronos-cutscene-badge" id="chronos-cutscene-badge">CHRONOS ARCANA</div>
        <div class="chronos-clock-frame">
          <canvas id="chronos-clock-canvas" width="${W}" height="${H}"></canvas>
        </div>
        <div class="chronos-cutscene-title" id="chronos-cutscene-title">시간 정지</div>
        <div class="chronos-cutscene-sub" id="chronos-cutscene-sub">인과율 지시 단계</div>
      </div>
    `;

    canvas = document.getElementById('chronos-clock-canvas');
    if (canvas) {
      ctx = canvas.getContext('2d');
    }
  }

  function getPalette() {
    if (currentTheme === 'brown' || currentTheme === 'cyan') {
      return {
        ring: 'rgba(180, 130, 60, 0.55)',
        ringInner: 'rgba(120, 80, 35, 0.45)',
        gem: '#ffd54f',
        gemGlow: '#d4af37',
        roman: '#e8cf9b',
        romanQuarter: '#fff1be',
        gear: '#8c6239',
        gearGlow: '#5c3d1e',
        handBody: '#ffe49e',
        handHour: '#d4af37',
        handShadow: '#382412',
        handGlow: 'rgba(212, 175, 55, 0.85)',
        handSec: '#e69526',
        handSecGlow: '#995c10',
        blurBg: burstSpeed > 0.05 ? 'rgba(20, 15, 10, 0.18)' : 'rgba(20, 15, 10, 0.36)'
      };
    } else if (currentTheme === 'purple') {
      return {
        ring: 'rgba(168, 85, 247, 0.5)',
        ringInner: 'rgba(124, 58, 237, 0.4)',
        gem: '#c084fc',
        gemGlow: '#d8b4fe',
        roman: '#f5f3ff',
        romanQuarter: '#ffffff',
        gear: '#a855f7',
        gearGlow: '#7c3aed',
        handBody: '#e9d5ff',
        handHour: '#c084fc',
        handShadow: '#581c87',
        handGlow: 'rgba(168, 85, 247, 0.95)',
        handSec: '#f472b6',
        handSecGlow: '#c084fc',
        blurBg: burstSpeed > 0.05 ? 'rgba(12, 5, 22, 0.18)' : 'rgba(12, 5, 22, 0.36)'
      };
    } else {
      return {
        ring: 'rgba(212, 175, 55, 0.4)',
        ringInner: 'rgba(168, 126, 32, 0.35)',
        gem: '#ffd54f',
        gemGlow: '#ffe27d',
        roman: '#d4af37',
        romanQuarter: '#fff199',
        gear: '#d4af37',
        gearGlow: '#ffca28',
        handBody: '#fff4b8',
        handHour: '#f5ce62',
        handShadow: '#8c5e0d',
        handGlow: 'rgba(255, 215, 64, 0.9)',
        handSec: '#ff4d4d',
        handSecGlow: '#ff7875',
        blurBg: burstSpeed > 0.05 ? 'rgba(4, 5, 7, 0.18)' : 'rgba(4, 5, 7, 0.36)'
      };
    }
  }

  function pxRect(x, y, w, h, fill, glow = null, blur = 0) {
    if (!ctx) return;
    ctx.save();
    if (glow && blur > 0) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = blur;
    }
    ctx.fillStyle = fill;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.max(1, w), Math.max(1, h));
    ctx.restore();
  }

  function spawnFreezeParticles() {
    freezeParticles = [];
    const count = 48;
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
      const spd = 3.5 + Math.random() * 6.5;
      freezeParticles.push({
        x: CX,
        y: CY,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1.0,
        decay: 0.018 + Math.random() * 0.02,
        size: Math.random() > 0.4 ? 4 : 3,
        color: Math.random() > 0.3 ? '#fff4b8' : '#ffd54f'
      });
    }
  }

  // 주변을 은은하게 맴도는 황금빛 시간 입자 이펙트
  function drawAmbientSparkles() {
    if (!ctx) return;
    const t = Date.now() * 0.0015;
    ctx.save();
    for (let i = 0; i < 20; i++) {
      const ang = (i * Math.PI / 10) + Math.sin(t + i) * 0.18;
      const dist = (RADIUS - 25) + Math.cos(t * 0.7 + i * 2) * 18;
      const sx = CX + Math.cos(ang) * dist;
      const sy = CY + Math.sin(ang) * dist;
      const alpha = 0.35 + Math.sin(t * 2.5 + i * 1.5) * 0.3;
      if (alpha > 0.05) {
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.shadowColor = '#ffd54f';
        ctx.shadowBlur = 8;
        ctx.fillStyle = (i % 2 === 0) ? '#fff8e1' : '#ffd54f';
        ctx.fillRect(Math.floor(sx), Math.floor(sy), 3, 3);
      }
    }
    ctx.restore();
  }

  // 1. 다이얼 및 눈금 (고퀄리티 보석 핀치 + 로마숫자)
  function drawDial(pal) {
    if (!ctx) return;
    ctx.save();

    // 품격 있는 다이얼 페이스 원형 배경 (어두운 마호가니/앤틱 우드 그라데이션)
    const dialGrad = ctx.createRadialGradient(CX, CY, 20, CX, CY, RADIUS);
    dialGrad.addColorStop(0, 'rgba(28, 20, 14, 0.96)');
    dialGrad.addColorStop(0.75, 'rgba(18, 12, 8, 0.98)');
    dialGrad.addColorStop(1, 'rgba(10, 6, 4, 1)');
    ctx.fillStyle = dialGrad;
    ctx.beginPath();
    ctx.arc(CX, CY, RADIUS - 4, 0, Math.PI * 2);
    ctx.fill();

    // 다이얼 내부 중앙 은은한 황금 마법 오라
    const auraRadius = 90 + Math.sin(Date.now() * 0.003) * 12;
    const centerAura = ctx.createRadialGradient(CX, CY, 5, CX, CY, auraRadius);
    centerAura.addColorStop(0, 'rgba(255, 215, 64, 0.22)');
    centerAura.addColorStop(0.6, 'rgba(217, 119, 6, 0.08)');
    centerAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = centerAura;
    ctx.beginPath();
    ctx.arc(CX, CY, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    // 다이얼 외곽 금빛 림 & 내곽 림 (입체감 있는 골드/브론즈 이중 라인)
    ctx.strokeStyle = pal.ring;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(CX, CY, RADIUS - 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(CX, CY, RADIUS - 44, 0, Math.PI * 2);
    ctx.strokeStyle = pal.ringInner;
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 0; i < 60; i++) {
      const ang = (i * Math.PI / 30) - Math.PI / 2;
      const isMajor = (i % 5 === 0);
      const isQuarter = (i % 15 === 0);

      if (isMajor) {
        const pDist = RADIUS - 22;
        const mx = CX + Math.cos(ang) * pDist;
        const my = CY + Math.sin(ang) * pDist;

        // 보석 눈금 소켓
        const glowBoost = freezeImpact > 0.1 ? 32 : 14;
        pxRect(mx - 5, my - 5, 10, 10, pal.gem, pal.gemGlow, glowBoost);
        pxRect(mx - 3, my - 3, 6, 6, '#fff9c4');
        pxRect(mx - 1, my - 1, 2, 2, '#ffffff');

        // 로마 숫자
        const numIdx = i / 5;
        const numDist = RADIUS - 70;
        const nx = CX + Math.cos(ang) * numDist;
        const ny = CY + Math.sin(ang) * numDist + 7;

        ctx.save();
        ctx.font = isQuarter ? 'bold 20px monospace' : '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = isQuarter ? pal.romanQuarter : pal.roman;
        ctx.shadowColor = pal.gemGlow;
        ctx.shadowBlur = (isQuarter ? 12 : 7) + (freezeImpact > 0.1 ? 20 : 0);
        ctx.fillText(ROMAN[numIdx], nx, ny);
        ctx.restore();
      } else {
        const sx = CX + Math.cos(ang) * (RADIUS - 20);
        const sy = CY + Math.sin(ang) * (RADIUS - 20);
        pxRect(sx - 2, sy - 2, 4, 4, pal.ring);
      }
    }
    ctx.restore();
  }

  // 2. 중앙 톱니바퀴 메커니즘
  function drawGears(pal) {
    if (!ctx) return;
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(gearAngle);
    ctx.strokeStyle = pal.gear;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(-46, -46, 92, 92);

    for (let g = 0; g < 8; g++) {
      const ga = g * (Math.PI / 4);
      pxRect(Math.cos(ga) * 54 - 4, Math.sin(ga) * 54 - 4, 8, 8, pal.gearGlow);
    }
    ctx.restore();

    // 중앙 보석 너트
    const nutGlow = freezeImpact > 0.1 ? 36 : 20;
    pxRect(CX - 9, CY - 9, 18, 18, pal.gem, pal.gemGlow, nutGlow);
    pxRect(CX - 5, CY - 5, 10, 10, '#fffbe6');
    pxRect(CX - 2, CY - 2, 4, 4, '#ffffff');
  }

  // 3. 초고퀄 앤티크 바늘 렌더러 (클로버 장식 + 입체 음영)
  function drawOrnateHand(angle, length, isHour, pal, customHand) {
    if (!ctx) return;
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(angle);

    let bodyColor = isHour ? pal.handHour : pal.handBody;
    let glowColor = pal.handGlow;
    const shadowColor = pal.handShadow;
    const highlight = '#ffffff';

    if (customHand && customHand.color) {
      bodyColor = customHand.color;
      glowColor = customHand.glow || customHand.color;
    }

    const baseBlur = isHour ? 14 : 18;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = baseBlur + (freezeImpact > 0.1 ? 28 : (customHand ? 12 : 0));

    // 후면 카운터웨이트 (무게추)
    pxRect(-4, 0, 8, 28, shadowColor);
    pxRect(-3, 0, 6, 28, bodyColor);
    pxRect(-8, 20, 16, 16, shadowColor);
    pxRect(-7, 21, 14, 14, bodyColor);
    pxRect(-3, 25, 6, 6, highlight);

    // 메인 바늘 기둥
    const w = isHour ? 7 : 5;
    pxRect(-w / 2 - 1, -length, w + 2, length, shadowColor);
    pxRect(-w / 2, -length, w, length, bodyColor);
    pxRect(-0.75, -length, 1.5, length, highlight);

    // 바로크풍 고딕 장식 고리
    const ornY = -length * (isHour ? 0.58 : 0.64);
    const ornSize = isHour ? 36 : 28;
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(-ornSize / 2, ornY - ornSize / 2, ornSize, ornSize);
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(-ornSize / 2, ornY - ornSize / 2, ornSize, ornSize);
    pxRect(-3, ornY - 3, 6, 6, highlight);

    // 뾰족한 창끝 팁 (Spear Tip)
    const tipLen = isHour ? 30 : 40;
    for (let t = 0; t < tipLen; t++) {
      const tw = Math.max(1, Math.floor((1 - t / tipLen) * (isHour ? 10 : 7)));
      pxRect(-tw / 2, -length - t, tw, 1, (t % 2 === 0) ? highlight : bodyColor);
    }

    ctx.restore();
  }

  // 4. 고속 초침 렌더러 (정밀 크로노미터 스타일 가느다란 바늘)
  function drawSecondHand(angle, length, pal, customHand) {
    if (!ctx) return;
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(angle);

    let handColor = pal.handSec || '#d4af37';
    let glowColor = pal.handSecGlow || '#8c5e23';

    if (customHand && customHand.color) {
      handColor = customHand.color;
      glowColor = customHand.glow || customHand.color;
    }

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = (isStopped ? 24 : 12) + (freezeImpact > 0.1 ? 30 : (customHand ? 12 : 0));

    // 후면 밸런스 꼬리
    pxRect(-2, 0, 4, 42, handColor);
    pxRect(-5, 28, 10, 10, handColor);
    pxRect(-2, 31, 4, 4, '#ffffff');

    // 초침 샤프트 (날렵함)
    pxRect(-1, -length, 2, length, handColor);
    pxRect(-0.5, -length, 1, length, '#ffffff');

    // 초침 팁 원형 피어싱 링
    pxRect(-5, -length * 0.72 - 5, 10, 10, handColor);
    pxRect(-2.5, -length * 0.72 - 2.5, 5, 5, '#ffffff');

    // 중앙 허브 핀
    pxRect(-4, -4, 8, 8, '#ffffff');

    ctx.restore();
  }

  // 5. 고대 천체 일침 (Day Hand) 렌더러 - 신발(Boots) 격
  function drawDayHand(angle, length, pal, customHand) {
    if (!ctx || !customHand) return;
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(angle);

    const handColor = customHand.color || '#fef08a';
    const glowColor = customHand.glow || 'rgba(254, 240, 138, 0.9)';

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18 + (freezeImpact > 0.1 ? 24 : 10);

    // 날렵하고 긴 바늘 기둥 (외곽 날짜 인덱스를 커버)
    pxRect(-1.5, -length, 3, length, handColor);
    pxRect(-0.5, -length, 1, length, '#ffffff');

    // 팁 부분의 초승달 / 날짜 인덱스 포인터
    const tipY = -length;
    pxRect(-7, tipY - 8, 14, 8, handColor);
    pxRect(-4, tipY - 14, 8, 6, handColor);
    pxRect(-2, tipY - 18, 4, 4, '#ffffff');

    // 중앙 허브 링
    pxRect(-5, -5, 10, 10, handColor);
    pxRect(-2, -2, 4, 4, '#ffffff');

    ctx.restore();
  }

  // 6. 4종 시계초침 풀세트 공명 아우라 (Full Set Resonance)
  function drawFullSetResonance(pal) {
    if (!ctx) return;
    ctx.save();
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(255, 215, 64, 0.85)';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(CX, CY, RADIUS - 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(103, 232, 249, 0.8)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(CX, CY, RADIUS - 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    if (!ctx) return;
    const pal = getPalette();

    // 캔버스 초기화 (이전 프레임 잔상 완전히 제거하여 깔끔하고 선명한 시계 유지)
    ctx.clearRect(0, 0, W, H);

    if (!isStopped) {
      const dir = isRewinding ? -1 : 1;
      const speed = (baseSpeed + burstSpeed) * dir;
      secondAngle += speed * 2.5;    // 선명하게 식별되면서도 속도감 있게 회전하는 초침
      minuteAngle += speed * 0.85;   // 자연스럽고 명확한 분침 이동
      hourAngle += speed * 0.16;     // 품격 있는 시침
      gearAngle -= speed * 0.5;      // 톱니바퀴 맞물림

      if (burstSpeed > 0.001) {
        burstSpeed *= 0.993;
      } else {
        burstSpeed = 0;
      }
    }

    const hands = (typeof P !== 'undefined' && P && P.clockHands) ? P.clockHands : null;

    drawDial(pal);
    drawAmbientSparkles();
    drawGears(pal);

    // 4가지 시계초침 장비 렌더링 (시침, 분침, 초침, 일침)
    if (hands && hands.day) {
      drawDayHand(hourAngle * 0.25, RADIUS * 0.94, pal, hands.day); // 일침 (신발)
    }
    drawOrnateHand(hourAngle, RADIUS * 0.52, true, pal, hands ? hands.hour : null);   // 시침 (투구)
    drawOrnateHand(minuteAngle, RADIUS * 0.82, false, pal, hands ? hands.minute : null); // 분침 (갑옷)
    drawSecondHand(secondAngle, RADIUS * 0.92, pal, hands ? hands.second : null);        // 초침 (바지)

    // 4개 풀세트 장착 시 공명 이펙트
    if (hands && hands.hour && hands.minute && hands.second && hands.day) {
      drawFullSetResonance(pal);
    }

    // 정지 순간 따뜻한 황금/호박빛 발광 & 파티클 렌더링
    if (freezeImpact > 0.01) {
      ctx.save();

      // 1. 다이얼 내부 따스한 호박/황금빛 플래시 오버레이
      ctx.fillStyle = `rgba(254, 243, 199, ${freezeImpact * 0.4})`;
      ctx.beginPath();
      ctx.arc(CX, CY, RADIUS - 4, 0, Math.PI * 2);
      ctx.fill();

      // 2. 방사형 파티클 렌더링 및 갱신
      for (let i = freezeParticles.length - 1; i >= 0; i--) {
        const p = freezeParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          freezeParticles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        pxRect(p.x, p.y, p.size, p.size, p.color);
        ctx.restore();
      }

      ctx.restore();
      freezeImpact *= 0.92;
    }

    animId = requestAnimationFrame(render);
  }

  function startLoop() {
    if (animId) cancelAnimationFrame(animId);
    render();
  }

  function stopLoop() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  return {
    init() {
      ensureOverlay();
    },

    // ===== 상황별 거대 시계 컷씬 연출 (Promise 반환) =====
    // 1) 'timestop' (내 턴 시작): 바늘이 맹렬하게 쌩쌩 회전하다가 "딱!" 정지 + 강력한 발광 임팩트
    // 2) 'flow' (상대 턴 시작): 멈춘 시간이 풀리며 황금빛으로 가속 회전
    // 3) 'rewind' (수 무르기): 맹렬하게 반시계 방향으로 역회전하며 과거로 회귀
    async playCutscene(type) {
      ensureOverlay();
      if (!overlay || !ctx) return;

      const badgeEl = document.getElementById('chronos-cutscene-badge');
      const titleEl = document.getElementById('chronos-cutscene-title');
      const subEl = document.getElementById('chronos-cutscene-sub');
      const frameEl = overlay.querySelector('.chronos-clock-frame');

      if (frameEl) {
        frameEl.classList.remove('clock-freeze-impact');
      }

      const speedMultiplier = (window.GameSpeed && window.GameSpeed > 0) ? window.GameSpeed : 1.0;
      const tScale = ms => Math.max(260, Math.round(ms / speedMultiplier));

      overlay.className = 'chronos-cutscene-overlay';

      if (type === 'timestop' || type === 'playerTurn') {
        currentTheme = 'gold';
        isStopped = false;
        isRewinding = false;
        baseSpeed = 0.016;
        burstSpeed = 0.11; // 시계바늘 형태가 또렷이 보이면서도 경쾌하고 속도감 있게 회전

        overlay.classList.add('chronos-theme-timestop');
        if (badgeEl) badgeEl.textContent = 'CHRONOS ARCANA · TIME STOP';
        if (titleEl) titleEl.textContent = '⏳ 시간 정지';
        if (subEl) subEl.textContent = '전장의 시간을 멈추고 아군 기물들의 행보를 지시하십시오.';

        overlay.style.display = 'flex';
        void overlay.offsetWidth;
        overlay.classList.add('active');
        startLoop();

        // 1단계: 시계바늘들이 차분히 도는 모습을 감상 (~1050ms)
        await new Promise(r => setTimeout(r, tScale(1050)));

        // 딱! 하고 완전히 멈춤 (Time Stop) + 고풍스러운 갈색/황금빛 정지 연출
        isStopped = true;
        burstSpeed = 0;
        currentTheme = 'brown';
        freezeImpact = 1.0;
        spawnFreezeParticles();

        if (frameEl) {
          frameEl.classList.remove('clock-freeze-impact');
          void frameEl.offsetWidth; // 강제 리플로우
          frameEl.classList.add('clock-freeze-impact');
        }

        // 사운드 & 화면 진동 & 섬광
        if (window.Sound) Sound.timeStop();
        if (window.FX) {
          FX.shake(10);
          FX.showTimeStopFlash();
        }

        // 2단계: 정지된 상태 감상 (~800ms)
        await new Promise(r => setTimeout(r, tScale(800)));

      } else if (type === 'flow' || type === 'playerAction' || type === 'enemyTurn') {
        currentTheme = 'gold';
        isStopped = false;
        isRewinding = false;
        baseSpeed = 0.016;
        burstSpeed = 0.14; // 황금빛 시간 흐름 (바늘이 뭉개지지 않고 시원하게 회전)

        overlay.classList.add('chronos-theme-flow');
        if (badgeEl) badgeEl.textContent = 'CHRONOS ARCANA · FLOW OF TIME';
        if (titleEl) titleEl.textContent = '⚡ 시간 재개';
        if (subEl) subEl.textContent = '멈춘 시간이 다시 흐르며 아군 기물들이 행동을 개시합니다!';

        overlay.style.display = 'flex';
        void overlay.offsetWidth;
        overlay.classList.add('active');
        startLoop();

        if (window.Sound) Sound.timeResume();
        if (window.FX) FX.showTimeResumeFlash();

        // 고속 회전 연출 시간 (~1300ms)
        await new Promise(r => setTimeout(r, tScale(1300)));

      } else if (type === 'rewind') {
        currentTheme = 'purple';
        isStopped = false;
        isRewinding = true;
        baseSpeed = 0.016;
        burstSpeed = 0.15; // 보랏빛 역회전 (바늘 디테일이 유지되는 박진감 있는 역회전)

        overlay.classList.add('chronos-theme-rewind');
        if (badgeEl) badgeEl.textContent = 'CHRONOS ARCANA · TIME REWIND';
        if (titleEl) titleEl.textContent = '⏪ 수 무르기';
        if (subEl) subEl.textContent = '인과율을 거꾸로 되감아 턴 시작 시점으로 회귀합니다.';

        overlay.style.display = 'flex';
        void overlay.offsetWidth;
        overlay.classList.add('active');
        startLoop();

        if (window.Sound) Sound.timeRewind();
        if (window.FX) FX.showRewindWarp();

        // 역회전 연출 시간 (~1400ms)
        await new Promise(r => setTimeout(r, tScale(1400)));
      }

      // 3단계: 부드럽게 페이드아웃 및 루프 종료
      overlay.classList.remove('active');
      await new Promise(r => setTimeout(r, tScale(240)));
      overlay.style.display = 'none';
      stopLoop();
    },

    isStopped() {
      return isStopped;
    }
  };
})();

if (typeof window !== 'undefined') {
  window.ChronosClock = ChronosClock;
}

// ===== 메인 타이틀 : 주렁주렁 매달린 순수 픽셀 도트 시계 엔진 (TitlePixelClocks) =====
const TitlePixelClocks = (() => {
  let animId = null;
  let instances = [];

  function drawPixelLine(ctx, x0, y0, x1, y1, color, width = 1) {
    ctx.fillStyle = color;
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    while (true) {
      if (width === 1) {
        ctx.fillRect(x0, y0, 1, 1);
      } else {
        ctx.fillRect(x0 - Math.floor(width / 2), y0 - Math.floor(width / 2), width, width);
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  function renderPixelClockFrame(ctx, c) {
    const W = 64, H = 64;
    const cx = 32, cy = 32;
    const r = 26;

    ctx.clearRect(0, 0, W, H);

    // 테마별 도트 색상 팔레트
    let pal = {
      crown: '#d4af37',
      rimLight: '#ffd54f',
      rimHighlight: '#fff9c4',
      rimDark: '#7a5a22',
      rimShadow: '#3e2d0f',
      dialBg: '#130e09',
      dialInner: '#1a130c',
      tick: '#fef08a',
      gear: '#c59b4c',
      hColor: '#f5ce62',
      mColor: '#fff4b8',
      sColor: '#ef4444'
    };

    if (c.theme === 'cyan' || c.theme === 'brown') {
      pal = {
        crown: '#8c6239',
        rimLight: '#b4823c',
        rimHighlight: '#ffd54f',
        rimDark: '#5c3d1e',
        rimShadow: '#2d1c0c',
        dialBg: '#150f0a',
        dialInner: '#1e160e',
        tick: '#ffd54f',
        gear: '#8c6239',
        hColor: '#d4af37',
        mColor: '#ffe082',
        sColor: '#e69526'
      };
    } else if (c.theme === 'purple') {
      pal = {
        crown: '#c084fc',
        rimLight: '#d8b4fe',
        rimHighlight: '#ffffff',
        rimDark: '#7c3aed',
        rimShadow: '#2e1065',
        dialBg: '#0e0417',
        dialInner: '#180727',
        tick: '#f5f3ff',
        gear: '#7c3aed',
        hColor: '#c084fc',
        mColor: '#f3e8ff',
        sColor: '#f43f5e'
      };
    }

    // 1. 상단 회중시계 고리 (Top Crown / Loop)
    ctx.fillStyle = pal.crown;
    ctx.fillRect(cx - 4, 1, 9, 2);
    ctx.fillRect(cx - 3, 0, 7, 2);
    ctx.fillRect(cx - 2, 3, 5, 2);
    ctx.fillStyle = pal.rimHighlight;
    ctx.fillRect(cx - 2, 1, 2, 1);

    // 2. 외곽 베젤 및 다이얼 배경 (Pixel Circles)
    ctx.fillStyle = pal.dialBg;
    for (let y = -r; y <= r; y++) {
      const halfW = Math.floor(Math.sqrt(r * r - y * y));
      ctx.fillRect(cx - halfW, cy + y, halfW * 2 + 1, 1);
    }

    ctx.fillStyle = pal.dialInner;
    for (let y = -(r - 3); y <= (r - 3); y++) {
      const halfW = Math.floor(Math.sqrt((r - 3) * (r - 3) - y * y));
      ctx.fillRect(cx - halfW, cy + y, halfW * 2 + 1, 1);
    }

    // 3. 베젤 음영 (3D Pixel Shading)
    for (let y = -r; y <= r; y++) {
      const halfW = Math.floor(Math.sqrt(r * r - y * y));
      const isTopLeft = y < 0;
      ctx.fillStyle = isTopLeft ? pal.rimLight : pal.rimDark;
      ctx.fillRect(cx - halfW, cy + y, 2, 1);
      ctx.fillRect(cx + halfW - 1, cy + y, 2, 1);
    }
    // 상단 하이라이트 & 하단 그림자
    ctx.fillStyle = pal.rimHighlight;
    ctx.fillRect(cx - 9, cy - r, 19, 1);
    ctx.fillStyle = pal.rimShadow;
    ctx.fillRect(cx - 9, cy + r, 19, 1);

    // 4. 12시간 도트 눈금 (Pixel Roman Ticks)
    ctx.fillStyle = pal.tick;
    // XII (12시)
    ctx.fillRect(cx - 1, cy - r + 4, 3, 3);
    ctx.fillRect(cx, cy - r + 3, 1, 5);
    // III (3시)
    ctx.fillRect(cx + r - 7, cy - 1, 4, 3);
    // VI (6시)
    ctx.fillRect(cx - 1, cy + r - 7, 3, 3);
    // IX (9시)
    ctx.fillRect(cx - r + 4, cy - 1, 4, 3);

    // 나머지 8개 시간 (2x2 도트 블록)
    const ticks = [
      [13, -22], [22, -13],
      [22, 13], [13, 22],
      [-13, 22], [-22, 13],
      [-22, -13], [-13, -22]
    ];
    for (const [tx, ty] of ticks) {
      ctx.fillRect(cx + tx - 1, cy + ty - 1, 2, 2);
    }

    // 5. 중앙 회전 도트 톱니바퀴 (Pixel Gear)
    const gr = 7;
    ctx.fillStyle = pal.gear;
    for (let y = -gr; y <= gr; y++) {
      const halfW = Math.floor(Math.sqrt(gr * gr - y * y));
      ctx.fillRect(cx - halfW, cy + y, halfW * 2 + 1, 1);
    }
    ctx.fillStyle = pal.dialBg;
    ctx.fillRect(cx - 2, cy - 2, 5, 5);

    // 8개 톱니 돌기
    ctx.fillStyle = pal.gear;
    for (let i = 0; i < 8; i++) {
      const a = c.gearAngle + (i * Math.PI / 4);
      const gx = Math.round(cx + Math.cos(a) * (gr + 2));
      const gy = Math.round(cy + Math.sin(a) * (gr + 2));
      ctx.fillRect(gx - 1, gy - 1, 2, 2);
    }

    // 6. 도트 시계바늘 (Pixel Hands)
    // 시침 (길이 12, 두께 2px)
    const hx = cx + Math.cos(c.hourAngle) * 12;
    const hy = cy + Math.sin(c.hourAngle) * 12;
    drawPixelLine(ctx, cx, cy, hx, hy, pal.hColor, 2);
    ctx.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3);

    // 분침 (길이 18, 두께 1px, 화살표 끝)
    const mx = cx + Math.cos(c.minuteAngle) * 18;
    const my = cy + Math.sin(c.minuteAngle) * 18;
    drawPixelLine(ctx, cx, cy, mx, my, pal.mColor, 1);
    ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 2, 2);

    // 초침 (길이 21, 빨강/형광 1px 바늘)
    const sx = cx + Math.cos(c.secondAngle) * 21;
    const sy = cy + Math.sin(c.secondAngle) * 21;
    const sxBack = cx - Math.cos(c.secondAngle) * 5;
    const syBack = cy - Math.sin(c.secondAngle) * 5;
    drawPixelLine(ctx, sxBack, syBack, sx, sy, pal.sColor, 1);

    // 중앙 도트 핀 (리벳 보석)
    ctx.fillStyle = pal.rimHighlight;
    ctx.fillRect(cx - 1, cy - 1, 3, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx, cy, 1, 1);
  }

  return {
    init(clocksData) {
      if (animId) cancelAnimationFrame(animId);
      instances = clocksData.map(c => {
        const el = document.getElementById(`pixel-clock-${c.id}`);
        return {
          ...c,
          canvas: el,
          ctx: el ? el.getContext('2d') : null,
          hourAngle: -Math.PI / 2,
          minuteAngle: -Math.PI / 2,
          secondAngle: -Math.PI / 2,
          gearAngle: 0
        };
      });

      function loop() {
        for (const c of instances) {
          if (!c.ctx) continue;
          const dir = c.dir < 0 ? -1 : 1;
          c.minuteAngle += (Math.PI * 2 / (c.minDur * 60)) * dir;
          c.hourAngle += (Math.PI * 2 / (c.hourDur * 60)) * dir;
          c.secondAngle += (Math.PI * 2 / (c.secDur * 60)) * dir;
          c.gearAngle -= 0.018 * dir;

          renderPixelClockFrame(c.ctx, c);
        }
        animId = requestAnimationFrame(loop);
      }

      loop();
    },

    stop() {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
      instances = [];
    }
  };
})();

if (typeof window !== 'undefined') {
  window.TitlePixelClocks = TitlePixelClocks;
}
