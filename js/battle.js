// ===== 전투 엔진 : 메이플 패시브, 체스 진화 전직, 전술 연계 카드 =====
const DIRS = { orth: [[1, 0], [-1, 0], [0, 1], [0, -1]], diag: [[1, 1], [1, -1], [-1, 1], [-1, -1]] };
DIRS.all = DIRS.orth.concat(DIRS.diag);
const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

let GameSpeed = 1.0;
const sleep = ms => new Promise(r => setTimeout(r, Math.max(10, ms / GameSpeed)));
const inb = (x, y) => {
  const sz = B ? B.size : 6;
  return x >= 0 && y >= 0 && x < sz && y < sz;
};
const cheb = (u, x, y) => Math.max(Math.abs(u.x - x), Math.abs(u.y - y));

let B = null;
let unitIdCounter = 1;
let isAutoRunning = false;

function D(u) {
  if (!u) return {};
  const enemies = (typeof window !== 'undefined' && window.ENEMIES) || ENEMIES;
  const king = (typeof window !== 'undefined' && window.KING) || KING;
  const classBy = (typeof window !== 'undefined' && window.CLASS_BY) || CLASS_BY;
  return (u.side === 'e' ? enemies[u.eid] : u.king ? king : classBy[u.cid]) || {};
}
function uname(u) { const d = D(u); return u.promoted && d.promo ? d.promo.name : (d.name || ''); }
function uicon(u) { return D(u).icon || '♟️'; }
function effAtk(u) {
  let a = u.atk + (u.buff || 0);
  if (u.energyStack) a += u.energyStack;
  return Math.max(0, a);
}

if (typeof window !== 'undefined') {
  window.D = D;
  window.uname = uname;
  window.uicon = uicon;
  window.effAtk = effAtk;
}

function pat(u, k) {
  const d = D(u);
  const key = k === 'move' ? 'move' : 'atkp';
  if (u.promoted && d.promo && d.promo[key]) return d.promo[key];
  return d[key];
}

function unitAt(x, y) { return B ? B.units.find(u => u.x === x && u.y === y && !u.dead) : null; }
function cardOwner(c) {
  if (!B) return null;
  if (c.cls === 'common') {
    const active = B.activeUnits && B.activeUnits.length ? B.activeUnits[0] : null;
    const currentSel = (B.sel && B.sel.side === 'p' && !B.sel.dead) ? B.sel : (active || P.king);
    return { unit: currentSel, isKingProxy: false, isCommon: true };
  }
  const alive = B.units.find(u => u.side === 'p' && !u.king && u.cid === c.cls && !u.dead);
  if (alive) return { unit: alive, isKingProxy: false };
  // 폰 사망 시 국왕(킹)이 대리 발동 (+1 코스트 페널티)
  if (P.king && !P.king.dead) return { unit: P.king, isKingProxy: true };
  return null;
}
function effectiveCardCost(c, ownerInfo) {
  return c.cost + (ownerInfo && ownerInfo.isKingProxy ? 1 : 0);
}

const need = lv => 3 + 2 * lv;

function log(t) {
  if (!B) return;
  B.log.unshift(t);
  if (B.log.length > 60) B.log.pop();
}
function float(x, y, txt, cls) {
  if (B) B.floats.push({ x, y, txt, cls });
}

// ----- 배속 설정 -----
function setSpeed(sp) {
  GameSpeed = sp;
  FX.setSpeed(sp);
  const btn = document.getElementById('speed-btn');
  if (btn) btn.textContent = `⚡ ${GameSpeed.toFixed(1)}x`;
}
function toggleSpeed() {
  Sound.click();
  if (GameSpeed === 1.0) setSpeed(1.5);
  else if (GameSpeed === 1.5) setSpeed(2.0);
  else if (GameSpeed === 2.0) setSpeed(3.0);
  else setSpeed(1.0);
}

// ----- 이동 / 공격 판정 (로열 나이트 등 확장) -----
function moveTiles(u) {
  const p = pat(u, 'move'), res = [];
  if (p.dirs === 'knight' || p.dirs === 'royalKnight') {
    for (const [dx, dy] of KN) {
      const x = u.x + dx, y = u.y + dy;
      if (inb(x, y) && !unitAt(x, y)) res.push({ x, y });
    }
  }
  if (p.dirs === 'royalKnight') {
    for (const [dx, dy] of DIRS.diag) {
      for (let s = 1; s <= 2; s++) {
        const x = u.x + dx * s, y = u.y + dy * s;
        if (!inb(x, y) || unitAt(x, y)) break;
        res.push({ x, y });
      }
    }
    return res;
  }
  if (p.dirs === 'knight') return res;

  for (const [dx, dy] of DIRS[p.dirs]) {
    for (let s = 1; s <= p.range; s++) {
      const x = u.x + dx * s, y = u.y + dy * s;
      if (!inb(x, y) || unitAt(x, y)) break;
      res.push({ x, y });
    }
  }
  return res;
}

function attackTargets(u) {
  const p = pat(u, 'atk'), res = [];
  if (p.dirs === 'knight') {
    for (const [dx, dy] of KN) {
      const t = unitAt(u.x + dx, u.y + dy);
      if (t && t.side !== u.side && !t.dead) res.push(t);
    }
    return res;
  }
  for (const [dx, dy] of DIRS[p.dirs]) {
    for (let s = 1; s <= p.range; s++) {
      const nx = u.x + dx * s, ny = u.y + dy * s;
      if (!inb(nx, ny)) break;
      const t = unitAt(nx, ny);
      if (!t) continue;
      const enemy = t.side !== u.side;
      if (enemy && s >= (p.minRange || 1) && !t.dead) res.push(t);
      if (p.arc) continue;
      if (p.pierce && enemy) continue;
      break;
    }
  }
  return res;
}

// ----- 슬더스식 적 의도 계산 -----
function computeEnemyIntent(e) {
  if (e.frozen > 0) return { type: 'frozen', icon: '❄️', desc: '빙결 상태 (행동 불가)' };
  if (D(e).summon && (B.turn + 1) % D(e).summon.every === 0) {
    return { type: 'summon', icon: '😈', text: '소환', desc: '다음 턴에 수하 몬스터를 소환합니다!' };
  }
  const targets = attackTargets(e);
  if (targets.length) {
    targets.sort((a, b) => (b.king ? 1 : 0) - (a.king ? 1 : 0) || a.hp - b.hp);
    const target = targets[0];
    const dmg = effAtk(e);
    return {
      type: 'attack',
      icon: '⚔️',
      val: dmg,
      target,
      targetName: uname(target),
      desc: `${uname(target)}에게 ${dmg}의 공격 예정!`
    };
  }
  return { type: 'move', icon: '👣', text: '진격', desc: '아군 진형을 향해 이동합니다.' };
}

function updateAllEnemyIntents() {
  if (!B) return;
  for (const u of B.units) {
    if (u.side === 'e' && !u.dead) {
      u.intent = computeEnemyIntent(u);
    }
  }
}

// ----- 카드 대상 판정 -----
function cardTargets(c, o) {
  const res = [];
  const sz = B ? B.size : 6;
  for (let x = 0; x < sz; x++) {
    for (let y = 0; y < sz; y++) {
      const dist = cheb(o, x, y), dx = Math.abs(o.x - x), dy = Math.abs(o.y - y);
      if (dist > c.range) continue;
      if (c.line && !(dx === 0 || dy === 0 || dx === dy)) continue;
      const u = unitAt(x, y);
      if (c.target === 'enemy' && !(u && u.side === 'e')) continue;
      if (c.target === 'ally' && !(u && u.side === 'p')) continue;
      if (c.target === 'tile' && dist === 0) continue;
      res.push({ x, y });
    }
  }
  return res;
}

// ----- 넉백 처리 (체스판 밀쳐내기) -----
async function applyKnockback(target, fromX, fromY, distance = 1) {
  if (!target || target.dead) return;
  try {
    let dx = Math.sign(target.x - fromX);
    let dy = Math.sign(target.y - fromY);
    if (dx === 0 && dy === 0) dy = -1;

    let destX = target.x;
    let destY = target.y;

    for (let step = 1; step <= distance; step++) {
      const nx = target.x + dx * step;
      const ny = target.y + dy * step;
      if (inb(nx, ny) && !unitAt(nx, ny)) {
        destX = nx;
        destY = ny;
      } else {
        // 벽이나 다른 기물에 충돌 시 추가 충돌 피해 2
        dealDamage(target, 2);
        float(target.x, target.y, '충돌 +2', 'dmg');
        break;
      }
    }

    if (destX !== target.x || destY !== target.y) {
      const elem = document.getElementById(`unit-${target.uid}`);
      if (elem && window.FX && FX.animateMove) {
        const cellSize = 68;
        await FX.animateMove(elem, (destX - target.x) * cellSize, (destY - target.y) * cellSize, false, target);
      }
      target.x = destX;
      target.y = destY;
    }
  } catch (err) {
    console.error('넉백 처리 중 오류:', err);
  }
}

// ----- 피해 및 처치 판정 -----
function gainXp(u, n) {
  if (u.king || u.level >= MAXLV) return;
  u.xp += n;
  while (u.level < MAXLV && u.xp >= need(u.level)) {
    u.xp -= need(u.level);
    u.level++;
    u.maxHp += 2;
    u.hp += 2;
    if (u.level === 3 || u.level === 5) u.atk++;
    Sound.levelUp();
    log(`⭐ ${uname(u)} Lv.${u.level} 달성!` + (u.level === PROMO_LV && !u.promoted ? ' (전직 가능!)' : ''));
    if (u.x != null) float(u.x, u.y, 'LEVEL UP!', 'lv');
  }
}

function dealDamage(target, amt, src) {
  if (!B.units.includes(target) || target.dead) return;

  // 전사 패시브: 인접 아군(킹 포함) 피격 시 전사가 대신 맞아줌 (스탠스 도발)
  if (target.side === 'p' && target.cid !== 'warrior') {
    const warrior = B.units.find(u => u.side === 'p' && u.cid === 'warrior' && !u.dead && cheb(u, target.x, target.y) <= 1);
    if (warrior && !warrior.guardedThisTurn) {
      warrior.guardedThisTurn = true;
      log(`🛡️ ${uname(warrior)}가 ${uname(target)}을 대신해 공격을 막아섰습니다! (아이언 스탠스)`);
      float(warrior.x, warrior.y, '수호!', 'blk');
      dealDamage(warrior, amt, src);
      return;
    }
  }

  // 전사 피격 시 방어도 +2 획득 패시브
  if (target.side === 'p' && target.cid === 'warrior') {
    target.shield += 2;
    float(target.x, target.y, '🛡+2', 'blk');
  }

  let a = amt;
  if (target.shield > 0) {
    const ab = Math.min(target.shield, a);
    target.shield -= ab;
    a -= ab;
    Sound.shield();
  }
  target.hp -= a;
  float(target.x, target.y, a > 0 ? `-${a}` : '방어', a > 0 ? 'dmg' : 'blk');

  const elem = document.getElementById(`unit-${target.uid}`);
  if (elem) FX.animateHit(elem);

  if (target.hp <= 0) {
    target.hp = 0;
    target.dead = true;
    log(`💀 ${uname(target)} 쓰러짐`);
    if (src && src.side === 'p' && target.side === 'e') gainXp(src, D(target).xp);
    checkEnd();
  }
}

function checkEnd() {
  if (B.over) return;
  if (P.king.hp <= 0) {
    B.over = true;
    Sound.defeat();
    setTimeout(() => B.onEnd(false), 900 / GameSpeed);
    return;
  }
  const livingEnemies = B.units.filter(u => u.side === 'e' && !u.dead);
  if (!livingEnemies.length && B.waveIdx >= B.enc.waves.length) {
    B.over = true;
    Sound.victory();
    log('🏆 전장의 모든 적을 섬멸했습니다!');
    setTimeout(() => B.onEnd(true), 900 / GameSpeed);
  }
}

// ----- 기본 공격 (직업 패시브 시너지 통합) -----
async function doAttack(u, t) {
  u.attacked = true;
  B.busy = true;
  const elemA = document.getElementById(`unit-${u.uid}`);
  const elemT = document.getElementById(`unit-${t.uid}`);

  if (elemA && elemT) {
    await FX.animateAttack(elemA, elemT, u, t);
  } else {
    Sound.slash();
    await sleep(150);
  }

  let finalDmg = effAtk(u);

  // 1) 헌터 패시브: 3칸 이상 원거리 저격 시 데미지 +3 치명타!
  if (u.cid === 'archer') {
    const dist = Math.abs(u.x - t.x) + Math.abs(u.y - t.y);
    if (dist >= 3) {
      finalDmg += 3;
      float(u.x, u.y, '스나이핑! +3', 'buff');
      log(`🎯 ${uname(u)}의 스나이핑 원거리 치명타 발동!`);
    }
  }

  // 2) 썬콜 패시브: 빙결된 적 공격 시 2배 치명타 (동결 분쇄)!
  if (u.cid === 'ice' && t.frozen > 0) {
    finalDmg *= 2;
    float(t.x, t.y, '동결 분쇄 x2!', 'frz');
    log(`⚡ ${uname(u)}의 동결 분쇄 2배 치명타 작렬!`);
  }

  // 3) 인파이터 패시브: 공격 시 기력 스택 축적 (최대 3)
  if (u.cid === 'brawler') {
    u.energyStack = Math.min(3, (u.energyStack || 0) + 1);
    float(u.x, u.y, `기력 +${u.energyStack}`, 'buff');
    log(`👊 ${uname(u)}의 에너지 차지 (${u.energyStack}/3 스택)!`);
  }

  // 4) 건슬링거 패시브: 매 턴 첫 공격 성공 시 코스트 +1 충전
  if (u.cid === 'gunner' && !u.reloadedThisTurn) {
    u.reloadedThisTurn = true;
    B.mana = Math.min(10, B.mana + 1);
    float(u.x, u.y, '코스트 +1', 'blk');
    log(`⚙️ ${uname(u)}의 탄환 장전으로 코스트 +1 환급!`);
  }

  // 5) 불독 패시브: 타격한 적에게 중독 1스택 부여
  if (u.cid === 'fire') {
    t.poison = (t.poison || 0) + 1;
    float(t.x, t.y, `🧪 중독 ${t.poison}`, 'dmg');
    log(`🧪 ${uname(t)}에게 중독 스택 부여!`);
  }

  log(`⚔️ ${uname(u)} → ${uname(t)} (${finalDmg} 피해)`);
  dealDamage(t, finalDmg, u);
  FX.shake(3);

  // 6) 바이퍼 전직 공격: 적을 2칸 넉백
  const p = pat(u, 'atk');
  if (p.knockback && !t.dead) {
    await applyKnockback(t, u.x, u.y, p.knockback);
  }

  // 7) 썬콜 아크메이지 전직: 체인 라이트닝 연쇄 전이
  if (p.chain && !t.dead) {
    const chainTarget = B.units.find(e => e.side === 'e' && !e.dead && e !== t && cheb(e, t.x, t.y) <= 2);
    if (chainTarget) {
      log(`⚡ 번개가 ${uname(chainTarget)}에게 연쇄 튕김!`);
      dealDamage(chainTarget, Math.ceil(finalDmg * 0.6), u);
    }
  }

  B.busy = false;
  renderBattle();
}

// ----- 기본 이동 (어쌔신 착지 패시브 등 연계) -----
async function doMove(u, x, y) {
  u.moved = true;
  B.busy = true;

  const elem = document.getElementById(`unit-${u.uid}`);
  const isKnight = pat(u, 'move').dirs === 'knight' || pat(u, 'move').dirs === 'royalKnight';

  if (elem) {
    const cellSize = 68;
    const dx = (x - u.x) * cellSize;
    const dy = (y - u.y) * cellSize;
    Sound.chessMove(isKnight);
    await FX.animateMove(elem, dx, dy, isKnight, u);
  }

  u.x = x;
  u.y = y;

  // 어쌔신 패시브: 나이트 점프 착지 시 인접 8칸 적에게 방어도 무시 2 급습 피해!
  if (u.cid === 'thief' && isKnight) {
    const nearEnemies = B.units.filter(e => e.side === 'e' && !e.dead && cheb(e, x, y) <= 1);
    if (nearEnemies.length) {
      log(`💨 ${uname(u)}의 헤이스트 급습! 인접 적들에게 암살 피해`);
      for (const ne of nearEnemies) {
        dealDamage(ne, 2, u);
      }
    }
  }

  B.busy = false;
  updateAllEnemyIntents();
  renderBattle();
}

// ===== 데우스 엑스 마키나 : 턴 스냅샷 및 시간 역행(무르기) 엔진 =====
function saveTurnSnapshot() {
  if (!B) return;
  B.turnStartSnapshot = {
    units: B.units.map(u => ({ ...u })),
    mana: B.mana,
    maxMana: B.maxMana,
    hand: [...B.hand],
    discard: [...B.discard],
    deck: [...B.deck],
    activeUnitIds: new Set(B.activeUnitIds || [])
  };
  B.planQueue = [];
}

async function rewindTurn() {
  if (!B || B.busy || B.over || B.phase !== 'plan' || !B.turnStartSnapshot) return;
  B.busy = true;

  const statusTag = document.getElementById('clock-status-tag');
  const statusSub = document.getElementById('clock-status-sub');
  if (statusTag) {
    statusTag.className = 'clock-status-tag time-rewind';
    statusTag.textContent = '⏪ 수 무르기';
  }
  if (statusSub) statusSub.textContent = '인과율을 되돌리는 중...';

  // 데우스 엑스 마키나 — 화면 중앙 거대 시계 [수 무르기] 역회전 컷씬
  if (window.ChronosClock) {
    await ChronosClock.playCutscene('rewind');
  }

  // 스냅샷 복구
  const snap = B.turnStartSnapshot;
  snap.units.forEach(su => {
    const live = B.units.find(u => u.uid === su.uid);
    if (live) Object.assign(live, { ...su });
  });
  B.mana = snap.mana;
  B.maxMana = snap.maxMana;
  B.hand = [...snap.hand];
  B.discard = [...snap.discard];
  B.deck = [...snap.deck];
  B.activeUnitIds = new Set(snap.activeUnitIds);
  B.activeUnits = B.units.filter(u => B.activeUnitIds.has(u.uid));
  B.planQueue = [];
  B.card = null;
  B.sel = null;

  log('⏪ [수 무르기]: 시간을 거꾸로 되감아 턴 시작 시점으로 회귀했습니다!');
  float(P.king.x, P.king.y, 'TIME REWIND', 'buff');

  if (statusTag) {
    statusTag.className = 'clock-status-tag time-stopped';
    statusTag.textContent = '⏳ 시간 정지';
  }
  if (statusSub) statusSub.textContent = '인과율 지시 단계';

  B.busy = false;
  renderBattle();
}

// ===== 인과율 플래닝 (지시 등록) =====
function planMove(u, x, y) {
  if (u.moved) return;
  const isKnight = pat(u, 'move').dirs === 'knight' || pat(u, 'move').dirs === 'royalKnight';
  Sound.chessMove(isKnight);

  B.planQueue.push({
    type: 'move',
    uid: u.uid,
    fromX: u.x,
    fromY: u.y,
    toX: x,
    toY: y,
    desc: `${uname(u)} 이동`
  });

  u.moved = true;
  u.x = x;
  u.y = y;
  updateAllEnemyIntents();
  renderBattle();
}

function planAttack(u, target) {
  if (u.attacked) return;
  Sound.slash();

  B.planQueue.push({
    type: 'attack',
    uid: u.uid,
    targetUid: target.uid,
    desc: `${uname(u)} ➔ ${uname(target)} 공격`
  });

  u.attacked = true;
  float(target.x, target.y, '조준!', 'dmg');
  renderBattle();
}

function planCard(i, tx, ty) {
  const id = B.hand[i], c = CARDS[id], ownerInfo = cardOwner(c);
  if (!ownerInfo) return;
  const cost = effectiveCardCost(c, ownerInfo);
  if (B.mana < cost) return;

  Sound.cardPlay();
  B.mana -= cost;
  B.hand.splice(i, 1);
  B.card = null;
  FX.clearTargetingArrow();

  B.planQueue.push({
    type: 'card',
    cardId: id,
    cardName: c.name,
    ownerUid: ownerInfo.unit.uid,
    tx, ty,
    cost,
    desc: `[${c.name}] 발동`
  });

  float(tx, ty, `[${c.name}]`, 'buff');
  renderBattle();
}

// ===== 인과율 집행 (시간 시작 & 순차 실행) =====
async function executeTimeline() {
  if (!B || B.busy || B.over || B.phase !== 'plan') return;

  if (!B.planQueue || B.planQueue.length === 0) {
    log('⏳ [시간 시작]: 지시된 인과율이 없어 시간을 다음 턴으로 흘려보냅니다.');
    B.phase = 'execute';
    endTurn();
    return;
  }

  B.busy = true;
  B.phase = 'execute';
  B.sel = null;
  B.card = null;
  FX.clearTargetingArrow();

  const statusTag = document.getElementById('clock-status-tag');
  const statusSub = document.getElementById('clock-status-sub');
  if (statusTag) {
    statusTag.className = 'clock-status-tag time-running';
    statusTag.textContent = '⚡ 인과율 흐름';
  }
  if (statusSub) statusSub.textContent = '아군 연속 행동 집행 중...';

  // 1단계: 원래 자리로 스냅백 복귀 ("그 말들이 원래 자리로 다시 돌아왔다가")
  if (B.turnStartSnapshot) {
    const snap = B.turnStartSnapshot;
    snap.units.forEach(su => {
      const live = B.units.find(u => u.uid === su.uid);
      if (live) {
        live.x = su.x;
        live.y = su.y;
        live.moved = false;
        live.attacked = false;
      }
    });
  }
  renderBattle();
  log('⚡ [시간 재개]: 기물들이 출발 위치로 정렬하고 시간을 가속합니다!');
  await sleep(150);

  // 2단계: 화면 중앙 거대 시계 [아군 행동 개시] 시간 재개/가속 컷씬
  if (window.ChronosClock) {
    await ChronosClock.playCutscene('flow');
  }

  // 시간 재개 플래시 및 효과음
  if (window.FX) FX.showTimeResumeFlash();
  Sound.timeResume();
  await sleep(150);

  try {
    // 3단계: 차례차례 순서대로 실제 액션 실행
    const queue = [...B.planQueue];
    for (let idx = 0; idx < queue.length; idx++) {
      if (B.over) break;
      const act = queue[idx];
      log(`▶ [인과율 ${idx + 1}/${queue.length}]: ${act.desc}`);

      if (act.type === 'move') {
        const u = B.units.find(u => u.uid === act.uid);
        if (u && !u.dead) {
          await doMove(u, act.toX, act.toY);
          await sleep(200);
        }
      } else if (act.type === 'attack') {
        const u = B.units.find(u => u.uid === act.uid);
        const t = B.units.find(u => u.uid === act.targetUid);
        if (u && !u.dead && t && !t.dead) {
          await doAttack(u, t);
          await sleep(260);
        }
      } else if (act.type === 'card') {
        await executeCardAction(act);
        await sleep(280);
      }
    }
  } catch (err) {
    console.error('인과율 집행 중 오류:', err);
  } finally {
    B.planQueue = [];
    B.busy = false;
  }

  // 4단계: 적 턴으로 전환
  if (!B.over) {
    await sleep(250);
    endTurn();
  }
}

async function executeCardAction(act) {
  try {
    const c = CARDS[act.cardId];
    if (!c) return;
  const o = B.units.find(u => u.uid === act.ownerUid) || P.king;
  const tx = act.tx, ty = act.ty;

  const oElem = document.getElementById('unit-' + o.uid);
  const theme = o.king ? '#ffd700' : (CLASS_BY[o.cid]?.theme || '#ffd700');

  Sound.cardPlay();
  if (oElem) {
    FX.createSparkles(oElem.offsetLeft + 34, oElem.offsetTop + 34, theme, 12);
  }

  if (!c.temp) B.discard.push(act.cardId);

  const pw = (o.promoted ? 1 : 0) + (c.ult ? 2 : 0);
  const fx = c.fx;

  log(`🃏 ${uname(o)}: [${c.name}] 발동!`);

  if (c.retreat) {
    const rx = o.x - Math.sign(tx - o.x);
    const ry = o.y - Math.sign(ty - o.y);
    if (inb(rx, ry) && !unitAt(rx, ry)) {
      const elem = document.getElementById(`unit-${o.uid}`);
      if (elem) {
        const cellSize = 68;
        await FX.animateMove(elem, (rx - o.x) * cellSize, (ry - o.y) * cellSize, true, o);
      }
      o.x = rx; o.y = ry;
      log(`🏹 ${uname(o)}가 뒤로 1칸 도약하며 사격했습니다!`);
    }
  }

  if (c.dash) {
    const target = unitAt(tx, ty);
    if (target) {
      const dx = Math.sign(target.x - o.x);
      const dy = Math.sign(target.y - o.y);
      const frontX = target.x - dx;
      const frontY = target.y - dy;
      if (inb(frontX, frontY) && !unitAt(frontX, frontY)) {
        const elem = document.getElementById(`unit-${o.uid}`);
        if (elem) {
          const cellSize = 68;
          await FX.animateMove(elem, (frontX - o.x) * cellSize, (frontY - o.y) * cellSize, false, o);
        }
        o.x = frontX; o.y = frontY;
        log(`👊 ${uname(o)}가 대상 앞으로 돌격했습니다!`);
      }
    }
  }

  if (c.teleportBehind) {
    const target = unitAt(tx, ty);
    if (target) {
      const behindX = target.x + Math.sign(target.x - o.x);
      const behindY = target.y + Math.sign(target.y - o.y);
      if (inb(behindX, behindY) && !unitAt(behindX, behindY)) {
        const elem = document.getElementById(`unit-${o.uid}`);
        if (elem) {
          const cellSize = 68;
          await FX.animateMove(elem, (behindX - o.x) * cellSize, (behindY - o.y) * cellSize, true, o);
        }
        o.x = behindX; o.y = behindY;
        log(`🗡️ ${uname(o)}가 적의 등 뒤로 그림자 이동했습니다!`);
      }
    }
  }

  const cx = c.target === 'self' ? o.x : tx, cy = c.target === 'self' ? o.y : ty;
  const r = fx.aoe || 0;
  const area = B.units.filter(u => !u.dead && cheb(u, cx, cy) <= r);

  if (r > 0 || c.target === 'tile') {
    FX.shake(5);
    for (let x = cx - r; x <= cx + r; x++) {
      for (let y = cy - r; y <= cy + r; y++) {
        if (inb(x, y)) float(x, y, '', 'aoe');
      }
    }
  }

  for (const u of area) {
    if (u.side === 'e') {
      if (fx.dmg) dealDamage(u, fx.dmg + pw, o);
      if (fx.freeze && B.units.includes(u)) {
        u.frozen = fx.freeze;
        Sound.freeze();
        float(u.x, u.y, '❄️ 빙결', 'frz');
      }
      if (fx.poison && B.units.includes(u)) {
        u.poison = (u.poison || 0) + fx.poison;
        float(u.x, u.y, `🧪 중독 ${u.poison}`, 'dmg');
      }
      if (c.knockback && !u.dead) {
        await applyKnockback(u, o.x, o.y, c.knockback);
      }
      if (fx.chain && !u.dead) {
        const chainTarget = B.units.find(e => e.side === 'e' && !e.dead && e !== u && cheb(e, u.x, u.y) <= 2);
        if (chainTarget) {
          log(`⚡ 체인 라이트닝이 ${uname(chainTarget)}에게 전이!`);
          dealDamage(chainTarget, Math.ceil((fx.dmg + pw) * 0.6), o);
        }
      }
    } else if (u.side === 'p') {
      if (fx.heal) {
        u.hp = Math.min(u.maxHp, u.hp + fx.heal + pw);
        Sound.heal();
        float(u.x, u.y, `+${fx.heal + pw}`, 'heal');
      }
      if (fx.shield) {
        u.shield += fx.shield + pw;
        Sound.shield();
        float(u.x, u.y, `🛡+${fx.shield + pw}`, 'blk');
      }
      if (fx.buff) {
        u.buff = (u.buff || 0) + fx.buff;
        float(u.x, u.y, `⚔+${fx.buff}`, 'buff');
      }
    }
  }

  } catch (err) {
    console.error('executeCardAction 오류:', err);
  } finally {
    renderBattle();
  }
}

function spawnEnemies(ids) {
  const sz = B ? B.size : 6;
  for (const id of ids) {
    const cells = [];
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < sz; x++) {
        if (!unitAt(x, y)) cells.push({ x, y });
      }
    }
    if (!cells.length) break;
    const c = cells[rnd(cells.length)], d = ENEMIES[id];
    B.units.push({
      uid: unitIdCounter++,
      side: 'e',
      eid: id,
      hp: d.hp,
      maxHp: d.hp,
      atk: d.atk,
      x: c.x,
      y: c.y,
      shield: 0,
      frozen: 0,
      buff: 0,
      poison: 0,
      energyStack: 0,
      dead: false
    });
  }
  updateAllEnemyIntents();
}

function draw(n) {
  for (let i = 0; i < n; i++) {
    if (!B.deck.length) {
      B.deck = shuffle(B.discard);
      B.discard = [];
    }
    if (!B.deck.length) return;
    const c = B.deck.pop();
    if (B.hand.length < 8) {
      B.hand.push(c);
      Sound.cardDraw();
    } else {
      B.discard.push(c);
    }
  }
}

// ----- 전투 시작 (일반/엘리트 6×6, 보스전 8×8 확장 전장) -----
function startBattle(enc, onEnd) {
  const isBoss = enc.kind === 'boss' || enc.isBoss || (enc.name && enc.name.includes('보스'));
  const boardSize = isBoss ? 8 : 6;
  const theme = enc.theme || (isBoss ? 'balrog' : 'henesys');
  const regionName = enc.regionName || (isBoss ? '심연의 성소' : '헤네시스');
  const regionIcon = enc.regionIcon || (isBoss ? '🔥' : '🌿');
  const floorName = enc.floorName || (isBoss ? 'FINAL BOSS' : '전투');
  const lore = enc.lore || '';

  B = {
    enc,
    onEnd,
    size: boardSize,
    isBoss,
    theme,
    regionName,
    regionIcon,
    floorName,
    lore,
    units: [],
    turn: 0,
    over: false,
    busy: false,
    phase: 'plan', // 'plan' (시간 정지 지시) | 'execute' (시간 재개 실행)
    planQueue: [], // 인과율 지시 큐
    turnStartSnapshot: null, // 시간 역행(무르기)용 턴 시작 스냅샷
    sel: null,
    card: null,
    log: [],
    floats: [],
    waveIdx: 0,
    hand: [],
    discard: [],
    deck: shuffle(P.deck.slice())
  };

  const place = (u, x, y) => {
    u.uid = unitIdCounter++;
    Object.assign(u, {
      x, y,
      shield: 0,
      frozen: 0,
      buff: 0,
      poison: 0,
      energyStack: 0,
      guardedThisTurn: false,
      reloadedThisTurn: false,
      dead: false,
      moved: false,
      attacked: false
    });
    B.units.push(u);
  };

  if (boardSize === 6) {
    // 6×6 일반/엘리트 스테이지: 국왕 후열 중앙(2, 5), 폰 4명 전열 중앙(1~4, 4)
    place(P.king, 2, 5);
    const living = P.party.filter(p => p.hp > 0);
    const startX = Math.max(0, Math.floor((6 - living.length) / 2));
    living.forEach((p, idx) => {
      place(p, startX + idx, 4);
    });
  } else {
    // 8×8 보스전 스테이지: 국왕 후열 중앙(3, 7), 폰 4명 전열 중앙(2~5, 6)
    place(P.king, 3, 7);
    const living = P.party.filter(p => p.hp > 0);
    const startX = Math.max(0, Math.floor((8 - living.length) / 2));
    living.forEach((p, idx) => {
      place(p, startX + idx, 6);
    });
  }

  // 보스전일 경우 보스(발록)는 상단 중앙(3, 0)에 확정 배치되고 수하들은 양옆에 호위 배치
  if (isBoss) {
    const [bossId, ...minions] = enc.start;
    if (bossId) {
      const d = ENEMIES[bossId];
      B.units.push({
        uid: unitIdCounter++, side: 'e', eid: bossId,
        hp: d.hp, maxHp: d.hp, atk: d.atk,
        x: 3, y: 0,
        shield: 0, frozen: 0, buff: 0, poison: 0, energyStack: 0, dead: false
      });
    }
    minions.forEach((mid, idx) => {
      const d = ENEMIES[mid];
      const minionX = idx === 0 ? 2 : 4;
      B.units.push({
        uid: unitIdCounter++, side: 'e', eid: mid,
        hp: d.hp, maxHp: d.hp, atk: d.atk,
        x: minionX, y: 0,
        shield: 0, frozen: 0, buff: 0, poison: 0, energyStack: 0, dead: false
      });
    });
    updateAllEnemyIntents();
  } else {
    spawnEnemies(enc.start);
  }

  log(`⚔️ ${enc.name} 전장이 펼쳐졌습니다. (${boardSize}×${boardSize} 체스판)`);
  buildBattleUI();
  FX.init();
  setSpeed(GameSpeed);

  if (isBoss) {
    FX.showTurnBanner('🔥 마왕의 결전장!', '전장이 8×8로 확장되었습니다! 심연의 마왕에 맞서십시오.', '#e11d48');
  }

  newPlayerTurn();
}

// ----- 턴 시작 패시브 발동 (클레릭 힐, 캐논슈터 바나나, 스피어맨 진형) -----
function triggerTurnStartPassives() {
  const allies = B.units.filter(u => u.side === 'p' && !u.dead);

  // 1) 클레릭 패시브: 홀리 오라 (주변 8칸 아군 전원 HP +2)
  const clerics = allies.filter(u => u.cid === 'cleric');
  for (const cl of clerics) {
    const near = allies.filter(a => cheb(a, cl.x, cl.y) <= 1 && a.hp < a.maxHp);
    for (const a of near) {
      a.hp = Math.min(a.maxHp, a.hp + 2);
      float(a.x, a.y, '+2', 'heal');
    }
    if (near.length) log(`🕊️ ${uname(cl)}의 홀리 오라로 인접 아군 치유!`);
  }

  // 2) 스피어맨 패시브: 팔랑크스 진형 (자신 및 인접 아군 방어도 +3 상시 전개)
  const spearmen = allies.filter(u => u.cid === 'spear');
  for (const sp of spearmen) {
    const near = allies.filter(a => cheb(a, sp.x, sp.y) <= 1);
    for (const a of near) {
      a.shield += 3;
      float(a.x, a.y, '🛡+3', 'blk');
    }
    log(`🏛️ ${uname(sp)}의 팔랑크스 방진으로 방어도 전개!`);
  }

  // 3) 캐논슈터 패시브: 원숭이 보급 (매 턴 0코스트 바나나 생성)
  const cannoneers = allies.filter(u => u.cid === 'cannon');
  if (cannoneers.length && B.hand.length < 8) {
    B.hand.push('banana');
    Sound.cardDraw();
    log(`🐵 원숭이가 [원숭이 보급 바나나]를 던져주었습니다!`);
  }
}

// ----- 플레이어 턴 유닛 행동권 갱신 (전원 100% 출진 및 자유 행동) -----
function preparePlayerTurnUnits() {
  for (const u of B.units.filter(u => u.side === 'p')) {
    u.guardedThisTurn = false;
    u.reloadedThisTurn = false;
    if (u.frozen > 0) {
      u.frozen--;
      u.moved = u.attacked = true;
    } else {
      u.moved = u.attacked = false; // 모든 아군 유닛 전원 자유 행동 가능!
    }
  }
}

// ----- 턴 카드 드로우: 아군 폰 전원의 전용 카드 + 공용 전술 카드 -----
function dealTurnHand() {
  B.hand.forEach(id => {
    if (CARDS[id] && !CARDS[id].temp) B.discard.push(id);
  });
  B.hand = [];

  const newHand = [];

  // 1) 생존한 아군 폰 4명 각각의 전용 카드 1장씩 드로우
  const livingPawns = B.units.filter(u => u.side === 'p' && !u.king && !u.dead);
  livingPawns.forEach(u => {
    const cls = CLASS_BY[u.cid];
    if (!cls) return;
    const pool = cls.cards.slice();
    if (u.promoted && cls.ultCard) pool.push(cls.ultCard);
    const picked = pool[rnd(pool.length)];
    if (picked) newHand.push(picked);
  });

  // 2) 공용 전술 카드 풀에서 1장 드로우 (손패 총 5장 유지)
  const commonPool = shuffle(COMMON_CARDS.slice());
  if (commonPool[0]) newHand.push(commonPool[0]);

  B.hand = newHand;
  Sound.cardDraw();
}

async function newPlayerTurn() {
  B.turn++;
  B.maxMana = Math.min(10, B.turn + 1);
  B.mana = B.maxMana;
  isAutoRunning = false;

  // 웨이브 도착 확인
  if (B.turn > 1 && B.waveIdx < B.enc.waves.length) {
    const w = B.enc.waves[B.waveIdx];
    if (B.turn >= w.turn || !B.units.some(u => u.side === 'e' && !u.dead)) {
      spawnEnemies(w.units);
      B.waveIdx++;
      Sound.slash();
      log('⚠️ 새로운 몬스터 무리가 전장에 난입했습니다!');
      FX.showTurnBanner('웨이브 도착!', '새로운 적이 전장에 등장했습니다.', '#e04545');
    }
  }

  Sound.turnStart(true);
  await FX.showTurnBanner(`턴 ${B.turn} : 플레이어`, `코스트 +${B.mana} 충전`, '#d4af37');

  // 1단계: 모든 아군 유닛 행동권 갱신 (룰렛 없이 전원 즉시 출진)
  preparePlayerTurnUnits();

  // 2단계: 아군 기물 전용 카드 + 전술 카드 드로우
  dealTurnHand();

  triggerTurnStartPassives();
  updateAllEnemyIntents();

  // 3단계: 데우스 엑스 마키나 — 시간 정지 (Time Stop) 및 인과율 플래닝 개시
  B.phase = 'plan';
  B.planQueue = [];
  saveTurnSnapshot();

  // 데우스 엑스 마키나 — 화면 중앙 거대 시계 [내 턴 시작] 시간 정지 컷씬
  if (window.ChronosClock) {
    await ChronosClock.playCutscene('timestop');
  }

  const statusTag = document.getElementById('clock-status-tag');
  const statusSub = document.getElementById('clock-status-sub');
  if (statusTag) {
    statusTag.className = 'clock-status-tag time-stopped';
    statusTag.textContent = '⏳ 시간 정지';
  }
  if (statusSub) statusSub.textContent = '인과율 지시 단계';

  log(`⏳ [시간 정지]: 턴 ${B.turn} — 시간을 멈추고 아군 기물들의 행보를 지시하십시오.`);

  B.sel = null;
  B.card = null;
  B.busy = false;
  renderBattle();
}

// ----- 카드 발동 (돌진, 넉백, 후퇴, 순간이동 등 전술 연계) -----
async function playCard(i, tx, ty) {
  const id = B.hand[i], c = CARDS[id], ownerInfo = cardOwner(c);
  if (!ownerInfo) return;

  const o = ownerInfo.unit;
  const cost = effectiveCardCost(c, ownerInfo);
  if (B.mana < cost) return;

  const wasAuto = isAutoRunning;
  B.busy = true;
  FX.clearTargetingArrow();

  try {

  // 1) 카드 사용 애니메이션: 손패의 카드가 시전자 유닛으로 날아가 산산조각 바스러짐
  const cardElems = document.querySelectorAll('#hand .card');
  const cardElem = cardElems[i];
  const oElem = document.getElementById('unit-' + o.uid);
  const theme = o.king ? '#ffd700' : (CLASS_BY[o.cid]?.theme || '#ffd700');

  Sound.cardPlay();
  if (cardElem && oElem) {
    await FX.animateCardCast(cardElem, oElem, theme);
  }

  B.mana -= cost;
  B.hand.splice(i, 1);
  if (!c.temp) B.discard.push(id);
  B.card = null;

  const pw = (o.promoted ? 1 : 0) + (c.ult ? 2 : 0);
  const fx = c.fx;

  if (ownerInfo.isKingProxy) {
    log(`👑 국왕의 대리 지휘: [${c.name}] 발동! (코스트 +1)`);
  } else {
    log(`🃏 ${uname(o)}: [${c.name}] 발동!`);
  }

  // 1) 헌터 후퇴 연계 (애로우 블로우: 뒤로 1칸 도약)
  if (c.retreat) {
    const rx = o.x - Math.sign(tx - o.x);
    const ry = o.y - Math.sign(ty - o.y);
    if (inb(rx, ry) && !unitAt(rx, ry)) {
      const elem = document.getElementById(`unit-${o.uid}`);
      if (elem) {
        const cellSize = 68;
        await FX.animateMove(elem, (rx - o.x) * cellSize, (ry - o.y) * cellSize, true, o);
      }
      o.x = rx; o.y = ry;
      log(`🏹 ${uname(o)}가 뒤로 1칸 도약하며 사격했습니다!`);
    }
  }

  // 2) 인파이터 돌진 연계 (더블 임팩트: 대상 바로 앞칸으로 돌진)
  if (c.dash) {
    const target = unitAt(tx, ty);
    if (target) {
      const dx = Math.sign(target.x - o.x);
      const dy = Math.sign(target.y - o.y);
      const frontX = target.x - dx;
      const frontY = target.y - dy;
      if (inb(frontX, frontY) && !unitAt(frontX, frontY)) {
        const elem = document.getElementById(`unit-${o.uid}`);
        if (elem) {
          const cellSize = 68;
          await FX.animateMove(elem, (frontX - o.x) * cellSize, (frontY - o.y) * cellSize, false, o);
        }
        o.x = frontX; o.y = frontY;
        log(`👊 ${uname(o)}가 대상 앞으로 돌격했습니다!`);
      }
    }
  }

  // 3) 어쌔신 적 배후 순간이동 (섀도우 스텝)
  if (c.teleportBehind) {
    const target = unitAt(tx, ty);
    if (target) {
      const behindX = target.x + Math.sign(target.x - o.x);
      const behindY = target.y + Math.sign(target.y - o.y);
      if (inb(behindX, behindY) && !unitAt(behindX, behindY)) {
        const elem = document.getElementById(`unit-${o.uid}`);
        if (elem) {
          const cellSize = 68;
          await FX.animateMove(elem, (behindX - o.x) * cellSize, (behindY - o.y) * cellSize, true, o);
        }
        o.x = behindX; o.y = behindY;
        log(`🗡️ ${uname(o)}가 적의 등 뒤로 그림자 이동했습니다!`);
      }
    }
  }

  const cx = c.target === 'self' ? o.x : tx, cy = c.target === 'self' ? o.y : ty;
  const r = fx.aoe || 0;
  const area = B.units.filter(u => !u.dead && cheb(u, cx, cy) <= r);

  if (r > 0 || c.target === 'tile') {
    FX.shake(5);
    for (let x = cx - r; x <= cx + r; x++) {
      for (let y = cy - r; y <= cy + r; y++) {
        if (inb(x, y)) float(x, y, '', 'aoe');
      }
    }
  }

  for (const u of area) {
    if (u.side === 'e') {
      if (fx.dmg) dealDamage(u, fx.dmg + pw, o);
      if (fx.freeze && B.units.includes(u)) {
        u.frozen = fx.freeze;
        Sound.freeze();
        float(u.x, u.y, '❄️ 빙결', 'frz');
      }
      if (fx.poison && B.units.includes(u)) {
        u.poison = (u.poison || 0) + fx.poison;
        float(u.x, u.y, `🧪 중독 ${u.poison}`, 'dmg');
      }
      // 넉백 연계
      if (c.knockback && !u.dead) {
        await applyKnockback(u, o.x, o.y, c.knockback);
      }
      // 체인 라이트닝 연쇄
      if (fx.chain && !u.dead) {
        const nextE = B.units.find(e => e.side === 'e' && !e.dead && e !== u && cheb(e, u.x, u.y) <= 2);
        if (nextE) {
          dealDamage(nextE, 4, o);
          float(nextE.x, nextE.y, '연쇄 감전 4', 'dmg');
        }
      }
    } else {
      if (fx.heal) {
        const h = Math.min(u.maxHp - u.hp, fx.heal + pw);
        u.hp += h;
        Sound.heal();
        float(u.x, u.y, `+${h}`, 'heal');
      }
      if (fx.shield) {
        u.shield += fx.shield;
        Sound.shield();
        float(u.x, u.y, `🛡+${fx.shield}`, 'blk');
      }
      if (fx.buff) {
        u.buff = (u.buff || 0) + fx.buff;
        Sound.heal();
        float(u.x, u.y, `공격력+${fx.buff}`, 'buff');
      }
      if (c.rally) {
        u.moved = false;
        float(u.x, u.y, '기동 재충전!', 'buff');
        log(`📯 [진격의 호각]으로 ${uname(u)}의 이동 기회가 재충전되었습니다!`);
      }
    }
  }

  // 카드 코스트 반환 (refund)
  if (fx.refund) {
    B.mana = Math.min(10, B.mana + fx.refund);
  }

  } catch (err) {
    console.error('playCard 오류:', err);
  } finally {
    updateAllEnemyIntents();
    renderBattle();
    if (!wasAuto) B.busy = false;
  }
}

// ----- 림버스 컴퍼니 스타일 자동 전투 (승률 딸깍 / 피해량 딸깍) -----
async function autoPlayTurn(mode = 'winrate') {
  if (B.busy || B.over || isAutoRunning) return;
  isAutoRunning = true;
  B.busy = true;
  B.sel = null;
  B.card = null;
  FX.clearTargetingArrow();

  // 이미 수동으로 계획된 지시가 있다면 턴 시작 위치로 롤백 후 자동 지휘 수행
  if (B.turnStartSnapshot && B.planQueue && B.planQueue.length > 0) {
    const snap = B.turnStartSnapshot;
    snap.units.forEach(su => {
      const live = B.units.find(u => u.uid === su.uid);
      if (live) Object.assign(live, { ...su });
    });
    B.mana = snap.mana;
    B.maxMana = snap.maxMana;
    B.hand = [...snap.hand];
    B.discard = [...snap.discard];
    B.deck = [...snap.deck];
    B.planQueue = [];
  }
  B.phase = 'execute';
  renderBattle();

  if (window.ChronosClock) {
    await ChronosClock.playCutscene('flow');
  }

  const modeName = mode === 'winrate' ? '⚖️ 승률 우선' : '⚔️ 피해량 우선';
  await FX.showTurnBanner('전술 자동 지휘', `${modeName} 전투 실행!`, mode === 'winrate' ? '#c59b4c' : '#ef4444');
  await sleep(150);

  // 1단계: 전략 카드 사용
  let playedAnyCard = true;
  while (playedAnyCard && B.mana > 0 && !B.over) {
    playedAnyCard = false;
    const playable = [];
    B.hand.forEach((id, idx) => {
      const c = CARDS[id], oInfo = cardOwner(c);
      if (oInfo) {
        const cost = effectiveCardCost(c, oInfo);
        if (cost <= B.mana) playable.push({ idx, card: c, owner: oInfo.unit, cost });
      }
    });

    if (!playable.length) break;

    let chosenAction = null;
    const livingEnemies = B.units.filter(u => u.side === 'e' && !u.dead);
    const livingAllies = B.units.filter(u => u.side === 'p' && !u.dead);

    if (mode === 'winrate') {
      // 바나나 임시 카드 즉시 사용
      const bananaCard = playable.find(p => p.card.temp);
      if (bananaCard) {
        chosenAction = { idx: bananaCard.idx, x: P.king.x, y: P.king.y };
      }

      // 아군 힐/방어 우선
      if (!chosenAction) {
        const targetAlly = P.king.hp < P.king.maxHp * 0.75 ? P.king : livingAllies.find(a => a.hp < a.maxHp * 0.5);
        if (targetAlly) {
          const supportCard = playable.find(p => p.card.fx.heal || p.card.fx.shield);
          if (supportCard) {
            if (supportCard.card.target === 'self' && supportCard.owner === targetAlly) {
              chosenAction = { idx: supportCard.idx, x: supportCard.owner.x, y: supportCard.owner.y };
            } else if (supportCard.card.target === 'ally') {
              chosenAction = { idx: supportCard.idx, x: targetAlly.x, y: targetAlly.y };
            }
          }
        }
      }

      // 빙결 카드
      if (!chosenAction) {
        const freezeCard = playable.find(p => p.card.fx.freeze);
        if (freezeCard) {
          const threatening = livingEnemies.find(e => e.intent && e.intent.type === 'attack');
          if (threatening) {
            const targets = cardTargets(freezeCard.card, freezeCard.owner);
            const canHit = targets.find(t => t.x === threatening.x && t.y === threatening.y);
            if (canHit) chosenAction = { idx: freezeCard.idx, x: canHit.x, y: canHit.y };
          }
        }
      }

      // 킬각 공격
      if (!chosenAction) {
        for (const p of playable) {
          if (!p.card.fx.dmg) continue;
          const dmg = p.card.fx.dmg;
          const targets = cardTargets(p.card, p.owner);
          const killTarget = targets.find(t => {
            const e = unitAt(t.x, t.y);
            return e && e.side === 'e' && e.hp <= dmg;
          });
          if (killTarget) {
            chosenAction = { idx: p.idx, x: killTarget.x, y: killTarget.y };
            break;
          }
        }
      }
    } else {
      // 피해량 모드: 광역기 > 전직 궁극기 > 단일기
      const ultOrAoe = playable.find(p => p.card.ult || p.card.fx.aoe);
      if (ultOrAoe) {
        const targets = cardTargets(ultOrAoe.card, ultOrAoe.owner);
        if (ultOrAoe.card.target === 'self') {
          chosenAction = { idx: ultOrAoe.idx, x: ultOrAoe.owner.x, y: ultOrAoe.owner.y };
        } else if (targets.length) {
          chosenAction = { idx: ultOrAoe.idx, x: targets[0].x, y: targets[0].y };
        }
      }
    }

    if (!chosenAction) {
      for (const p of playable) {
        const targets = cardTargets(p.card, p.owner);
        if (p.card.target === 'self') {
          chosenAction = { idx: p.idx, x: p.owner.x, y: p.owner.y };
          break;
        } else if (targets.length) {
          chosenAction = { idx: p.idx, x: targets[0].x, y: targets[0].y };
          break;
        }
      }
    }

    if (chosenAction) {
      await playCard(chosenAction.idx, chosenAction.x, chosenAction.y);
      playedAnyCard = true;
      await sleep(220);
    }
  }

  if (B.over) { isAutoRunning = false; return; }

  // 2단계: 아군 기물 공격
  const allies = B.units.filter(u => u.side === 'p' && !u.dead);
  for (const u of allies) {
    if (B.over) break;
    if (u.attacked) continue;
    const targets = attackTargets(u);
    if (!targets.length) continue;

    if (mode === 'winrate') {
      targets.sort((a, b) => {
        const aThreat = a.intent && a.intent.target === P.king ? 1 : 0;
        const bThreat = b.intent && b.intent.target === P.king ? 1 : 0;
        if (bThreat !== aThreat) return bThreat - aThreat;
        const aKill = a.hp <= effAtk(u) ? 1 : 0;
        const bKill = b.hp <= effAtk(u) ? 1 : 0;
        if (bKill !== aKill) return bKill - aKill;
        return a.hp - b.hp;
      });
    } else {
      targets.sort((a, b) => (D(b).boss ? 1 : 0) - (D(a).boss ? 1 : 0) || effAtk(b) - effAtk(a));
    }

    await doAttack(u, targets[0]);
    await sleep(200);
  }

  if (B.over) { isAutoRunning = false; return; }

  // 3단계: 아군 기물 전술 이동 및 2차 공격
  for (const u of allies) {
    if (B.over) break;
    if (u.moved) continue;
    const moves = moveTiles(u);
    if (!moves.length) continue;

    const enemies = B.units.filter(e => e.side === 'e' && !e.dead);
    if (!enemies.length) break;

    let bestMove = null;
    const curX = u.x, curY = u.y;

    if (!u.attacked) {
      for (const m of moves) {
        u.x = m.x; u.y = m.y;
        const canAttack = attackTargets(u).length > 0;
        u.x = curX; u.y = curY;
        if (canAttack) { bestMove = m; break; }
      }
    }

    if (!bestMove) {
      if (mode === 'winrate') {
        let bestDistScore = Infinity;
        for (const m of moves) {
          const minDist = Math.min(...enemies.map(e => Math.abs(e.x - m.x) + Math.abs(e.y - m.y)));
          const score = u.king ? -minDist : Math.abs(minDist - 1.5);
          if (score < bestDistScore) { bestDistScore = score; bestMove = m; }
        }
      } else {
        let minTotalDist = Infinity;
        for (const m of moves) {
          const dist = Math.min(...enemies.map(e => Math.abs(e.x - m.x) + Math.abs(e.y - m.y)));
          if (dist < minTotalDist) { minTotalDist = dist; bestMove = m; }
        }
      }
    }

    if (bestMove && (bestMove.x !== u.x || bestMove.y !== u.y)) {
      await doMove(u, bestMove.x, bestMove.y);
      await sleep(180);

      if (!u.attacked) {
        const afterTargets = attackTargets(u);
        if (afterTargets.length) {
          await doAttack(u, afterTargets[0]);
          await sleep(200);
        }
      }
    }
  }

  isAutoRunning = false;
  B.busy = false;

  // 4단계: 턴 자동 종료
  if (!B.over) {
    await sleep(200);
    endTurn();
  }
}

// ----- 입력 및 타게팅 (시간 정지 플래닝 지시) -----
function onCell(x, y) {
  if (B.busy || B.over || isAutoRunning) return;
  const u = unitAt(x, y);

  if (B.card != null) {
    const c = CARDS[B.hand[B.card]], oInfo = cardOwner(c);
    if (oInfo && cardTargets(c, oInfo.unit).some(t => t.x === x && t.y === y)) {
      if (B.phase === 'plan') {
        planCard(B.card, x, y);
      } else {
        playCard(B.card, x, y);
      }
    } else {
      B.card = null;
      FX.clearTargetingArrow();
      renderBattle();
    }
    return;
  }

  const s = B.sel;
  if (s && s.side === 'p') {
    if (!s.moved && moveTiles(s).some(t => t.x === x && t.y === y)) {
      if (B.phase === 'plan') {
        planMove(s, x, y);
      } else {
        doMove(s, x, y);
      }
      return;
    }
    if (!s.attacked && u && u.side === 'e' && attackTargets(s).includes(u)) {
      if (B.phase === 'plan') {
        planAttack(s, u);
      } else {
        doAttack(s, u);
      }
      return;
    }
  }

  B.sel = u || null;
  Sound.click();
  renderBattle();
}

function onCard(i) {
  if (B.busy || B.over || isAutoRunning) return;
  const c = CARDS[B.hand[i]], oInfo = cardOwner(c);
  if (!oInfo) return;

  const cost = effectiveCardCost(c, oInfo);
  if (cost > B.mana) return;

  if (B.card === i) {
    B.card = null;
    FX.clearTargetingArrow();
    return renderBattle();
  }

  if (c.target === 'self') {
    if (B.phase === 'plan') {
      planCard(i, oInfo.unit.x, oInfo.unit.y);
    } else {
      playCard(i, oInfo.unit.x, oInfo.unit.y);
    }
    B.sel = oInfo.unit;
    return;
  }

  B.card = i;
  B.sel = oInfo.unit;
  Sound.cardHover();
  renderBattle();
}

document.addEventListener('mousemove', e => {
  if (!B || B.card == null || isAutoRunning) return;
  const cardElems = document.querySelectorAll('.card');
  const cardElem = cardElems[B.card];
  if (cardElem) {
    FX.drawTargetingArrow(cardElem, e.clientX, e.clientY);
  }
});

// ----- 적 턴 진행 (중독 데미지 등 처리) -----
async function endTurn() {
  if (B.busy || B.over) return;
  B.busy = true;
  B.sel = null;
  B.card = null;
  FX.clearTargetingArrow();
  renderBattle();

  try {
    // 턴 종료 시 중독(Poison) 피해 발동
    const poisoned = B.units.filter(u => u.side === 'e' && !u.dead && u.poison > 0);
    for (const pe of poisoned) {
      const pDmg = pe.poison * 2;
      log(`🧪 ${uname(pe)}가 중독으로 ${pDmg} 피해를 입었습니다!`);
      float(pe.x, pe.y, `중독 -${pDmg}`, 'dmg');
      dealDamage(pe, pDmg);
      pe.poison--;
      await sleep(200);
    }

    if (B.over) return;

    const enemyStatusTag = document.getElementById('clock-status-tag');
    const enemyStatusSub = document.getElementById('clock-status-sub');
    if (enemyStatusTag) {
      enemyStatusTag.className = 'clock-status-tag time-enemy';
      enemyStatusTag.textContent = '⚔️ 적의 진격';
    }
    if (enemyStatusSub) enemyStatusSub.textContent = '몬스터 턴 진행 중...';

    Sound.turnStart(false);
    await FX.showTurnBanner('적의 턴', '몬스터들이 진격합니다!', '#e04545');
    await sleep(250);

    // 보스 소환 체크
    const bossSummon = B.units.find(u => u.side === 'e' && !u.dead && D(u).summon);
    if (bossSummon) {
      const s = D(bossSummon).summon;
      if (B.turn % s.every === 0) {
        spawnEnemies(Array(s.n).fill(s.id));
        log('😈 마왕 발록이 지옥의 하수인을 소환했습니다!');
        Sound.slash();
        FX.shake(6);
        renderBattle();
        await sleep(400);
      }
    }

    const king = P.king;
    const order = B.units
      .filter(u => u.side === 'e' && !u.dead)
      .sort((a, b) => (Math.abs(a.x - king.x) + Math.abs(a.y - king.y)) - (Math.abs(b.x - king.x) + Math.abs(b.y - king.y)));

    for (const e of order) {
      if (B.over) return;
      if (!B.units.includes(e) || e.dead) continue;

      if (e.frozen > 0) {
        e.frozen--;
        float(e.x, e.y, '❄️ 빙결 해제', 'frz');
        renderBattle();
        await sleep(250);
        continue;
      }

      await enemyAct(e);
    }
  } catch (err) {
    console.error('적 턴 진행 중 오류 발생:', err);
  } finally {
    if (!B.over) {
      newPlayerTurn();
    } else {
      B.busy = false;
    }
  }
}

async function enemyAct(e) {
  const tryAttack = async () => {
    const ts = attackTargets(e);
    if (!ts.length) return false;
    ts.sort((a, b) => (b.king ? 1 : 0) - (a.king ? 1 : 0) || a.hp - b.hp);
    const target = ts[0];
    const elemE = document.getElementById(`unit-${e.uid}`);
    const elemT = document.getElementById(`unit-${target.uid}`);
    if (elemE && elemT) {
      await FX.animateAttack(elemE, elemT, e, target);
    } else {
      Sound.slash();
    }
    log(`⚔️ ${uname(e)} → ${uname(target)} (${effAtk(e)} 피해)`);
    dealDamage(target, effAtk(e), e);
    renderBattle();
    await sleep(350);
    return true;
  };

  if (await tryAttack()) return;

  const opts = moveTiles(e);
  if (!opts.length) return;

  const players = B.units.filter(u => u.side === 'p' && !u.dead), king = P.king;
  const ox = e.x, oy = e.y;
  const dist = (x, y, u) => Math.abs(x - u.x) + Math.abs(y - u.y);
  const cur = Math.min(...players.map(p => dist(ox, oy, p)));

  let best = null, bs = Infinity;
  for (const t of opts) {
    e.x = t.x; e.y = t.y;
    let sc = Math.min(...players.map(p => dist(t.x, t.y, p))) + 0.4 * dist(t.x, t.y, king) + Math.random() * 0.5;
    if (attackTargets(e).length) sc -= 100;
    if (sc < bs) { bs = sc; best = t; }
  }
  e.x = ox; e.y = oy;

  const newDist = Math.min(...players.map(p => dist(best.x, best.y, p)));
  if (bs < -50 || newDist < cur) {
    const elem = document.getElementById(`unit-${e.uid}`);
    const isKnight = pat(e, 'move').dirs === 'knight';
    if (elem) {
      const cellSize = 68;
      const dx = (best.x - e.x) * cellSize;
      const dy = (best.y - e.y) * cellSize;
      Sound.chessMove(isKnight);
      await FX.animateMove(elem, dx, dy, isKnight, e);
    }
    e.x = best.x;
    e.y = best.y;
    renderBattle();
    await sleep(200);
    await tryAttack();
  }
}

// ----- 렌더링 UI -----
function buildBattleUI() {
  const sz = B ? B.size : 6;
  const isBoss = B ? B.isBoss : false;
  const theme = (B && B.theme) || 'henesys';
  const regionName = (B && B.regionName) || '헤네시스';
  const regionIcon = (B && B.regionIcon) || '🌿';
  const floorName = (B && B.floorName) || 'STAGE 1';
  const lore = (B && B.lore) || '';
  const ranks = sz === 8 ? [8,7,6,5,4,3,2,1] : [6,5,4,3,2,1];
  const files = sz === 8 ? ['A','B','C','D','E','F','G','H'] : ['A','B','C','D','E','F'];

  document.getElementById('app').innerHTML = `
  <div class="battle stage-theme-${theme} ${isBoss ? 'boss-battle' : 'normal-battle'}">
    <!-- 무대 환경 배경 & 원경 태엽 실루엣 레이어 -->
    <div class="stage-scenery-backdrop" aria-hidden="true">
      <div class="scenery-gear gear-bg-large"></div>
      <div class="scenery-gear gear-bg-small"></div>
      <div class="scenery-particles"></div>
    </div>

    <div class="left">
      <div class="enc-header">
        <div class="enc-title-group">
          <div class="enc-badges">
            <span class="region-pill"><i class="region-ico">${regionIcon}</i> ${regionName}</span>
            <span class="floor-pill">${floorName}</span>
          </div>
          <div class="enc-name-row">
            <span class="enc-name" id="encname"></span>
          </div>
          ${lore ? `<div class="enc-lore" id="enclore">${lore}</div>` : ''}
        </div>
        <div class="header-controls">
          <span class="board-size-badge" title="전장 규격: ${sz}×${sz}">${sz}×${sz}</span>
          <button id="speed-btn" class="ctrl-btn" onclick="toggleSpeed()" title="배속 변경 (단축키 1, 2, 3)">⚡ ${GameSpeed.toFixed(1)}x</button>
          <button class="ctrl-btn sound-btn" onclick="toggleMuteBtn(this)">🔊</button>
        </div>
      </div>
      <div class="board-frame ${isBoss ? 'expanded-frame' : ''}">
        <!-- 4방향 크로노스 황동 코너 기어 브래킷 장식 -->
        <div class="board-corner corner-tl" aria-hidden="true"></div>
        <div class="board-corner corner-tr" aria-hidden="true"></div>
        <div class="board-corner corner-bl" aria-hidden="true"></div>
        <div class="board-corner corner-br" aria-hidden="true"></div>
        <div class="board-ranks">${ranks.map(r => `<span>${r}</span>`).join('')}</div>
        <div id="board" style="--b-size:${sz};"></div>
        <div class="board-files">${files.map(f => `<span>${f}</span>`).join('')}</div>
      </div>
      <div class="hand-container">
        <div id="hand"></div>
      </div>
    </div>
    <div class="right">
      <div class="turn-phase-box">
        <span class="clock-status-tag time-stopped" id="clock-status-tag">⏳ 시간 정지</span>
        <span class="clock-status-sub" id="clock-status-sub">인과율 지시 단계</span>
      </div>

      <div id="mana" class="mana-panel"></div>

      <div class="plan-queue-panel">
        <div class="plan-queue-title">
          <span>인과율 계획 (지시 큐)</span>
          <span id="plan-queue-count">0건</span>
        </div>
        <div id="plan-queue-items" class="plan-queue-items">
          <div class="plan-empty-tip">행동을 지시하십시오 (이동, 공격, 카드)</div>
        </div>
      </div>

      <div class="time-btn-group">
        <button id="btn-execute" class="btn btn-time-execute" onclick="executeTimeline()">
          <span class="btn-text">⏳ 시간 시작</span>
          <span class="btn-sub">차례차례 실행 (Space)</span>
        </button>
        <button id="btn-rewind" class="btn btn-time-rewind" onclick="rewindTurn()">
          <span class="btn-text">⏪ 수 무르기</span>
          <span class="btn-sub">시간 역행 (단축키 Z)</span>
        </button>
      </div>
      
      <div class="auto-panel">
        <div class="auto-panel-label">전술 자동 지휘 (딸깍)</div>
        <div class="auto-btn-row">
          <button id="btn-winrate" class="btn auto-btn winrate-btn" onclick="autoPlayTurn('winrate')" title="승률 우선: 킹 보호, 힐, 빙결, 킬각 (단축키 P)">
            <span class="auto-ico">⚖️</span>
            <span class="auto-txt">승률</span>
            <span class="key-hint">[P]</span>
          </button>
          <button id="btn-damage" class="btn auto-btn damage-btn" onclick="autoPlayTurn('damage')" title="피해량 우선: 광역 폭격, 돌격, 집중 사격 (단축키 D)">
            <span class="auto-ico">⚔️</span>
            <span class="auto-txt">피해량</span>
            <span class="key-hint">[D]</span>
          </button>
        </div>
      </div>

      <div id="info" class="panel info-panel"></div>
      <div id="log" class="panel log-panel"></div>
    </div>
  </div>`;

  document.getElementById('board').addEventListener('click', e => {
    const c = e.target.closest('.cell');
    if (c) onCell(+c.dataset.x, +c.dataset.y);
  });

  document.getElementById('board').addEventListener('contextmenu', e => {
    e.preventDefault();
    B.card = null;
    B.sel = null;
    FX.clearTargetingArrow();
    renderBattle();
  });

  if (window.ChronosClock) {
    ChronosClock.init();
  }
}

function toggleMuteBtn(btn) {
  const muted = Sound.toggleMute();
  btn.textContent = muted ? '🔇' : '🔊';
}

function renderBattle() {
  if (!B || !document.getElementById('board')) return;
  const hl = {};
  const mark = (x, y, k) => { hl[x + ',' + y] = k; };
  const s = B.sel;

  if (B.card != null) {
    const c = CARDS[B.hand[B.card]], oInfo = cardOwner(c);
    if (oInfo) cardTargets(c, oInfo.unit).forEach(t => mark(t.x, t.y, 'h-card'));
  } else if (s && B.units.includes(s) && !s.dead) {
    if (s.side === 'p') {
      if (!s.moved) moveTiles(s).forEach(t => mark(t.x, t.y, 'h-move'));
      if (!s.attacked) attackTargets(s).forEach(t => mark(t.x, t.y, 'h-atk'));
    } else {
      moveTiles(s).forEach(t => mark(t.x, t.y, 'h-emove'));
      attackTargets(s).forEach(t => mark(t.x, t.y, 'h-eatk'));
    }
  }

  const sz = B.size || 6;
  let html = '';
  for (let y = 0; y < sz; y++) {
    for (let x = 0; x < sz; x++) {
      const u = unitAt(x, y), k = hl[x + ',' + y] || '';
      let inner = '';
      if (u) {
        const done = u.side === 'p' && u.moved && u.attacked;
        const clData = u.side === 'p' && !u.king ? CLASS_BY[u.cid] : null;
        const themeColor = clData ? clData.theme : (u.king ? '#d4af37' : '#992222');

        let intentHtml = '';
        if (u.side === 'e' && u.intent) {
          intentHtml = `
            <div class="intent-badge intent-${u.intent.type}" title="${u.intent.desc}">
              <span class="intent-icon">${u.intent.icon}</span>
              ${u.intent.val ? `<span class="intent-val">${u.intent.val}</span>` : ''}
              ${u.intent.text ? `<span class="intent-text">${u.intent.text}</span>` : ''}
            </div>
          `;
        }

        // 상태이상 / 패시브 스택 배지
        let buffBadges = '';
        if (u.poison > 0) buffBadges += `<span class="u-badge poison-b" title="중독 ${u.poison}스택">🧪${u.poison}</span>`;
        if (u.energyStack > 0) buffBadges += `<span class="u-badge energy-b" title="기력 ${u.energyStack}스택">💥${u.energyStack}</span>`;

        // 데우스 엑스 마키나 : 인과율 계획 순번 및 조준 배지
        let planBadgeHtml = '';
        if (B.planQueue && B.planQueue.length > 0) {
          const allySteps = [];
          B.planQueue.forEach((act, idx) => {
            if (act.uid === u.uid || act.ownerUid === u.uid) {
              allySteps.push(idx + 1);
            }
          });
          if (allySteps.length > 0) {
            planBadgeHtml += `<div class="plan-badge" title="인과율 지시 순번: ${allySteps.join(', ')}">${allySteps[0]}</div>`;
          }

          const targetSteps = [];
          B.planQueue.forEach((act, idx) => {
            if (act.targetUid === u.uid || (act.type === 'card' && act.tx === u.x && act.ty === u.y && u.side === 'e')) {
              targetSteps.push(idx + 1);
            }
          });
          if (targetSteps.length > 0) {
            planBadgeHtml += `<div class="plan-badge target-badge" title="피격 예정 순번: ${targetSteps.join(', ')}">⚔️${targetSteps[0]}</div>`;
          }
        }

        inner = `
          <div id="unit-${u.uid}" class="unit ${u.side} ${u.king ? 'king' : ''} ${u === s ? 'sel' : ''} ${done ? 'done' : ''} ${u.frozen > 0 ? 'frozen' : ''} ${D(u).boss ? 'boss' : ''}" style="--unit-color:${themeColor}">
            ${planBadgeHtml}
            ${intentHtml}
            ${buffBadges ? `<div class="unit-badges-wrap">${buffBadges}</div>` : ''}
            <div class="unit-inner">
              ${u.side === 'p' && !u.king && u.cid ? `
                <div class="unit-tile-face-wrap">
                  <img class="unit-tile-face-img" src="images/units/${u.cid}.png" alt="" onerror="this.parentElement.style.display='none'; this.parentElement.nextElementSibling.style.display='inline-block';" onload="this.parentElement.nextElementSibling.style.display='none';" />
                </div>
                <span class="ico fallback-ico">${uicon(u)}</span>
              ` : `
                <span class="ico">${uicon(u)}</span>
              `}
              ${u.side === 'p' && !u.king ? `<span class="lv-badge">${u.promoted ? '★' : ''}${u.level}</span>` : ''}
              <div class="hpbar-wrap">
                <div class="hpbar"><i style="width:${Math.max(0, u.hp / u.maxHp * 100)}%"></i></div>
              </div>
              <div class="stat-pills">
                <span class="stat-hp">❤️ ${u.hp}${u.shield ? `<b class="stat-shield">+${u.shield}</b>` : ''}</span>
                <span class="stat-atk">⚔️ ${effAtk(u)}</span>
              </div>
              ${u.side === 'p' ? `<span class="pips">${u.moved ? '' : '👣'}${u.attacked ? '' : '⚔️'}</span>` : ''}
            </div>
          </div>`;
      }
      html += `<div class="cell ${(x + y) % 2 ? 'dark' : 'light'} ${k}" data-x="${x}" data-y="${y}">${inner}</div>`;
    }
  }

  const board = document.getElementById('board');
  board.style.setProperty('--b-size', sz);
  board.innerHTML = html;

  for (const f of B.floats) {
    const cell = board.children[f.y * sz + f.x];
    if (cell) {
      const d = document.createElement('div');
      d.className = 'float ' + f.cls;
      d.textContent = f.txt;
      cell.appendChild(d);
    }
  }
  B.floats = [];

  document.getElementById('encname').innerHTML = `
    <b>${B.enc.name}</b> <span class="dim-gold">· 턴 ${B.turn}</span>
    ${B.waveIdx < B.enc.waves.length ? `<span class="wave-tag">웨이브까지 ${Math.max(0, B.enc.waves[B.waveIdx].turn - B.turn)}턴</span>` : '<span class="wave-tag final">마지막 웨이브</span>'}
  `;

  document.getElementById('mana').innerHTML = `
    <div class="mana-header">
      <span class="mana-title">에너지</span>
      <span class="mana-count">${B.mana} / ${B.maxMana}</span>
    </div>
    <div class="crystals">
      ${Array.from({ length: 10 }, (_, i) => {
        if (i < B.mana) return '<i class="gem active"></i>';
        if (i < B.maxMana) return '<i class="gem empty"></i>';
        return '<i class="gem locked"></i>';
      }).join('')}
    </div>
    <div class="deck-counter">
      <span>📚 덱: <b>${B.deck.length}</b></span>
      <span>🗑️ 버림: <b>${B.discard.length}</b></span>
    </div>
  `;

  const totalCards = B.hand.length;
  document.getElementById('hand').innerHTML = B.hand.map((id, i) => {
    const c = CARDS[id], oInfo = cardOwner(c), d = CLASS_BY[c.cls];
    const cost = effectiveCardCost(c, oInfo);
    const off = !oInfo || cost > B.mana;
    const mid = (totalCards - 1) / 2;
    const offset = i - mid;
    const rot = offset * 4.5;
    const transY = Math.abs(offset) * 6;

    let ownerBadge = '';
    if (!oInfo) {
      ownerBadge = '<span class="dead-txt">전투불능</span>';
    } else if (oInfo.isKingProxy) {
      ownerBadge = '<span class="proxy-txt">👑 킹 대리 (+1C)</span>';
    } else {
      ownerBadge = uname(oInfo.unit);
    }

    return `
      <div class="card ${off ? 'off' : ''} ${B.card === i ? 'picked' : ''} ${c.ult ? 'ult-card' : ''}" 
           style="--rot:${rot}deg; --ty:${transY}px; --theme:${d ? d.theme : '#c59b4c'}" 
           onclick="onCard(${i})" 
           onmouseenter="Sound.cardHover()"
           title="${c.desc}">
        ${c.cls && c.cls !== 'common' ? `<div class="card-bg" style="background-image: url('images/units/${c.cls}.png');"></div>` : ''}
        <div class="card-cost-gem">${cost}</div>
        <div class="card-type-ribbon ${c.type || 'attack'}">${c.ult ? '궁극기' : (c.type === 'skill' ? '스킬' : '공격')}</div>
        <div class="card-art-box">
          ${c.cls && c.cls !== 'common' ? `
            <img class="card-art-img" src="images/units/${c.cls}.png" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';" onload="this.nextElementSibling.style.display='none';" />
          ` : ''}
          <span class="card-icon">${d ? d.icon : '✨'}</span>
        </div>
        <div class="card-title">${c.name}</div>
        <div class="card-desc">${c.desc}</div>
        <div class="card-owner-badge" style="color:${d ? d.theme : '#ffd56b'}">
          ${ownerBadge}
        </div>
      </div>`;
  }).join('');

  const info = document.getElementById('info');
  if (info) {
    if (s && B.units.includes(s) && !s.dead) {
      info.style.display = 'block';
      const d = D(s);
      info.innerHTML = `
        <div class="info-header">
          ${s.side === 'p' && !s.king && s.cid ? `
            <div class="info-portrait">
              <img class="unit-tile-face-img" src="images/units/${s.cid}.png" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';" onload="this.nextElementSibling.style.display='none';" />
              <span class="info-ico fallback-ico">${uicon(s)}</span>
            </div>
          ` : `
            <span class="info-ico">${uicon(s)}</span>
          `}
          <div>
            <div class="info-title">${uname(s)} ${s.side === 'p' && !s.king ? `<span class="tag-gold">Lv.${s.level}${s.promoted ? ' ★전직' : ''}</span>` : ''}</div>
            <div class="info-side">${s.side === 'p' ? '아군 기물' : '적 몬스터'}</div>
          </div>
        </div>
        <div class="info-stats">
          <div><b>생명력</b>: ${s.hp} / ${s.maxHp} ${s.shield ? `<span class="gold-txt">(+🛡️${s.shield})</span>` : ''}</div>
          <div><b>공격력</b>: ${effAtk(s)} ${s.buff ? `<span class="gold-txt">(+${s.buff})</span>` : ''} ${s.energyStack ? `<span class="gold-txt">(기력+${s.energyStack})</span>` : ''}</div>
        </div>
        ${s.side === 'p' && !s.king && d.passive ? `
          <div class="passive-info-box">
            <b>고유 패시브 [${d.passive.name}]</b>: ${d.passive.desc}
          </div>` : ''}
        ${s.promoted && d.promo && d.promo.chessDesc ? `
          <div class="promo-info-box">
            <b>체스 진화</b>: ${d.promo.chessDesc}
          </div>` : ''}
        ${s.side === 'p' && !s.king ? `
          <div class="xp-bar-wrap">
            <div class="xp-label"><span>경험치</span><span>${s.level >= MAXLV ? 'MAX' : `${s.xp} / ${need(s.level)}`}</span></div>
            <div class="xp-bar"><i style="width:${s.level >= MAXLV ? 100 : (s.xp / need(s.level) * 100)}%"></i></div>
          </div>` : ''}
        ${s.side === 'p' && !s.king ? `
          <div class="lock-assign-box" style="margin-top:8px;">
            <button class="btn lock-assign-btn ${P.lockedUnitCid === s.cid ? 'is-current-locked' : ''}" onclick="setLockedUnit('${s.cid}')" style="width:100%; font-size:11px; padding:5px 8px;">
              ${P.lockedUnitCid === s.cid ? '★ 다음 턴 확정 출진 중' : '🌟 이 영웅을 다음 턴 확정 출진으로 지정'}
            </button>
          </div>` : ''}
        <div class="info-patterns">
          <div><b>이동</b>: ${descPat(pat(s, 'move'))}</div>
          <div><b>공격</b>: ${descPat(pat(s, 'atk'))}</div>
        </div>
        ${s.side === 'e' && s.intent ? `<div class="intent-info-box"><b>다음 행동(Intent)</b>: ${s.intent.desc}</div>` : ''}
      `;
    } else {
      info.style.display = 'none';
      info.innerHTML = '';
    }
  }

  document.getElementById('log').innerHTML = B.log.map(l => `<div class="log-item">${l}</div>`).join('');

  // 인과율 계획 큐 UI 갱신
  const queueItemsEl = document.getElementById('plan-queue-items');
  const queueCountEl = document.getElementById('plan-queue-count');
  if (queueItemsEl && queueCountEl) {
    const q = B.planQueue || [];
    queueCountEl.textContent = `${q.length}건`;
    if (q.length === 0) {
      queueItemsEl.innerHTML = `<div class="plan-empty-tip">${B.phase === 'plan' ? '체스말 이동/공격 또는 카드를 등록하십시오' : '인과율 실행 중...'}</div>`;
    } else {
      queueItemsEl.innerHTML = q.map((act, idx) => `
        <div class="plan-item">
          <span class="plan-step-num">${idx + 1}</span>
          <span class="plan-item-desc">${act.desc}</span>
          ${act.cost ? `<span class="plan-item-cost" style="margin-left:auto; color:#f6c344; font-weight:bold;">-${act.cost}C</span>` : ''}
        </div>
      `).join('');
    }
  }

  // 데우스 엑스 마키나 버튼 상태 갱신
  const btnExec = document.getElementById('btn-execute');
  const btnRewind = document.getElementById('btn-rewind');
  const isPlanPhase = B.phase === 'plan';

  if (btnExec) {
    btnExec.disabled = B.busy || B.over || isAutoRunning || !isPlanPhase;
  }
  if (btnRewind) {
    btnRewind.disabled = B.busy || B.over || isAutoRunning || !isPlanPhase || !B.planQueue || B.planQueue.length === 0;
  }

  const endTurnBtn = document.getElementById('endturn');
  if (endTurnBtn) endTurnBtn.disabled = B.busy || B.over || isAutoRunning;

  const btnWin = document.getElementById('btn-winrate');
  const btnDmg = document.getElementById('btn-damage');
  if (btnWin) btnWin.disabled = B.busy || B.over || isAutoRunning;
  if (btnDmg) btnDmg.disabled = B.busy || B.over || isAutoRunning;
}

// 키보드 단축키
document.addEventListener('keydown', e => {
  if (!B || B.over) return;

  if (e.key === 'Escape') {
    B.card = null;
    B.sel = null;
    FX.clearTargetingArrow();
    renderBattle();
  } else if (e.code === 'Space' && !B.busy && !isAutoRunning) {
    e.preventDefault();
    if (B.phase === 'plan') {
      executeTimeline();
    } else {
      endTurn();
    }
  } else if ((e.key === 'z' || e.key === 'Z' || e.key === 'ㅋ') && !B.busy && !isAutoRunning) {
    e.preventDefault();
    if (B.phase === 'plan') {
      rewindTurn();
    }
  } else if ((e.key === 'p' || e.key === 'P' || e.key === 'ㅔ') && !B.busy && !isAutoRunning) {
    e.preventDefault();
    autoPlayTurn('winrate');
  } else if ((e.key === 'd' || e.key === 'D' || e.key === 'ㅇ') && !B.busy && !isAutoRunning) {
    e.preventDefault();
    autoPlayTurn('damage');
  } else if (e.key === '1') {
    setSpeed(1.0);
  } else if (e.key === '2') {
    setSpeed(2.0);
  } else if (e.key === '3') {
    setSpeed(3.0);
  }
});
