// ===== 게임 데이터 : 메이플 직업 패시브, 전직 궁극기, 체스 진화 =====
const BOARD = 8;
const MAXLV = 6;
const PROMO_LV = 3;
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// 카드 데이터: target = enemy | ally | tile | self
// dash = 돌진, knockback = 넉백, retreat = 후퇴, teleport = 순간이동
const CARDS = {
  // 전사 (히어로)
  w1: { cls: 'warrior', type: 'attack', name: '파워 스트라이크', cost: 2, target: 'enemy', range: 1, knockback: 1, fx: { dmg: 5 }, desc: '적에게 5 피해를 가하고 뒤로 1칸 밀쳐냅니다(넉백).' },
  w2: { cls: 'warrior', type: 'skill', name: '아이언 바디', cost: 1, target: 'self', range: 0, fx: { shield: 5 }, desc: '단단한 방패를 들어 방어도 5를 획득합니다.' },
  w3: { cls: 'warrior', type: 'attack', name: '슬래시 블러스트', cost: 3, target: 'self', range: 0, fx: { dmg: 4, aoe: 1 }, desc: '검을 회전시켜 주변 8칸의 모든 적에게 4 광역 피해를 가합니다.' },
  w_ult: { cls: 'warrior', type: 'attack', name: '레이징 블로우', cost: 3, target: 'enemy', range: 2, knockback: 2, fx: { dmg: 8 }, ult: true, desc: '★전직 궁극기: 거대 검기로 8의 치명상을 입히고 2칸 밀쳐냅니다.' },

  // 불독 마법사 (아크메이지)
  f1: { cls: 'fire', type: 'attack', name: '플레임 오브', cost: 1, target: 'enemy', range: 3, fx: { dmg: 3, poison: 1 }, desc: '사거리 3 적에게 3 화염 피해를 주고 중독 1스택을 부여합니다.' },
  f2: { cls: 'fire', type: 'attack', name: '익스플로전', cost: 3, target: 'tile', range: 4, fx: { dmg: 4, aoe: 1, poison: 1 }, desc: '지정 3x3 범위에 4 폭발 피해와 중독을 겁니다.' },
  f3: { cls: 'fire', type: 'attack', name: '메테오', cost: 4, target: 'tile', range: 5, fx: { dmg: 6, aoe: 2, poison: 2 }, desc: '운석을 낙하시켜 5x5 범위에 6 피해와 중독 2스택을 폭격합니다.' },
  f_ult: { cls: 'fire', type: 'attack', name: '포이즌 노바', cost: 3, target: 'self', range: 0, fx: { dmg: 5, aoe: 3, poison: 3 }, ult: true, desc: '★전직 궁극기: 독성 구체를 방출하여 7x7 전장의 모든 적에게 5 피해 + 중독 3스택!' },

  // 썬콜 마법사 (아크메이지)
  i1: { cls: 'ice', type: 'attack', name: '콜드 빔', cost: 1, target: 'enemy', range: 3, line: true, fx: { dmg: 2, freeze: 1 }, desc: '직선 3칸 적에게 2 피해 + 1턴간 빙결(행동 불가)시킵니다.' },
  i2: { cls: 'ice', type: 'attack', name: '아이스 스트라이크', cost: 2, target: 'tile', range: 4, fx: { dmg: 3, aoe: 1, freeze: 1 }, desc: '3x3 지점에 3 피해를 주고 모든 적을 1턴간 빙결시킵니다.' },
  i3: { cls: 'ice', type: 'attack', name: '블리자드', cost: 4, target: 'tile', range: 5, fx: { dmg: 4, aoe: 2, freeze: 1 }, desc: '5x5 전장에 한파를 소환하여 4 피해와 함께 전원 빙결시킵니다.' },
  i_ult: { cls: 'ice', type: 'attack', name: '체인 라이트닝', cost: 3, target: 'enemy', range: 4, fx: { dmg: 7, chain: 2 }, ult: true, desc: '★전직 궁극기: 7의 뇌전 피해를 주고 주변 적 2체에게 4 피해로 연쇄 감전!' },

  // 클레릭 (비숍)
  c1: { cls: 'cleric', type: 'skill', name: '힐', cost: 1, target: 'ally', range: 3, fx: { heal: 4 }, desc: '사거리 3 아군의 체력을 4 회복시킵니다.' },
  c2: { cls: 'cleric', type: 'skill', name: '블레스', cost: 2, target: 'ally', range: 3, fx: { buff: 1, shield: 4 }, desc: '아군에게 방어도 4를 부여하고 공격력을 영구 1 증가시킵니다.' },
  c3: { cls: 'cleric', type: 'skill', name: '홀리 심볼', cost: 3, target: 'self', range: 0, fx: { heal: 3, shield: 3, aoe: 2 }, desc: '주변 5x5 범위 아군 전원 체력 3 회복 및 방어도 3을 부여합니다.' },
  c_ult: { cls: 'cleric', type: 'attack', name: '제네시스', cost: 4, target: 'self', range: 0, fx: { dmg: 6, heal: 4, aoe: 4 }, ult: true, desc: '★전직 궁극기: 성스러운 빛의 기둥으로 모든 적에게 6 피해, 모든 아군 4 회복!' },

  // 헌터 (보우마스터)
  a1: { cls: 'archer', type: 'attack', name: '더블 샷', cost: 1, target: 'enemy', range: 4, line: true, fx: { dmg: 3 }, desc: '직선 4칸 적에게 2연속 화살로 3 피해를 입힙니다.' },
  a2: { cls: 'archer', type: 'attack', name: '애로우 블로우', cost: 2, target: 'enemy', range: 5, line: true, retreat: 1, fx: { dmg: 5 }, desc: '뒤로 1칸 도약(후퇴)하며 적에게 5의 치명적인 저격을 가합니다.' },
  a3: { cls: 'archer', type: 'attack', name: '애로우 레인', cost: 3, target: 'tile', range: 5, fx: { dmg: 4, aoe: 1 }, desc: '지정 3x3 범위에 화살비를 쏟아부어 4의 피해를 입힙니다.' },
  a_ult: { cls: 'archer', type: 'attack', name: '폭풍의 시', cost: 3, target: 'enemy', range: 6, line: true, fx: { dmg: 8 }, ult: true, desc: '★전직 궁극기: 6칸 직선상의 적을 꿰뚫는 기관총 사격으로 8 피해를 입힙니다.' },

  // 어쌔신 (나이트로드)
  t1: { cls: 'thief', type: 'attack', name: '새비지 블로우', cost: 2, target: 'enemy', range: 1, fx: { dmg: 7 }, desc: '인접한 적에게 급소를 6연타하여 7의 암살 피해를 입힙니다.' },
  t2: { cls: 'thief', type: 'attack', name: '섀도우 스텝', cost: 1, target: 'enemy', range: 3, teleportBehind: true, fx: { dmg: 4 }, desc: '적의 등 뒤 칸으로 그림자 이동하며 4의 기습 피해를 입힙니다.' },
  t3: { cls: 'thief', type: 'attack', name: '럭키 세븐', cost: 2, target: 'enemy', range: 3, fx: { dmg: 5 }, desc: '행운의 표창 2개를 던져 5의 피해를 입힙니다.' },
  t_ult: { cls: 'thief', type: 'skill', name: '섀도우 파트너', cost: 2, target: 'self', range: 0, fx: { shadowPartner: 1, buff: 2 }, ult: true, desc: '★전직 궁극기: 분신을 소환하여 공격력 +2 및 이번 턴 공격 시 추가 분신 공격!' },

  // 건슬링거 (캡틴)
  g1: { cls: 'gunner', type: 'attack', name: '퀵 드로우', cost: 1, target: 'enemy', range: 2, fx: { dmg: 3, refund: 1 }, desc: '재빠른 사격으로 3 피해를 주고 코스트 1을 페이백 받습니다.' },
  g2: { cls: 'gunner', type: 'attack', name: '더블 파이어', cost: 2, target: 'enemy', range: 4, line: true, fx: { dmg: 6 }, desc: '직선 4칸 적에게 권총을 난사하여 6 피해를 입힙니다.' },
  g3: { cls: 'gunner', type: 'attack', name: '그레네이드', cost: 3, target: 'tile', range: 3, fx: { dmg: 4, aoe: 1 }, desc: '유탄을 투척하여 3x3 범위에 4 폭발 피해를 입힙니다.' },
  g_ult: { cls: 'gunner', type: 'attack', name: '배틀쉽 봄버', cost: 3, target: 'tile', range: 4, fx: { dmg: 8, aoe: 1 }, ult: true, desc: '★전직 궁극기: 전함 포격으로 지정 3x3에 8의 무자비한 집중 포화를 퍼붓습니다.' },

  // 스피어맨 (드래곤나이트)
  s1: { cls: 'spear', type: 'attack', name: '파이널 어택', cost: 2, target: 'enemy', range: 2, line: true, knockback: 1, fx: { dmg: 5 }, desc: '직선 2칸 적을 창으로 꿰뚫어 5 피해 + 뒤로 1칸 밀쳐냅니다.' },
  s2: { cls: 'spear', type: 'skill', name: '아이언 월', cost: 1, target: 'ally', range: 2, fx: { shield: 4, buff: 1 }, desc: '아군에게 방어도 4와 공격력 +1을 부여합니다.' },
  s3: { cls: 'spear', type: 'attack', name: '드래곤 로어', cost: 3, target: 'self', range: 0, fx: { dmg: 4, aoe: 2 }, desc: '용의 포효를 내질러 5x5 범위의 모든 적에게 4 피해를 입힙니다.' },
  s_ult: { cls: 'spear', type: 'attack', name: '다크 임페일', cost: 3, target: 'enemy', range: 3, line: true, pierceLine: true, fx: { dmg: 8 }, ult: true, desc: '★전직 궁극기: 암흑창으로 일렬 3칸의 모든 적을 일격 관통하며 8 피해!' },

  // 인파이터 (바이퍼)
  b1: { cls: 'brawler', type: 'attack', name: '더블 임팩트', cost: 1, target: 'enemy', range: 2, dash: true, knockback: 1, fx: { dmg: 4 }, desc: '적에게 2칸 돌진하여 4 피해를 가하고 뒤로 1칸 밀쳐냅니다.' },
  b2: { cls: 'brawler', type: 'skill', name: '에너지 차지', cost: 1, target: 'self', range: 0, fx: { shield: 3, charge: 1 }, desc: '기를 모아 방어도 3을 획득하고 에너지 기력 1스택을 즉시 축적합니다.' },
  b3: { cls: 'brawler', type: 'attack', name: '섀터', cost: 3, target: 'enemy', range: 1, fx: { dmg: 8 }, desc: '바위를 부수는 일격으로 8의 파멸적인 강타 피해를 입힙니다.' },
  b_ult: { cls: 'brawler', type: 'attack', name: '에너지 버스터', cost: 3, target: 'enemy', range: 3, line: true, knockback: 2, fx: { dmg: 9 }, ult: true, desc: '★전직 궁극기: 초사이언 에너지 파동으로 9 피해 + 2칸 넉백!' },

  // 캐논슈터 (캐논마스터)
  n1: { cls: 'cannon', type: 'attack', name: '캐논 블래스트', cost: 3, target: 'tile', range: 4, fx: { dmg: 5, aoe: 1 }, desc: '사거리 4 지점에 포탄을 쏘아 3x3 범위에 5 피해를 가합니다.' },
  n2: { cls: 'cannon', type: 'skill', name: '몽키 웨이브', cost: 1, target: 'ally', range: 2, fx: { shield: 3, buff: 1 }, desc: '원숭이의 응원으로 아군에게 방어도 3과 공격력 +1을 부여합니다.' },
  n3: { cls: 'cannon', type: 'attack', name: '캐논 바주카', cost: 4, target: 'enemy', range: 6, line: true, fx: { dmg: 9 }, desc: '거대 포탄으로 직선 6칸 적에게 9 피해를 입힙니다.' },
  n_ult: { cls: 'cannon', type: 'attack', name: '벅 샷 & 융단폭격', cost: 4, target: 'tile', range: 6, fx: { dmg: 8, aoe: 1, knockbackAoe: 1 }, ult: true, desc: '★전직 궁극기: 전장 어디든 곡사 포격하여 8 피해 + 적들을 사방으로 넉백!' },

  // 특수 공용 카드
  banana: { cls: 'cannon', type: 'skill', name: '원숭이 보급 바나나', cost: 0, target: 'ally', range: 3, temp: true, fx: { heal: 3, refund: 1 }, desc: '원숭이가 던져준 간식: 아군 체력 3 회복 + 코스트 1 충전! (소멸)' },

  // 공용 전술 카드 (누구나 사용 가능)
  c_guard: { cls: 'common', type: 'skill', name: '철통 방진', cost: 1, target: 'ally', range: 4, fx: { shield: 4 }, desc: '사거리 4 아군 기물에게 방어도 4를 부여합니다.' },
  c_rally: { cls: 'common', type: 'skill', name: '진격의 호각', cost: 1, target: 'ally', range: 4, rally: true, fx: { buff: 1 }, desc: '사거리 4 아군의 공격력을 +1 올리고 이동 기회를 1회 재충전합니다.' },
  c_strike: { cls: 'common', type: 'attack', name: '일제 사격', cost: 1, target: 'enemy', range: 3, fx: { dmg: 3 }, desc: '사거리 3 적에게 3의 기동 견제 피해를 가합니다.' },
  c_elixir: { cls: 'common', type: 'skill', name: '엘릭서 농축액', cost: 0, target: 'self', range: 0, temp: true, fx: { refund: 1, heal: 2 }, desc: '코스트 +1 즉시 환급 및 체력 2 회복. (소멸)' },
  c_tactic: { cls: 'common', type: 'attack', name: '전술 넉백포', cost: 2, target: 'enemy', range: 3, knockback: 2, fx: { dmg: 3 }, desc: '적에게 3 피해를 주고 2칸 밀쳐내어 진형을 붕괴시킵니다.' }
};

const COMMON_CARDS = ['c_guard', 'c_rally', 'c_strike', 'c_elixir', 'c_tactic'];

// 클래스 정의 (메이플 10개 직업 & 고유 패시브 & 체스 진화형 전직)
const CLASSES = [
  {
    id: 'warrior', name: '전사', icon: '🛡️', theme: '#b23b3b', hp: 11, atk: 2,
    move: { dirs: 'all', range: 1 }, atkp: { dirs: 'all', range: 1 },
    cards: ['w1', 'w2', 'w3'], ultCard: 'w_ult',
    passive: { name: '스탠스/도발', icon: '🛡️', desc: '피격 시 방어도 +2 획득. 인접 아군(킹 포함) 피격 시 대신 맞아줌.' },
    promo: {
      name: '히어로', hp: 5, atk: 1,
      chessDesc: '체스의 [룩(Rook)]으로 진화! 상하좌우 직선 무한 돌진(5칸) 가능.',
      move: { dirs: 'orth', range: 5 }, atkp: { dirs: 'all', range: 1 }
    },
    desc: '아군을 지키는 든든한 방패. 전직 시 룩처럼 직선을 가르는 돌격병으로 진화.'
  },
  {
    id: 'fire', name: '불독 마법사', icon: '🔥', theme: '#c44d18', hp: 5, atk: 2,
    move: { dirs: 'diag', range: 2 }, atkp: { dirs: 'all', range: 2 },
    cards: ['f1', 'f2', 'f3'], ultCard: 'f_ult',
    passive: { name: '화염과 맹독', icon: '🧪', desc: '공격/스킬로 맞은 적에게 중독 1스택 부여. 턴 종료 시 스택당 2 고정 피해.' },
    promo: {
      name: '불독 아크메이지', hp: 3, atk: 1,
      chessDesc: '체스의 [퀸(Queen)] 기동력 획득! 8방향 3칸 전역 기동.',
      move: { dirs: 'all', range: 3 }, atkp: { dirs: 'all', range: 3 }
    },
    desc: '독과 불을 중첩시켜 지속 피해를 주는 마법사. 전직 시 퀸급 기동 획득.'
  },
  {
    id: 'ice', name: '썬콜 마법사', icon: '❄️', theme: '#2f74b5', hp: 5, atk: 2,
    move: { dirs: 'orth', range: 1 }, atkp: { dirs: 'diag', range: 3 },
    cards: ['i1', 'i2', 'i3'], ultCard: 'i_ult',
    passive: { name: '동결 분쇄', icon: '⚡', desc: '빙결 상태인 적 공격 시 피해량 2배 치명타. 빙결 해제 시 2 추가 피해.' },
    promo: {
      name: '썬콜 아크메이지', hp: 3, atk: 1,
      chessDesc: '체인 라이트닝 개화! 기본 공격이 주변 적에게 연쇄 전이.',
      move: { dirs: 'orth', range: 2 }, atkp: { dirs: 'diag', range: 4, chain: true }
    },
    desc: '빙결로 적의 행동을 묶고 산산조각 내는 냉기 마법사.'
  },
  {
    id: 'cleric', name: '클레릭', icon: '✨', theme: '#d4aa29', hp: 6, atk: 1,
    move: { dirs: 'all', range: 1 }, atkp: { dirs: 'orth', range: 1 },
    cards: ['c1', 'c2', 'c3'], ultCard: 'c_ult',
    passive: { name: '홀리 오라', icon: '🕊️', desc: '매 턴 시작 시 자신과 인접 8칸 내 모든 아군 체력 +2 자동 치유.' },
    promo: {
      name: '비숍', hp: 4, atk: 1,
      chessDesc: '체스의 [비숍(Bishop)]으로 완전 각성! 대각선 무한 슬라이딩(5칸).',
      move: { dirs: 'diag', range: 5 }, atkp: { dirs: 'orth', range: 2 }
    },
    desc: '아군을 치유하는 성직자. 전직 시 비숍처럼 대각선 전장을 종횡무진 누빔.'
  },
  {
    id: 'archer', name: '헌터', icon: '🏹', theme: '#38761d', hp: 5, atk: 2,
    move: { dirs: 'orth', range: 2 }, atkp: { dirs: 'diag', range: 4 },
    cards: ['a1', 'a2', 'a3'], ultCard: 'a_ult',
    passive: { name: '스나이핑', icon: '🎯', desc: '3칸 이상 거리에서 공격 시 피해량 +3 치명타 보너스.' },
    promo: {
      name: '보우마스터', hp: 3, atk: 1,
      chessDesc: '시야 내 전역 저격! 사거리 6칸(직선/대각선)으로 확장.',
      move: { dirs: 'orth', range: 3 }, atkp: { dirs: 'all', range: 6 }
    },
    desc: '먼 거리에서 적을 저격하는 명사수. 거리가 멀수록 데미지 폭증.'
  },
  {
    id: 'thief', name: '어쌔신', icon: '🗡️', theme: '#743b8c', hp: 5, atk: 3,
    move: { dirs: 'knight', range: 1 }, atkp: { dirs: 'all', range: 1 },
    cards: ['t1', 't2', 't3'], ultCard: 't_ult',
    passive: { name: '헤이스트', icon: '💨', desc: '나이트 점프 착지 시 인접 적에게 방어도 무시 2 급습 피해.' },
    promo: {
      name: '나이트로드', hp: 3, atk: 1,
      chessDesc: '[로열 나이트] 진화! 나이트 점프와 대각선 2칸을 자유롭게 혼합 기동.',
      move: { dirs: 'royalKnight', range: 1 }, atkp: { dirs: 'all', range: 2 }
    },
    desc: '장애물을 뛰어넘는 암살자. 전직 시 나이트 점프와 대각 기동을 겸비.'
  },
  {
    id: 'gunner', name: '건슬링거', icon: '🔫', theme: '#8c593b', hp: 6, atk: 2,
    move: { dirs: 'all', range: 1 }, atkp: { dirs: 'orth', range: 3 },
    cards: ['g1', 'g2', 'g3'], ultCard: 'g_ult',
    passive: { name: '탄환 장전', icon: '⚙️', desc: '매 턴 첫 공격 성공 시 에너지 코스트 +1 페이백 충전.' },
    promo: {
      name: '캡틴', hp: 4, atk: 1,
      chessDesc: '기마 포병으로 진화! 8방향 2칸 이동 + 직선 4칸 관통 사격.',
      move: { dirs: 'all', range: 2 }, atkp: { dirs: 'orth', range: 4, pierce: true }
    },
    desc: '직선 탄환을 쏟아내는 기동 포수. 공격 시 마나를 환급받음.'
  },
  {
    id: 'spear', name: '스피어맨', icon: '🔱', theme: '#993d59', hp: 8, atk: 2,
    move: { dirs: 'orth', range: 3 }, atkp: { dirs: 'orth', range: 2, pierce: true },
    cards: ['s1', 's2', 's3'], ultCard: 's_ult',
    passive: { name: '팔랑크스 진형', icon: '🏛️', desc: '인접한 아군과 자신에게 매 턴 방어도 +3 상시 전개.' },
    promo: {
      name: '드래곤나이트', hp: 4, atk: 1,
      chessDesc: '용의 장창 각성! 상하좌우 4칸 무한 관통 공격.',
      move: { dirs: 'orth', range: 4 }, atkp: { dirs: 'orth', range: 4, pierce: true }
    },
    desc: '긴 장창으로 일렬을 꿰뚫는 중장보병. 아군 진형에 방어도를 부여.'
  },
  {
    id: 'brawler', name: '인파이터', icon: '👊', theme: '#bf5026', hp: 8, atk: 3,
    move: { dirs: 'diag', range: 3 }, atkp: { dirs: 'all', range: 1 },
    cards: ['b1', 'b2', 'b3'], ultCard: 'b_ult',
    passive: { name: '에너지 차지', icon: '💥', desc: '공격할 때마다 기력 스택 +1 (최대 3). 스택당 공격력 +1 영구 증가!' },
    promo: {
      name: '바이퍼', hp: 4, atk: 1,
      chessDesc: '돌진 파동 개화! 대각선 4칸 이동 및 돌진 타격 시 적을 2칸 넉백.',
      move: { dirs: 'diag', range: 4 }, atkp: { dirs: 'all', range: 1, knockback: 2 }
    },
    desc: '싸울수록 강해지는 격투가. 전직 시 적을 날려버리는 파동권 구사.'
  },
  {
    id: 'cannon', name: '캐논슈터', icon: '💣', theme: '#5c4832', hp: 7, atk: 3,
    move: { dirs: 'orth', range: 1 }, atkp: { dirs: 'all', range: 4, minRange: 2, arc: true },
    cards: ['n1', 'n2', 'n3'], ultCard: 'n_ult',
    passive: { name: '원숭이 보급', icon: '🐵', desc: '매 턴 시작 시 코스트 0 [보급 바나나](HP 3 회복/마나 충전) 1장 생성.' },
    promo: {
      name: '캐논마스터', hp: 4, atk: 1,
      chessDesc: '전장 전역 융단폭격! 곡사 사거리가 7칸으로 확장되어 어디든 포격.',
      move: { dirs: 'orth', range: 2 }, atkp: { dirs: 'all', range: 7, minRange: 2, arc: true }
    },
    desc: '아군을 넘어 포격하는 장거리 곡사포. 매 턴 보급품을 생성함.'
  },
];
const CLASS_BY = Object.fromEntries(CLASSES.map(c => [c.id, c]));
const KING = { name: '국왕 킹', icon: '♚', move: { dirs: 'all', range: 1 }, atkp: { dirs: 'all', range: 1 } };

// 전역 객체 바인딩 (FX 및 타 모듈 호환성 보장)
if (typeof window !== 'undefined') {
  window.CLASSES = CLASSES;
  window.CLASS_BY = CLASS_BY;
  window.CARDS = CARDS;
  window.COMMON_CARDS = COMMON_CARDS;
  window.KING = KING;
}

// 적 몬스터
const ENEMIES = {
  snail: { name: '달팽이', icon: '🐌', hp: 3, atk: 1, xp: 1, move: { dirs: 'orth', range: 1 }, atkp: { dirs: 'orth', range: 1 }, desc: '느리지만 끈질긴 껍질' },
  mushroom: { name: '주황버섯', icon: '🍄', hp: 4, atk: 1, xp: 1, move: { dirs: 'all', range: 1 }, atkp: { dirs: 'all', range: 1 }, desc: '뜀틀처럼 통통 튀며 전진' },
  slime: { name: '슬라임', icon: '🟢', hp: 5, atk: 1, xp: 1, move: { dirs: 'diag', range: 1 }, atkp: { dirs: 'orth', range: 1 }, desc: '대각선으로 미끄러져 덮침' },
  pig: { name: '리본돼지', icon: '🐷', hp: 5, atk: 1, xp: 2, move: { dirs: 'orth', range: 2 }, atkp: { dirs: 'all', range: 1 }, desc: '돌진 기동을 가진 사나운 돼지' },
  stump: { name: '스텀프', icon: '🌳', hp: 9, atk: 2, xp: 2, move: { dirs: 'orth', range: 1 }, atkp: { dirs: 'orth', range: 1 }, desc: '높은 체력의 굳건한 나무 괴물' },
  boar: { name: '와일드보어', icon: '🐗', hp: 6, atk: 2, xp: 2, move: { dirs: 'orth', range: 3 }, atkp: { dirs: 'orth', range: 1 }, desc: '먼 거리를 단숨에 들이받음' },
  zombie: { name: '좀비버섯', icon: '🧟', hp: 8, atk: 2, xp: 3, move: { dirs: 'all', range: 1 }, atkp: { dirs: 'all', range: 1 }, desc: '부패한 독기를 품은 변종 버섯' },
  evileye: { name: '이블아이', icon: '👁️', hp: 6, atk: 2, xp: 3, move: { dirs: 'knight', range: 1 }, atkp: { dirs: 'orth', range: 3 }, desc: '나이트처럼 점프하고 안광 사격' },
  yeti: { name: '주니어 예티', icon: '🦣', hp: 22, atk: 3, xp: 8, move: { dirs: 'all', range: 1 }, atkp: { dirs: 'all', range: 1 }, elite: true, desc: '거대한 주먹을 휘두르는 설원의 맹수' },
  balrog: { name: '마왕 발록', icon: '😈', hp: 60, atk: 4, xp: 25, move: { dirs: 'all', range: 2 }, atkp: { dirs: 'all', range: 2 }, boss: true, summon: { id: 'mushroom', every: 3, n: 2 }, desc: '심연의 군주. 수하를 소환하며 대지를 붕괴시킴' },
};

// 지역별 전장 테마 정의 (메이플 명소 × 크로노스 시계 장치 전장)
const STAGE_THEMES = {
  henesys: {
    id: 'henesys',
    name: '헤네시스',
    icon: '🌿',
    floorName: (f) => `STAGE ${f + 1}`,
    stageTitles: [
      '콧노래 오솔길의 시계 정원',
      '째깍이는 포자 언덕길'
    ],
    lore: '바람결에 민들레 홀씨와 녹슨 황동 톱니가 흩날리는 잔디 정원 전장입니다.',
    pool: ['snail', 'mushroom', 'slime', 'pig']
  },
  ellinia: {
    id: 'ellinia',
    name: '엘리니아',
    icon: '🌲',
    floorName: (f) => `STAGE ${f + 1}`,
    stageTitles: [
      '시간의 숲과 마법 나무',
      '비전 마력의 고목 갈림길'
    ],
    lore: '태고의 거목 기둥에 새겨진 마법 룬과 푸른 마력이 바닥을 감싸고 있습니다.',
    pool: ['slime', 'mushroom', 'stump', 'pig']
  },
  perion: {
    id: 'perion',
    name: '페리온',
    icon: '🏜️',
    floorName: (f) => `STAGE ${f + 1}`,
    stageTitles: [
      '황혼의 붉은 바위 전초기지',
      '태엽 분쇄 협곡의 격전지'
    ],
    lore: '황혼의 붉은 사암 아래 거대한 기계 태엽이 모래바람 속에 맞물려 돌아갑니다.',
    pool: ['boar', 'stump', 'pig', 'evileye']
  },
  sleepywood: {
    id: 'sleepywood',
    name: '슬리피우드',
    icon: '🦇',
    floorName: (f) => `STAGE ${f + 1}`,
    stageTitles: [
      '멈춘 시간의 침식 동굴',
      '침식된 심연의 시간 문턱'
    ],
    lore: '자수정 독기와 축축한 석회암 사이로 부식된 고대 시계바늘이 박혀 있습니다.',
    pool: ['zombie', 'evileye', 'boar', 'stump']
  },
  elinasnow: {
    id: 'elinasnow',
    name: '엘나스 산맥',
    icon: '❄️',
    floorName: (f) => 'ELITE',
    stageTitles: ['주니어 예티의 혹한 설벽'],
    lore: '영구동토의 얼어붙은 빙벽과 서리 맺힌 시계탑 유적에 맹수가 도사립니다.',
    pool: ['slime', 'zombie', 'evileye', 'pig']
  },
  balrog: {
    id: 'balrog',
    name: '심연의 성소',
    icon: '🔥',
    floorName: (f) => 'FINAL BOSS',
    stageTitles: ['인과율의 제단 · 마왕 발록'],
    lore: '시간과 인과율이 완전히 붕괴한 흑요석 용암 제단에서 심연의 군주가 군림합니다.',
    pool: ['zombie', 'evileye']
  }
};

function makeEncounter(kind, f) {
  let stageKey = 'henesys';
  if (kind === 'boss') stageKey = 'balrog';
  else if (kind === 'elite') stageKey = 'elinasnow';
  else if (f < 2) stageKey = 'henesys';
  else if (f < 4) stageKey = 'ellinia';
  else if (f < 6) stageKey = 'perion';
  else stageKey = 'sleepywood';

  const themeInfo = STAGE_THEMES[stageKey];
  const pool = themeInfo.pool;
  const pick = n => Array.from({ length: n }, () => pool[rnd(pool.length)]);

  if (kind === 'boss') {
    return {
      name: themeInfo.stageTitles[0],
      theme: 'balrog',
      regionName: themeInfo.name,
      regionIcon: themeInfo.icon,
      floorName: themeInfo.floorName(f),
      lore: themeInfo.lore,
      start: ['balrog', 'zombie', 'zombie'],
      waves: [],
      kind: 'boss',
      isBoss: true
    };
  }

  if (kind === 'elite') {
    return {
      name: themeInfo.stageTitles[0],
      theme: 'elinasnow',
      regionName: themeInfo.name,
      regionIcon: themeInfo.icon,
      floorName: themeInfo.floorName(f),
      lore: themeInfo.lore,
      start: ['yeti', ...pick(2)],
      waves: [{ turn: 4, units: pick(3) }],
      kind: 'elite'
    };
  }

  // 일반 스테이지: 층수별 개별 이름
  const subIdx = f % 2;
  const stageTitle = themeInfo.stageTitles[subIdx] || `${themeInfo.name} 전장`;

  return {
    name: stageTitle,
    theme: stageKey,
    regionName: themeInfo.name,
    regionIcon: themeInfo.icon,
    floorName: themeInfo.floorName(f),
    lore: themeInfo.lore,
    start: pick(3 + Math.floor(f / 2)),
    waves: [
      { turn: 3, units: pick(2 + (f > 3 ? 1 : 0)) },
      { turn: 6, units: pick(3) }
    ],
    kind: 'normal'
  };
}

function descPat(p) {
  if (p.dirs === 'knight') return '나이트 점프';
  if (p.dirs === 'royalKnight') return '로열 나이트 (점프+대각2칸)';
  const n = { orth: '상하좌우 직선', diag: '대각선', all: '8방향' };
  let s = `${n[p.dirs]} ${p.minRange ? p.minRange + '~' : ''}${p.range}칸`;
  if (p.pierce) s += ' (관통)';
  if (p.arc) s += ' (곡사)';
  return s;
}

// ===== 시계초침 장비 시스템 (Clock Hands Equipment System) =====
// 시침 = 투구, 분침 = 갑옷, 초침 = 바지, 일침 = 신발
const CLOCK_HANDS = {
  // 1. 시침 (Hour Hand) - RPG '투구' 격
  h_iron: {
    id: 'h_iron', slot: 'hour', slotName: '시침', role: '투구',
    name: '강철 시침', icon: '🕐',
    color: '#e2e8f0', glow: 'rgba(226, 232, 240, 0.85)',
    trail: 'silver', aura: 'aura-silver',
    desc: '시간의 무게를 묵직하게 버텨내는 강철 시침 투구.'
  },
  h_gold: {
    id: 'h_gold', slot: 'hour', slotName: '시침', role: '투구',
    name: '황금 태엽 시침', icon: '👑',
    color: '#ffd54f', glow: 'rgba(255, 213, 79, 0.95)',
    trail: 'gold', aura: 'aura-gold',
    desc: '왕실 시계공이 벼려낸 황금빛 시침. 찬란한 위엄을 발산합니다.'
  },
  h_flame: {
    id: 'h_flame', slot: 'hour', slotName: '시침', role: '투구',
    name: '홍련의 시침', icon: '🔥',
    color: '#f87171', glow: 'rgba(239, 68, 68, 0.95)',
    trail: 'flame', aura: 'aura-flame',
    desc: '타오르는 불꽃의 기운을 품어 전장을 붉게 물들이는 투구 시침.'
  },
  h_void: {
    id: 'h_void', slot: 'hour', slotName: '시침', role: '투구',
    name: '심연의 시침', icon: '🔮',
    color: '#c084fc', glow: 'rgba(168, 85, 247, 0.95)',
    trail: 'void', aura: 'aura-void',
    desc: '시공간의 공허를 꿰뚫어보는 신비로운 보랏빛 투구 시침.'
  },

  // 2. 분침 (Minute Hand) - RPG '갑옷' 격
  m_brass: {
    id: 'm_brass', slot: 'minute', slotName: '분침', role: '갑옷',
    name: '황동 판금 분침', icon: '🛡️',
    color: '#e0a96d', glow: 'rgba(224, 169, 109, 0.85)',
    trail: 'brass', aura: 'aura-brass',
    desc: '단단한 황동 갑옷처럼 충격을 흡수하는 중장갑 분침.'
  },
  m_frost: {
    id: 'm_frost', slot: 'minute', slotName: '분침', role: '갑옷',
    name: '서리 수정 분침', icon: '❄️',
    color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.95)',
    trail: 'frost', aura: 'aura-frost',
    desc: '절대 영도의 냉기로 전신을 보호하는 차가운 얼음 갑옷 분침.'
  },
  m_jade: {
    id: 'm_jade', slot: 'minute', slotName: '분침', role: '갑옷',
    name: '비취 잎사귀 분침', icon: '🌿',
    color: '#34d399', glow: 'rgba(52, 211, 153, 0.95)',
    trail: 'jade', aura: 'aura-jade',
    desc: '흐르는 생명력으로 상처를 감싸주는 비취빛 치유 분침.'
  },
  m_shadow: {
    id: 'm_shadow', slot: 'minute', slotName: '분침', role: '갑옷',
    name: '흑요석 분침', icon: '🌑',
    color: '#94a3b8', glow: 'rgba(100, 116, 139, 0.9)',
    trail: 'shadow', aura: 'aura-shadow',
    desc: '적들의 시선을 차단하고 그림자 장막을 두르는 어둠의 분침.'
  },

  // 3. 초침 (Second Hand) - RPG '바지' 격
  s_gale: {
    id: 's_gale', slot: 'second', slotName: '초침', role: '바지',
    name: '질풍의 초침', icon: '⚡',
    color: '#67e8f9', glow: 'rgba(103, 232, 249, 0.95)',
    trail: 'lightning', aura: 'aura-cyan',
    desc: '바람처럼 민첩한 각력을 부여하여 찰나의 순간을 가르는 초침.'
  },
  s_ruby: {
    id: 's_ruby', slot: 'second', slotName: '초침', role: '바지',
    name: '진홍 루비 초침', icon: '💎',
    color: '#fb7185', glow: 'rgba(244, 63, 94, 0.95)',
    trail: 'ruby', aura: 'aura-ruby',
    desc: '1초마다 맥박치며 폭발적인 도약력을 이끌어내는 루비 초침.'
  },
  s_amber: {
    id: 's_amber', slot: 'second', slotName: '초침', role: '바지',
    name: '호박석 정밀 초침', icon: '⏱️',
    color: '#fbbf24', glow: 'rgba(245, 158, 11, 0.95)',
    trail: 'amber', aura: 'aura-gold',
    desc: '가장 순수한 시간을 째깍이는 정밀 크로노미터 바지 초침.'
  },
  s_phantom: {
    id: 's_phantom', slot: 'second', slotName: '초침', role: '바지',
    name: '환영의 초침', icon: '👻',
    color: '#e879f9', glow: 'rgba(217, 70, 239, 0.95)',
    trail: 'phantom', aura: 'aura-magenta',
    desc: '현실과 환영의 경계를 넘나들며 다중 궤적을 그리는 초침.'
  },

  // 4. 일침 (Day Hand) - RPG '신발' 격
  d_wanderer: {
    id: 'd_wanderer', slot: 'day', slotName: '일침', role: '신발',
    name: '방랑자의 일침', icon: '👟',
    color: '#fef08a', glow: 'rgba(254, 240, 138, 0.9)',
    trail: 'starlight', aura: 'aura-yellow',
    desc: '천 리 길도 지치지 않고 내딛게 돕는 방랑자의 장화 일침.'
  },
  d_chronos: {
    id: 'd_chronos', slot: 'day', slotName: '일침', role: '신발',
    name: '크로노스의 일침', icon: '⌛',
    color: '#a78bfa', glow: 'rgba(167, 139, 250, 0.95)',
    trail: 'cosmos', aura: 'aura-purple',
    desc: '시공간의 지평선을 딛고 서는 크로노스 전용 신발 일침.'
  },
  d_stride: {
    id: 'd_stride', slot: 'day', slotName: '일침', role: '신발',
    name: '도약의 일침', icon: '🪶',
    color: '#4ade80', glow: 'rgba(74, 222, 128, 0.95)',
    trail: 'wind', aura: 'aura-green',
    desc: '운명의 다음 날을 향해 성큼 발을 뻗는 도약의 일침.'
  },
  d_eclipse: {
    id: 'd_eclipse', slot: 'day', slotName: '일침', role: '신발',
    name: '일식의 흑요 일침', icon: '🌘',
    color: '#fda4af', glow: 'rgba(244, 63, 94, 0.85)',
    trail: 'eclipse', aura: 'aura-crimson',
    desc: '낮과 밤의 경계를 무너뜨려 신비로운 시간의 걸음을 내딛는 일침.'
  }
};

const CLOCK_HANDS_LIST = Object.values(CLOCK_HANDS);

if (typeof window !== 'undefined') {
  window.ENEMIES = ENEMIES;
  window.STAGE_THEMES = STAGE_THEMES;
  window.makeEncounter = makeEncounter;
  window.CLOCK_HANDS = CLOCK_HANDS;
  window.CLOCK_HANDS_LIST = CLOCK_HANDS_LIST;
}
