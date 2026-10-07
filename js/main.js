// ===== 게임 루프, 여로 지도, 상점 및 파티/전직 시스템 =====
let P = null;
const DEFAULT_PARTY = ['warrior', 'fire', 'archer', 'thief'];
let selectIds = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('dem_party_4'));
    if (Array.isArray(saved) && saved.length === 4) return saved;
  } catch (e) {}
  return DEFAULT_PARTY.slice();
})();
const app = () => document.getElementById('app');
const TYPE_ICON = { battle: '⚔️', elite: '💀', shop: '🛒', rest: '🏕️', boss: '😈' };
const TYPE_NAME = { battle: '일반 전투', elite: '엘리트 몬스터', shop: '방랑 상인', rest: '모닥불 휴식', boss: '심연의 마왕' };
const FLOORS = 8;

function pname(p) { return p.promoted ? CLASS_BY[p.cid].promo.name : CLASS_BY[p.cid].name; }

// ===== 메인 화면 (시작 화면) : 주렁주렁 매달린 시계 숲 & 흐르는 시계바늘 렌더러 =====
// ===== 메인 화면 (시작 화면) : 주렁주렁 매달린 순수 도트 픽셀 시계 숲 =====
const TITLE_CLOCKS_CONFIG = [
  // 좌측 날개 (체인 길이, 픽셀 크기, 테마, 회전속도 등)
  { id: 1, left: 3.0, chain: 150, size: 105, theme: 'gold', dir: 1, minDur: 14, hourDur: 56, secDur: 3.5, swayDur: 5.8, delay: -1.2, pendulum: true, pendDur: 2.4, layer: 'fg' },
  { id: 2, left: 9.0, chain: 280, size: 130, theme: 'gold', dir: 1, minDur: 10, hourDur: 42, secDur: 2.8, swayDur: 6.5, delay: -3.5, pendulum: true, pendDur: 2.8, layer: 'fg' },
  { id: 3, left: 16.0, chain: 110, size: 85, theme: 'brown', dir: -1, minDur: 18, hourDur: 72, secDur: 4.5, swayDur: 5.2, delay: -0.8, pendulum: false, layer: 'mid' },
  { id: 4, left: 23.0, chain: 230, size: 75, theme: 'gold', dir: 1, minDur: 12, hourDur: 48, secDur: 3.2, swayDur: 7.2, delay: -4.1, pendulum: false, layer: 'bg' },

  // 상단 천장 캐노피 (타이틀 상단 뒤편 원경)
  { id: 5, left: 32.0, chain: 80, size: 70, theme: 'brown', dir: 1, minDur: 22, hourDur: 88, secDur: 5.0, swayDur: 6.0, delay: -2.3, pendulum: false, layer: 'bg' },
  { id: 6, left: 50.0, chain: 50, size: 90, theme: 'gold', dir: 1, minDur: 16, hourDur: 64, secDur: 4.0, swayDur: 6.8, delay: -1.9, pendulum: false, layer: 'bg' },
  { id: 7, left: 68.0, chain: 85, size: 70, theme: 'purple', dir: -1, minDur: 20, hourDur: 80, secDur: 4.8, swayDur: 5.5, delay: -3.0, pendulum: false, layer: 'bg' },

  // 우측 날개
  { id: 8, left: 77.0, chain: 210, size: 80, theme: 'gold', dir: 1, minDur: 13, hourDur: 52, secDur: 3.6, swayDur: 6.9, delay: -2.7, pendulum: false, layer: 'bg' },
  { id: 9, left: 84.0, chain: 115, size: 95, theme: 'brown', dir: 1, minDur: 15, hourDur: 60, secDur: 3.8, swayDur: 5.4, delay: -1.5, pendulum: false, layer: 'mid' },
  { id: 10, left: 91.0, chain: 290, size: 135, theme: 'gold', dir: 1, minDur: 9, hourDur: 36, secDur: 2.5, swayDur: 6.2, delay: -4.4, pendulum: true, pendDur: 2.6, layer: 'fg' },
  { id: 11, left: 97.0, chain: 140, size: 100, theme: 'purple', dir: -1, minDur: 16, hourDur: 64, secDur: 4.2, swayDur: 5.7, delay: -0.5, pendulum: true, pendDur: 2.3, layer: 'fg' },
];

function renderHangingClocksHtml() {
  return `
    <div class="hanging-clocks-container">
      ${TITLE_CLOCKS_CONFIG.map(c => renderSingleHangingClock(c)).join('')}
    </div>
  `;
}

function renderSingleHangingClock(c) {
  let rimColor = '#d4af37', rimInner = '#7a5a22', numColor = '#fef08a';
  if (c.theme === 'cyan' || c.theme === 'brown') {
    rimColor = '#8c6239'; rimInner = '#5c3d1e'; numColor = '#ffd54f';
  } else if (c.theme === 'purple') {
    rimColor = '#c084fc'; rimInner = '#7c3aed'; numColor = '#f5f3ff';
  }

  const pendulumHtml = c.pendulum ? `
    <div class="pixel-pendulum" style="--pend-dur: ${c.pendDur}s; --pend-delay: ${c.delay}s;">
      <div class="pixel-pendulum-rod" style="background:${rimInner};"></div>
      <div class="pixel-pendulum-bob">
        <svg class="pixel-bob-svg" width="16" height="16" viewBox="0 0 16 16">
          <rect x="6" y="1" width="4" height="2" fill="${rimColor}"/>
          <rect x="4" y="3" width="8" height="2" fill="${rimColor}"/>
          <rect x="2" y="5" width="12" height="2" fill="${rimColor}"/>
          <rect x="1" y="7" width="14" height="2" fill="${rimColor}"/>
          <rect x="2" y="9" width="12" height="2" fill="${rimColor}"/>
          <rect x="4" y="11" width="8" height="2" fill="${rimColor}"/>
          <rect x="6" y="13" width="4" height="2" fill="${rimColor}"/>
          <rect x="6" y="5" width="4" height="4" fill="${numColor}"/>
          <rect x="7" y="6" width="2" height="2" fill="#ffffff"/>
        </svg>
      </div>
    </div>
  ` : '';

  return `
    <div class="hanging-clock layer-${c.layer}" 
         style="left: ${c.left}%; --sway-dur: ${c.swayDur}s; --sway-delay: ${c.delay}s; z-index: ${c.layer === 'fg' ? 4 : (c.layer === 'mid' ? 2 : 1)};">
      <div class="pixel-chain" style="height: ${c.chain}px;"></div>
      <div class="pocket-watch-wrap" 
           style="width: ${c.size}px; height: ${c.size}px;" 
           onclick="if(window.Sound) Sound.timeTick();" 
           title="크로노스의 도트 시계 (클릭 시 째깍임)">
        <canvas id="pixel-clock-${c.id}" width="64" height="64" class="pixel-clock-canvas"></canvas>
        ${pendulumHtml}
      </div>
    </div>
  `;
}

function showTitle() {
  app().innerHTML = `
    <div class="title-screen">
      ${renderHangingClocksHtml()}
      <div class="title-particles">
        ${Array.from({length: 18}, (_, i) => `<div class="time-mote tm-${i%6}" style="left:${(i * 5.5 + Math.random()*2).toFixed(1)}%; animation-delay:${(i*0.42).toFixed(2)}s; animation-duration:${(7 + (i%4)*2.2)}s;"></div>`).join('')}
      </div>
      <div class="title-content">
        <div class="title-logo-wrap">
          <img src="images/Logo.png" alt="데우스 엑스 마키나" class="title-logo-img">
        </div>
        <div class="sub-title">DEUS EX MACHINA — 시간을 관장하는 신</div>
        <div class="title-actions">
          <button class="title-start-btn" onclick="Sound.click(); startGameFromTitle()" title="운명의 여로를 시작합니다">
            <span class="btn-pixel-corner tl"></span>
            <span class="btn-pixel-corner tr"></span>
            <span class="btn-pixel-corner bl"></span>
            <span class="btn-pixel-corner br"></span>
            <span class="btn-rune-left">◆</span>
            <span class="btn-text">게임 시작</span>
            <span class="btn-rune-right">◆</span>
          </button>
          <button class="title-sub-btn" onclick="Sound.click(); showSelect()" title="출진할 원정대 기물 4명을 편성합니다">
            <span class="btn-pixel-corner tl"></span>
            <span class="btn-pixel-corner tr"></span>
            <span class="btn-pixel-corner bl"></span>
            <span class="btn-pixel-corner br"></span>
            <span class="btn-sub-icon">♟</span>
            <span class="btn-text">원정대 편성</span>
          </button>
        </div>
      </div>
    </div>`;

  if (window.TitlePixelClocks) {
    TitlePixelClocks.init(TITLE_CLOCKS_CONFIG);
  }
}

function startGameFromTitle() {
  if (window.TitlePixelClocks) {
    TitlePixelClocks.stop();
  }
  if (!selectIds || selectIds.length !== 4) {
    selectIds = DEFAULT_PARTY.slice();
  }
  newRun();
}

const CLASS_METAS = {
  warrior: {
    category: '전사 계열',
    role: '근접 수호 / 돌격 딜러',
    title: '아군을 지키는 든든한 방패',
    desc: '최전선에서 적의 맹공을 온몸으로 받아내며 동료들을 지키는 든든한 수호자입니다. 전직 시 체스의 [룩]으로 각성하여 직선상의 적들을 일격에 꿰뚫으며 돌격합니다.',
    enName: 'HERO (WARRIOR)',
    badge: 'TANKER'
  },
  fire: {
    category: '마법사 계열',
    role: '화염 폭발 / 맹독 지속 피해',
    title: '화염과 맹독을 다루는 원소술사',
    desc: '적들에게 맹독을 중첩시키고 거대한 화염 폭발과 메테오를 낙하시킵니다. 전직 시 체스의 [퀸]에 필적하는 8방향 전역 기동력을 손에 넣습니다.',
    enName: 'ARCH MAGE (F/P)',
    badge: 'DOT MAGE'
  },
  ice: {
    category: '마법사 계열',
    role: '빙결 제어 / 뇌전 연쇄 감전',
    title: '빙결로 적의 발을 묶는 냉기 현자',
    desc: '차가운 냉기로 적들을 동결시켜 행동을 봉쇄하고 치명적인 연쇄 감전을 일으킵니다. 전직 시 공격이 주변 적들에게 연쇄 전이되어 다수를 섬멸합니다.',
    enName: 'ARCH MAGE (I/L)',
    badge: 'CC MAGE'
  },
  cleric: {
    category: '성직자 계열',
    role: '광역 치유 / 아군 강화 서포터',
    title: '성스러운 빛으로 치유하는 성직자',
    desc: '아군에게 축복과 힐을 선사하며 전열의 생명력을 책임지는 고결한 성직자입니다. 전직 시 체스의 [비숍]으로 각성하여 대각선 전장을 종횡무진 누빕니다.',
    enName: 'BISHOP (CLERIC)',
    badge: 'HEALER'
  },
  archer: {
    category: '궁수 계열',
    role: '초장거리 저격 / 원거리 화망',
    title: '백발백중의 명사수',
    desc: '먼 거리에서 치명타 화살을 쏘아보내며 거리가 멀수록 강력한 저격을 가합니다. 전직 시 시야 내 전역(사거리 6칸)을 커버하는 폭풍의 시를 발사합니다.',
    enName: 'BOW MASTER (HUNTER)',
    badge: 'SNIPER'
  },
  thief: {
    category: '도적 계열',
    role: '장애물 도약 / 기습 암살자',
    title: '그림자를 가르는 쾌속의 암살자',
    desc: '체스의 나이트처럼 적과 장애물을 뛰어넘어 급소를 찌르는 암살자입니다. 전직 시 [로열 나이트]로 진화하여 나이트 점프와 대각 기동을 자유자재로 구사합니다.',
    enName: 'NIGHT LORD (ASSASSIN)',
    badge: 'ASSASSIN'
  },
  gunner: {
    category: '해적 계열',
    role: '속사 사격 / 코스트 환급 기동',
    title: '쌍권총을 난사하는 기동 포수',
    desc: '재빠른 사격으로 적을 견제하며 공격 시마다 코스트를 환급받아 지속 기동합니다. 전직 시 8방향 2칸 이동과 직선 4칸 관통 사격을 겸비한 전함 캡틴이 됩니다.',
    enName: 'CAPTAIN (GUNSLINGER)',
    badge: 'GUNNER'
  },
  spear: {
    category: '전사 계열',
    role: '직선 관통 / 아군 방진 전개',
    title: '용의 힘을 품은 중장창병',
    desc: '긴 장창으로 일렬의 적들을 꿰뚫고 인접한 아군에게 철벽 방진을 둘러줍니다. 전직 시 [드래곤나이트]로 각성하여 4칸 무한 관통 창격을 시전합니다.',
    enName: 'DRAGON KNIGHT (SPEAR)',
    badge: 'LANCER'
  },
  brawler: {
    category: '해적 계열',
    role: '돌진 타격 / 기력 축적 격투가',
    title: '싸울수록 강해지는 권격의 달인',
    desc: '적에게 거침없이 돌진하며 타격할 때마다 기력을 충전해 폭발적인 데미지를 누적합니다. 전직 시 [바이퍼]로 각성하여 적을 날려버리는 파동권을 난사합니다.',
    enName: 'VIPER (BRAWLER)',
    badge: 'FIGHTER'
  },
  cannon: {
    category: '해적 계열',
    role: '초장거리 곡사 / 원숭이 보급',
    title: '전장을 뒤흔드는 거포 사수',
    desc: '아군 너머로 포탄을 날리는 곡사 포격을 가하며 매 턴 아군을 치유하는 바나나를 보급합니다. 전직 시 사거리 7칸의 무제한 융단폭격을 퍼붓습니다.',
    enName: 'CANNON MASTER',
    badge: 'CANNON'
  }
};

let previewCid = 'warrior';

function showSelect() {
  if (window.TitlePixelClocks) {
    TitlePixelClocks.stop();
  }
  if (!selectIds || selectIds.length !== 4) {
    selectIds = DEFAULT_PARTY.slice();
  }
  if (!previewCid || !CLASS_BY[previewCid]) {
    previewCid = selectIds[0] || CLASSES[0].id;
  }

  const draw = () => {
    const cur = CLASS_BY[previewCid] || CLASSES[0];
    const meta = CLASS_METAS[cur.id] || { category: '모험가', role: '전투', title: cur.desc, desc: cur.desc, enName: cur.name, badge: 'HERO' };
    const isEnrolled = selectIds.includes(cur.id);
    const isPartyFull = selectIds.length >= 4;
    const slotIdx = selectIds.indexOf(cur.id);

    app().innerHTML = `
      <div class="maple-select-screen">
        <!-- 상단 헤더 바 -->
        <div class="maple-select-header">
          <div class="header-left">
            <span class="remaster-badge">EXPEDITION</span>
            <span class="header-title">원정대 편성</span>
            <span class="header-sub">CHESS FORMATION</span>
          </div>
          <div class="header-right">
            <div class="header-guide-pill">
              <span class="guide-dot">●</span>
              총 <b>10종</b>의 직업 중 원하는 <b>4명</b>을 선택하여 원정대를 편성할 수 있습니다.
            </div>
          </div>
        </div>

        <!-- 메인 바디 영역 (좌측/중앙 쇼케이스 + 우측 클래스 그리드) -->
        <div class="maple-select-body">
          
          <!-- 좌측/중앙 프리뷰 쇼케이스 -->
          <div class="maple-preview-container">
            
            <!-- 상세 정보 컬럼 (좌측) -->
            <div class="maple-hero-info">
              <div class="hero-category-tag">
                <span class="tag-check">✓</span>
                <span class="tag-text">${meta.category}</span>
                <span class="tag-role">· ${meta.role}</span>
              </div>
              <h1 class="hero-name">${cur.name}</h1>
              <div class="hero-en-name">${meta.enName}</div>
              <div class="hero-title">${meta.title}</div>
              <p class="hero-lore">${meta.desc}</p>

              <!-- 메이플 스타일 스펙 명세표 -->
              <div class="hero-specs-card">
                <div class="spec-row">
                  <span class="spec-lbl">기본 능력치</span>
                  <span class="spec-val">
                    <span class="stat-badge hp">❤️ HP ${cur.hp}</span>
                    <span class="stat-badge atk">⚔️ ATK ${cur.atk}</span>
                  </span>
                </div>
                <div class="spec-row">
                  <span class="spec-lbl">체스 이동</span>
                  <span class="spec-val">${descPat(cur.move)}</span>
                </div>
                <div class="spec-row">
                  <span class="spec-lbl">기본 공격</span>
                  <span class="spec-val">${descPat(cur.atkp)}</span>
                </div>
                <div class="spec-row passive-row">
                  <span class="spec-lbl">고유 패시브</span>
                  <div class="spec-val-col">
                    <span class="passive-title">${cur.passive.icon} [${cur.passive.name}]</span>
                    <span class="passive-desc">${cur.passive.desc}</span>
                  </div>
                </div>
                <div class="spec-row promo-row">
                  <span class="spec-lbl">3차 전직</span>
                  <div class="spec-val-col">
                    <span class="promo-title">♟️ [${cur.promo.name}] <small class="promo-bonus">(HP +${cur.promo.hp}, ATK +${cur.promo.atk})</small></span>
                    <span class="promo-desc">${cur.promo.chessDesc}</span>
                  </div>
                </div>
                <div class="spec-row cards-row">
                  <span class="spec-lbl">보유 카드</span>
                  <div class="spec-cards-list">
                    <span class="card-pill">기본: ${CARDS[cur.cards[0]].name}</span>
                    <span class="card-pill">기본: ${CARDS[cur.cards[1]].name}</span>
                    <span class="card-pill">스킬: ${CARDS[cur.cards[2]].name}</span>
                    <span class="card-pill ult">★궁극기: ${CARDS[cur.ultCard].name}</span>
                  </div>
                </div>
              </div>

              <!-- 원정대 편성/제외 액션 버튼 -->
              <div class="hero-enlist-box">
                ${isEnrolled ? `
                  <button class="maple-enlist-btn remove" onclick="toggleCls('${cur.id}')" title="원정대에서 제외합니다">
                    <span class="enlist-icon">✕</span>
                    <span class="enlist-text">원정대에서 제외 (현재 Slot ${slotIdx + 1})</span>
                  </button>
                ` : (isPartyFull ? `
                  <button class="maple-enlist-btn full" disabled title="원정대 정원(4명)이 모두 찼습니다. 하단 슬롯에서 제외할 기물을 먼저 선택하세요.">
                    <span class="enlist-icon">⚠️</span>
                    <span class="enlist-text">원정대 정원 완료 (4/4 만원)</span>
                  </button>
                ` : `
                  <button class="maple-enlist-btn add" onclick="toggleCls('${cur.id}')" title="원정대에 4인 파티원으로 등록합니다">
                    <span class="enlist-icon">＋</span>
                    <span class="enlist-text">원정대에 편성하기 (${selectIds.length}/4)</span>
                  </button>
                `)}
              </div>
            </div>

            <!-- 중앙 대형 일러스트레이션 (2등신 SD 전면 + 8등신 원화 반투명 백드롭) -->
            <div class="maple-hero-illust-wrap">
              <div class="maple-hero-pedestal"></div>
              <div class="maple-hero-aura" style="--hero-theme: ${cur.theme}"></div>

              <!-- [8등신 원화 캐릭터 반투명 백드롭 레이어] -->
              <div class="maple-hero-backdrop-wrap">
                <img src="images/units_full/${cur.id}.png" 
                     alt="${cur.name} 원화 일러스트" 
                     class="maple-hero-backdrop-img"
                     onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"
                     onload="this.style.display='block'; if(this.nextElementSibling) this.nextElementSibling.style.display='none';">
                <div class="maple-hero-backdrop-placeholder">
                  <div class="backdrop-ph-frame">
                    <span class="backdrop-ph-icon">${cur.icon}</span>
                    <span class="backdrop-ph-title">8등신 원화 일러스트</span>
                    <span class="backdrop-ph-path">images/units_full/${cur.id}.png</span>
                  </div>
                </div>
              </div>

              <!-- 2등신 SD 도트 캐릭터 (전면 바닥 접지) -->
              <img src="images/units_stand/${cur.id}.png" onerror="this.src='images/units/${cur.id}.png'" alt="${cur.name}" class="maple-hero-art">
              <div class="maple-hero-ground-shadow"></div>
            </div>

          </div>

          <!-- 우측 CLASS SELECT 사이드 패널 -->
          <div class="maple-class-panel">
            <div class="class-panel-header">
              <span class="panel-title">CLASS SELECT</span>
              <span class="panel-badge">10 Classes</span>
            </div>
            <div class="maple-class-grid">
              ${CLASSES.map(c => {
                const picked = selectIds.includes(c.id);
                const isActive = c.id === cur.id;
                const pSlot = selectIds.indexOf(c.id);
                const cm = CLASS_METAS[c.id] || { category: '직업', role: '' };
                return `
                  <div class="maple-class-chip ${isActive ? 'active' : ''} ${picked ? 'picked' : ''}" 
                       onclick="setPreview('${c.id}')" 
                       title="${c.name} (${cm.role})">
                    <div class="chip-info">
                      <div class="chip-name">${c.name}</div>
                      <div class="chip-tag-line">
                        ${picked ? `<span class="chip-slot-badge">Slot ${pSlot + 1}</span>` : `<span class="chip-role-badge">${cm.category}</span>`}
                      </div>
                    </div>
                    <div class="chip-portrait-wrap">
                      <img src="images/units/${c.id}.png" alt="${c.name}" class="chip-portrait-img">
                      ${picked ? `<span class="chip-check-mark">✓</span>` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

        </div>

        <!-- 하단 편성 바 (4인 슬롯 트레이 & 네비게이션) -->
        <div class="maple-bottom-bar">
          <!-- 좌측: 타이틀로 돌아가기 -->
          <div class="bottom-left">
            <button class="title-sub-btn maple-nav-btn" onclick="Sound.click(); showTitle()" title="메인 타이틀 화면으로 돌아갑니다">
              <span class="btn-pixel-corner tl"></span>
              <span class="btn-pixel-corner tr"></span>
              <span class="btn-pixel-corner bl"></span>
              <span class="btn-pixel-corner br"></span>
              <span class="btn-sub-icon">‹</span>
              <span class="btn-text">처음으로</span>
            </button>
          </div>

          <!-- 중앙: 4인 원정대 슬롯 트레이 -->
          <div class="maple-party-tray">
            <div class="tray-label-wrap">
              <span class="tray-title">출진 원정대</span>
              <span class="tray-counter ${selectIds.length === 4 ? 'full' : ''}">(${selectIds.length} / 4)</span>
            </div>
            <div class="tray-slots">
              ${[0, 1, 2, 3].map(slotIdx => {
                const sid = selectIds[slotIdx];
                if (sid && CLASS_BY[sid]) {
                  const sc = CLASS_BY[sid];
                  const isCurrentPreview = sc.id === cur.id;
                  return `
                    <div class="maple-slot filled ${isCurrentPreview ? 'focused' : ''}" 
                         onclick="setPreview('${sc.id}')" 
                         title="${sc.name} (클릭 시 프리뷰 확인)">
                      <div class="slot-idx">SLOT ${slotIdx + 1}</div>
                      <div class="slot-body">
                        <img src="images/units/${sc.id}.png" alt="${sc.name}" class="slot-img">
                        <span class="slot-name">${sc.name}</span>
                      </div>
                      <button class="slot-remove-btn" onclick="event.stopPropagation(); removeSlot('${sc.id}')" title="원정대에서 제외">✕</button>
                    </div>
                  `;
                } else {
                  return `
                    <div class="maple-slot empty" title="빈 슬롯: 우측 목록이나 프리뷰에서 직업을 선택해 편성하세요">
                      <div class="slot-idx">SLOT ${slotIdx + 1}</div>
                      <div class="slot-empty-content">
                        <span class="slot-plus">＋</span>
                        <span class="slot-empty-txt">빈 슬롯</span>
                      </div>
                    </div>
                  `;
                }
              }).join('')}
            </div>
          </div>

          <!-- 우측: 원정대 출진 액션 버튼 -->
          <div class="bottom-right">
            ${selectIds.length === 4 ? `
              <button class="title-start-btn maple-start-btn" onclick="Sound.click(); newRun()" title="4명의 원정대와 함께 여로를 시작합니다">
                <span class="btn-pixel-corner tl"></span>
                <span class="btn-pixel-corner tr"></span>
                <span class="btn-pixel-corner bl"></span>
                <span class="btn-pixel-corner br"></span>
                <span class="btn-rune-left">◆</span>
                <span class="btn-text">원정대 출진</span>
                <span class="btn-rune-right">◆</span>
              </button>
            ` : `
              <button class="title-start-btn maple-start-btn disabled" disabled title="4명을 모두 편성해야 여로를 출발할 수 있습니다">
                <span class="btn-text">4명 편성 필요 (${selectIds.length}/4)</span>
              </button>
            `}
          </div>
        </div>

      </div>
    `;
  };

  window.setPreview = (id) => {
    if (previewCid !== id) {
      Sound.click();
      previewCid = id;
      draw();
    }
  };

  window.toggleCls = (id) => {
    Sound.click();
    const i = selectIds.indexOf(id);
    if (i >= 0) {
      selectIds.splice(i, 1);
    } else if (selectIds.length < 4) {
      selectIds.push(id);
    }
    try { localStorage.setItem('dem_party_4', JSON.stringify(selectIds)); } catch(e){}
    draw();
  };

  window.removeSlot = (id) => {
    Sound.click();
    selectIds = selectIds.filter(x => x !== id);
    try { localStorage.setItem('dem_party_4', JSON.stringify(selectIds)); } catch(e){}
    draw();
  };

  draw();
}

function newRun() {
  const mk = id => {
    const c = CLASS_BY[id];
    return { side: 'p', cid: id, level: 1, xp: 0, hp: c.hp, maxHp: c.hp, atk: c.atk, promoted: false };
  };
  P = {
    gold: 60,
    party: selectIds.map(mk),
    king: { side: 'p', king: true, hp: 14, maxHp: 14, atk: 1 },
    deck: [],
    pos: null,
    nodes: []
  };
  P.party.forEach(p => P.deck.push(CLASS_BY[p.cid].cards[0], CLASS_BY[p.cid].cards[1]));
  genMap();
  showMap();
}

// ----- 슬더스 스타일 분기 지도 생성 -----
function genMap() {
  const floors = [];
  for (let f = 0; f < FLOORS; f++) {
    const cols = shuffle([0, 1, 2, 3, 4]).slice(0, f === 0 ? 3 : 3 + rnd(2)).sort();
    floors.push(cols.map(c => {
      let type = 'battle';
      const r = Math.random() * 100;
      if (f === FLOORS - 1) type = 'rest';
      else if (f > 0) type = r < 45 ? 'battle' : r < 60 && f >= 3 ? 'elite' : r < 75 && f >= 2 ? 'shop' : r < 90 && f >= 2 ? 'rest' : 'battle';
      return { f, c, type, next: [], visited: false };
    }));
  }
  floors.push([{ f: FLOORS, c: 2, type: 'boss', next: [], visited: false }]);

  for (let f = 0; f < FLOORS; f++) {
    const cur = floors[f], nx = floors[f + 1];
    for (const n of cur) {
      const near = nx.filter(m => Math.abs(m.c - n.c) <= 1);
      if (f === FLOORS - 1) n.next = nx.slice();
      else n.next = near.length ? near : [nx.reduce((a, b) => Math.abs(b.c - n.c) < Math.abs(a.c - n.c) ? b : a)];
    }
    for (const m of nx) {
      if (!cur.some(n => n.next.includes(m))) {
        const n = cur.reduce((a, b) => Math.abs(b.c - m.c) < Math.abs(a.c - m.c) ? b : a);
        n.next.push(m);
      }
    }
  }
  P.map = floors;
  P.nodes = floors.flat();
}

function hud() {
  return `
    <div class="hud">
      <div class="hud-left">
        <span class="hud-item gold-val">💰 ${P.gold} G</span>
        <span class="hud-item hp-val">👑 킹 HP ${P.king.hp}/${P.king.maxHp}</span>
        <span class="hud-item deck-val">🃏 덱 ${P.deck.length}장</span>
      </div>
      <div class="hud-right">
        <button class="btn sm nav-btn" onclick="Sound.click(); showParty()">원정대 / 전직</button>
        <button class="btn sm nav-btn" onclick="Sound.click(); showDeck()">덱 확인</button>
      </div>
    </div>`;
}

function showMap() {
  const avail = P.pos ? P.pos.next : P.map[0];
  const X = c => 60 + c * 115, Y = f => 45 + (FLOORS - f) * 85;
  let lines = '', nodes = '';

  for (const n of P.nodes) {
    for (const m of n.next) {
      const isActivePath = n === P.pos && avail.includes(m);
      lines += `<line x1="${X(n.c)}" y1="${Y(n.f)}" x2="${X(m.c)}" y2="${Y(m.f)}" class="map-line ${isActivePath ? 'active-path' : ''}"/>`;
    }
    const id = P.nodes.indexOf(n), isAvail = avail.includes(n);
    nodes += `
      <div class="map-node node-${n.type} ${isAvail ? 'available' : ''} ${n.visited ? 'visited' : ''}" 
           style="left:${X(n.c) - 24}px;top:${Y(n.f) - 24}px" 
           ${isAvail ? `onclick="pickNode(${id})"` : ''} 
           title="${TYPE_NAME[n.type]}">
        <span class="node-icon">${TYPE_ICON[n.type]}</span>
        <span class="node-label">${TYPE_NAME[n.type]}</span>
      </div>`;
  }

  app().innerHTML = `
    ${hud()}
    <div class="map-screen">
      <div class="map-header">
        <h2>빅토리아 아일랜드 : 여로의 분기점</h2>
        <p class="dim-desc">원하는 목적지를 선택하여 진군하십시오. 다음 길목이 열립니다.</p>
      </div>
      <div class="parchment-scroll" id="mapwrap">
        <div class="map-canvas">
          <svg class="map-svg" width="580" height="${Y(0) + 60}">${lines}</svg>
          ${nodes}
        </div>
      </div>
    </div>`;

  const w = document.getElementById('mapwrap');
  if (w) w.scrollTop = w.scrollHeight;
}

function pickNode(id) {
  Sound.chessMove();
  const n = P.nodes[id];
  P.pos = n;
  n.visited = true;

  if (n.type === 'shop') return showShop();
  if (n.type === 'rest') return showRest();
  startBattle(makeEncounter(n.type, n.f), win => onBattleEnd(win, n));
}

// ----- 전투 승리 보상 화면 -----
function onBattleEnd(win, node) {
  if (!win) return showGameOver();
  const kind = node.type;

  P.party.forEach(p => {
    if (p.hp > 0) gainXp(p, kind === 'elite' ? 3 : 1);
  });

  const healedNames = [];
  P.party.forEach(p => {
    if (p.hp <= 0) {
      p.hp = Math.max(1, Math.ceil(p.maxHp * 0.35));
      healedNames.push(pname(p));
    }
  });

  P.king.hp = Math.min(P.king.maxHp, P.king.hp + 4);
  if (kind === 'boss') return showVictory();

  const gold = kind === 'elite' ? 40 + rnd(20) : 15 + rnd(12);
  P.gold += gold;

  const pool = P.party.flatMap(p => CLASS_BY[p.cid].cards);
  const offers = shuffle(pool.slice()).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);

  app().innerHTML = `
    ${hud()}
    <div class="reward-screen">
      <div class="reward-box">
        <h2 class="reward-title">승리! (전투 승리)</h2>
        <div class="reward-summary">
          <p>💰 골드 획득: <b>+${gold} G</b></p>
          <p>⭐ 생존한 폰들이 전투 경험치를 획득했습니다.</p>
          ${healedNames.length ? `<p class="resurrect-txt">🩹 쓰러졌던 [${healedNames.join(', ')}]이 응급 치료를 받고 35% 체력으로 전선에 복귀했습니다.</p>` : ''}
        </div>
        <h3 class="card-pick-title">덱에 추가할 카드를 선택하십시오</h3>
        <div class="reward-cards">
          ${offers.map(id => cardRewardHtml(id, `onclick="takeCard('${id}')"`)).join('')}
        </div>
        <button class="btn reward-skip-btn" onclick="Sound.click(); showMap()">보상 건너뛰기</button>
      </div>
    </div>`;
}

function takeCard(id) {
  Sound.cardDraw();
  P.deck.push(id);
  showMap();
}

function cardRewardHtml(id, attr = '') {
  const c = CARDS[id], d = CLASS_BY[c.cls];
  return `
    <div class="card reward-card ${c.ult ? 'ult-card' : ''}" style="--theme:${d ? d.theme : '#c59b4c'}" ${attr} onmouseenter="Sound.cardHover()">
      ${c.cls && c.cls !== 'common' ? `<div class="card-bg" style="background-image: url('images/units/${c.cls}.png');"></div>` : ''}
      <div class="card-cost-gem">${c.cost}</div>
      <div class="card-type-ribbon ${c.type || 'attack'}">${c.ult ? '궁극기' : (c.type === 'skill' ? '스킬' : '공격')}</div>
      <div class="card-art-box">
        ${c.cls && c.cls !== 'common' ? `
          <img class="card-art-img" src="images/units/${c.cls}.png" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';" onload="this.nextElementSibling.style.display='none';" />
        ` : ''}
        <span class="card-icon">${d ? d.icon : '✨'}</span>
      </div>
      <div class="card-title">${c.name}</div>
      <div class="card-desc">${c.desc}</div>
      <div class="card-owner-badge" style="color:${d ? d.theme : '#ffd56b'}">${d ? d.name : '공용'}</div>
    </div>`;
}

// ----- 방랑 상인 & 모닥불 휴식처 -----
function showShop() {
  if (!P.shopStock || P.shopNode !== P.pos) {
    P.shopNode = P.pos;
    const pool = P.party.flatMap(p => CLASS_BY[p.cid].cards);
    P.shopStock = shuffle(pool.slice())
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 4)
      .map(id => ({ id, price: 30 + CARDS[id].cost * 12, sold: false }));
  }

  app().innerHTML = `
    ${hud()}
    <div class="shop-screen">
      <div class="shop-header">
        <h2>🛒 방랑 상인의 마차</h2>
        <p class="dim-desc">"원정대장 나리, 좋은 물건들이 많습니다. 천천히 둘러보시지요."</p>
      </div>
      <div class="shop-cards">
        ${P.shopStock.map((s, i) => `
          <div class="shop-item-wrap">
            ${cardRewardHtml(s.id, s.sold ? 'style="opacity:0.3; pointer-events:none;"' : `onclick="buyCard(${i})"`)}
            <div class="shop-price-tag ${s.sold ? 'sold-out' : ''}">
              ${s.sold ? '품절' : `💰 ${s.price} G`}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="shop-services">
        <button class="btn service-btn" onclick="buyHeal()">
          <span>💊 파티 전원 체력 40% 회복</span>
          <b>💰 35 G</b>
        </button>
        <button class="btn service-btn" onclick="buyXp()">
          <span>📘 고대 비급서 (전원 EXP +2)</span>
          <b>💰 45 G</b>
        </button>
        <button class="btn service-btn" onclick="showRemove()">
          <span>🗑️ 덱 압축 (불필요한 카드 정화)</span>
          <b>💰 40 G</b>
        </button>
      </div>
      <button class="btn big gold-btn" onclick="Sound.click(); showMap()">상점을 떠나기</button>
    </div>`;
}

function buyCard(i) {
  const s = P.shopStock[i];
  if (s.sold || P.gold < s.price) return;
  Sound.levelUp();
  P.gold -= s.price;
  s.sold = true;
  P.deck.push(s.id);
  showShop();
}

function healAll(ratio) {
  P.party.forEach(p => p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * ratio)));
  P.king.hp = Math.min(P.king.maxHp, P.king.hp + Math.ceil(P.king.maxHp * ratio));
}

function buyHeal() {
  if (P.gold < 35) return;
  Sound.heal();
  P.gold -= 35;
  healAll(0.4);
  showShop();
}

function buyXp() {
  if (P.gold < 45) return;
  Sound.levelUp();
  P.gold -= 45;
  P.party.forEach(p => gainXp(p, 2));
  showShop();
}

function showRemove() {
  if (P.gold < 40) return;
  Sound.click();
  app().innerHTML = `
    ${hud()}
    <div class="remove-screen">
      <h2>정화할 카드를 고르십시오 (비용 40 G)</h2>
      <p class="dim-desc">덱에서 카드를 1장 영구 제거하여 드로우 순환율을 높입니다.</p>
      <div class="reward-cards">
        ${P.deck.map((id, i) => cardRewardHtml(id, `onclick="removeCard(${i})"`)).join('')}
      </div>
      <button class="btn" onclick="Sound.click(); showShop()">취소하고 돌아가기</button>
    </div>`;
}

function removeCard(i) {
  if (P.deck.length <= 6) return;
  Sound.slash();
  P.gold -= 40;
  P.deck.splice(i, 1);
  showShop();
}

function showRest() {
  app().innerHTML = `
    ${hud()}
    <div class="rest-screen">
      <div class="bonfire-art">🔥</div>
      <h2>모닥불 휴식처</h2>
      <p class="dim-desc">타오르는 불빛 곁에서 전열을 가다듬습니다.</p>
      <div class="rest-choices">
        <div class="rest-card" onclick="doRest(1)">
          <span class="rest-ico">⛺</span>
          <h3>휴식</h3>
          <p>국왕과 전 폰의 생명력을 <b>50% 회복</b>합니다.</p>
        </div>
        <div class="rest-card" onclick="doRest(2)">
          <span class="rest-ico">⚔️</span>
          <h3>전술 훈련</h3>
          <p>모든 폰의 경험치를 <b>+2 획득</b>시킵니다.</p>
        </div>
      </div>
    </div>`;
}

function doRest(k) {
  if (k === 1) {
    Sound.heal();
    healAll(0.5);
  } else {
    Sound.levelUp();
    P.party.forEach(p => gainXp(p, 2));
  }
  showMap();
}

// ----- 원정대 관리 및 전직 모달 -----
function modal(html) {
  const m = document.getElementById('modal');
  m.innerHTML = `
    <div class="modal-backdrop" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()">
        ${html}
        <button class="btn sm modal-close-btn" onclick="Sound.click(); closeModal()">창 닫기</button>
      </div>
    </div>`;
}

function closeModal() {
  document.getElementById('modal').innerHTML = '';
}

function showParty() {
  modal(`
    <h2 class="modal-title">원정대 폰 상태 & 체스 진화 전직</h2>
    <div class="party-list">
      ${P.party.map((p, i) => {
        const c = CLASS_BY[p.cid];
        const canPromo = p.level >= PROMO_LV && !p.promoted;
        return `
          <div class="party-row" style="--theme:${c.theme}">
            <span class="party-ico">${c.icon}</span>
            <div class="party-info">
              <div class="party-name">
                <b>${pname(p)}</b> 
                <span class="badge-lv">Lv.${p.level}${p.promoted ? ' ★전직 완료' : ''}</span>
              </div>
              <div class="party-passive"><b>고유 패시브 [${c.passive.name}]</b>: ${c.passive.desc}</div>
              <div class="party-stats">❤️ 체력 ${p.hp}/${p.maxHp} · ⚔️ 공격력 ${p.atk} · ⭐ EXP ${p.level >= MAXLV ? 'MAX' : `${p.xp}/${need(p.level)}`}</div>
              <div class="party-range">
                <b>이동</b>: ${descPat(pat(p, 'move'))} / 
                <b>공격</b>: ${descPat(pat(p, 'atk'))}
              </div>
              ${p.promoted ? `<div class="party-promo-note">♟ <b>체스 진화</b>: ${c.promo.chessDesc}</div>` : ''}
            </div>
            <div class="party-action">
              ${canPromo ? `
                <button class="btn gold-btn promo-btn" onclick="promote(${i})">
                  전직 승급! ➔ ${c.promo.name}<br>
                  <small style="font-size:10px;">(궁극기 [${CARDS[c.ultCard].name}] 획득)</small>
                </button>` : `
                <span class="promo-hint">${p.promoted ? '최종 전직 완료' : `Lv.${PROMO_LV} 도달 시 전직 가능`}</span>
              `}
            </div>
          </div>`;
      }).join('')}
    </div>
  `);
}

function promote(i) {
  const p = P.party[i], c = CLASS_BY[p.cid], pr = c.promo;
  Sound.levelUp();
  p.promoted = true;
  p.maxHp += pr.hp;
  p.hp += pr.hp;
  p.atk += pr.atk;

  // 전직 궁극 카드 즉시 덱에 획득!
  if (c.ultCard && !P.deck.includes(c.ultCard)) {
    P.deck.push(c.ultCard);
  }

  FX.showTurnBanner('전직 각성 달성!', `${c.promo.name} 승급 완료!\n궁극기 [${CARDS[c.ultCard].name}] 덱 추가!`, '#ffd56b');
  showParty();
}

function showDeck() {
  const cnt = {};
  P.deck.forEach(id => cnt[id] = (cnt[id] || 0) + 1);
  modal(`
    <h2 class="modal-title">현재 보유 덱 (${P.deck.length}장)</h2>
    <div class="reward-cards">
      ${Object.keys(cnt).map(id => `
        <div class="deck-item-wrap">
          ${cardRewardHtml(id)}
          <div class="deck-count-badge">x${cnt[id]}장</div>
        </div>
      `).join('')}
    </div>
  `);
}

function showGameOver() {
  app().innerHTML = `
    <div class="title-screen gameover">
      <div class="title-decor">💀</div>
      <h1 class="main-title">국왕 킹이 쓰러졌습니다</h1>
      <p class="title-desc">${P.pos ? P.pos.f + 1 : 0}층에서 여정이 마감되었습니다.<br>전열을 재정비하여 다시 도전하십시오.</p>
      <button class="btn big gold-btn" onclick="Sound.click(); showTitle()">메인으로 귀환</button>
    </div>`;
}

function showVictory() {
  app().innerHTML = `
    <div class="title-screen victory">
      <div class="title-decor">🏆</div>
      <h1 class="main-title">마왕 발록 섬멸!</h1>
      <p class="title-desc">빅토리아 아일랜드의 평화를 되찾았습니다.<br>원정대 전원이 승리의 영예를 안았습니다.</p>
      <button class="btn big gold-btn" onclick="Sound.click(); showTitle()">새로운 원정</button>
    </div>`;
}

showTitle();
