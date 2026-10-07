// ===== GSAP 기반 모션 및 슬더스 스타일 비주얼 이펙트 =====
const FX = (() => {
  let arrowSvg = null;

  function initArrowLayer() {
    let svg = document.getElementById('targeting-svg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'targeting-svg';
      svg.style.position = 'fixed';
      svg.style.top = '0';
      svg.style.left = '0';
      svg.style.width = '100vw';
      svg.style.height = '100vh';
      svg.style.pointerEvents = 'none';
      svg.style.zIndex = '999';
      svg.style.overflow = 'visible';
      document.body.appendChild(svg);
    }
    arrowSvg = svg;
  }

  return {
    init() {
      initArrowLayer();
    },

    setSpeed(speed) {
      if (window.gsap) {
        gsap.globalTimeline.timeScale(speed);
      }
    },

    // 화면 진동 (Screen Shake)
    shake(intensity = 8) {
      if (!window.gsap) return;
      const app = document.getElementById('app');
      if (!app) return;
      gsap.timeline()
        .to(app, { x: -intensity, y: intensity * 0.7, duration: 0.04 })
        .to(app, { x: intensity, y: -intensity * 0.5, duration: 0.05 })
        .to(app, { x: -intensity * 0.6, y: intensity * 0.3, duration: 0.05 })
        .to(app, { x: intensity * 0.3, y: -intensity * 0.2, duration: 0.05 })
        .to(app, { x: 0, y: 0, duration: 0.06 });
    },

    // 카드가 시전자에게 날아가 산산조각 바스러지는 모션 (Dissolve / Shatter Cast)
    animateCardCast(cardElem, targetUnitElem, themeColor = '#ffd700') {
      return new Promise(resolve => {
        if (!window.gsap || !cardElem || !targetUnitElem) return resolve();

        const cRect = cardElem.getBoundingClientRect();
        const uRect = targetUnitElem.getBoundingClientRect();

        // 원본 카드는 즉시 숨김
        cardElem.style.opacity = '0';

        // 화면 고정 클론 카드 생성
        const clone = cardElem.cloneNode(true);
        clone.id = 'flying-card-clone';
        clone.style.position = 'fixed';
        clone.style.left = `${cRect.left}px`;
        clone.style.top = `${cRect.top}px`;
        clone.style.width = `${cRect.width}px`;
        clone.style.height = `${cRect.height}px`;
        clone.style.zIndex = '9999';
        clone.style.pointerEvents = 'none';
        clone.style.opacity = '1';
        clone.style.transform = 'none';
        clone.style.margin = '0';
        clone.style.boxShadow = `0 0 24px ${themeColor}, 0 12px 30px rgba(0,0,0,0.9)`;
        document.body.appendChild(clone);

        // 시전자 유닛 중심 좌표
        const targetCenterX = uRect.left + uRect.width / 2;
        const targetCenterY = uRect.top + uRect.height / 2;

        const dx = targetCenterX - (cRect.left + cRect.width / 2);
        const dy = targetCenterY - (cRect.top + cRect.height / 2);

        const tl = gsap.timeline({
          onComplete: () => {
            if (clone.parentNode) clone.parentNode.removeChild(clone);
            resolve();
          }
        });

        // 1단계: 카드가 공중으로 솟구침
        tl.to(clone, {
          y: -35,
          scale: 1.15,
          duration: 0.12,
          ease: "power2.out"
        });

        // 2단계: 시전자 기물을 향해 포물선 비행
        tl.to(clone, {
          x: dx,
          y: dy,
          scale: 0.42,
          rotation: (Math.random() - 0.5) * 40,
          duration: 0.26,
          ease: "power2.in"
        });

        // 3단계: 도달 시점에 바스러지는 모션 & 사운드 & 파티클 폭발
        tl.add(() => {
          if (window.Sound && Sound.cardCrumble) Sound.cardCrumble();

          // 시전자 유닛 반짝임 & 펄스 흡수 효과
          const inner = targetUnitElem.querySelector('.unit-inner') || targetUnitElem;
          gsap.fromTo(inner, 
            { scale: 1.25, filter: `brightness(2) drop-shadow(0 0 18px ${themeColor})` }, 
            { scale: 1, filter: "none", duration: 0.24, ease: "back.out(2)" }
          );

          // 바스러지는 파편 파티클 20개 생성
          const shardContainer = document.createElement('div');
          shardContainer.style.position = 'fixed';
          shardContainer.style.left = `${targetCenterX}px`;
          shardContainer.style.top = `${targetCenterY}px`;
          shardContainer.style.pointerEvents = 'none';
          shardContainer.style.zIndex = '10000';
          document.body.appendChild(shardContainer);

          const numShards = 20;
          for (let s = 0; s < numShards; s++) {
            const shard = document.createElement('div');
            shard.className = 'card-dissolve-shard';
            const angle = (s / numShards) * Math.PI * 2 + Math.random() * 0.4;
            const speed = 40 + Math.random() * 65;
            const sx = Math.cos(angle) * speed;
            const sy = Math.sin(angle) * speed - 15;
            const size = 4 + Math.random() * 8;

            shard.style.width = `${size}px`;
            shard.style.height = `${size}px`;
            shard.style.backgroundColor = s % 2 === 0 ? themeColor : '#ffffff';
            shard.style.boxShadow = `0 0 8px ${themeColor}`;
            shard.style.position = 'absolute';
            shard.style.borderRadius = s % 3 === 0 ? '50%' : '1px';
            shardContainer.appendChild(shard);

            gsap.to(shard, {
              x: sx,
              y: sy,
              rotation: (Math.random() - 0.5) * 720,
              scale: 0,
              opacity: 0,
              duration: 0.35 + Math.random() * 0.2,
              ease: "power2.out"
            });
          }

          setTimeout(() => {
            if (shardContainer.parentNode) shardContainer.parentNode.removeChild(shardContainer);
          }, 600);
        });

        // 4단계: 카드 본체 번쩍이며 산산조각 바스러짐
        tl.to(clone, {
          filter: "brightness(3) contrast(2) blur(2px)",
          scale: 0.05,
          opacity: 0,
          duration: 0.15,
          ease: "power1.in"
        });
      });
    },

    // 각 클래스별 궤적 선 및 잔상 테마 팔레트
    CLASS_TRAIL_THEMES: {
      warrior: { main: '#dc2626', core: '#fee2e2', glow: 'rgba(220, 38, 38, 0.85)', width: 7 },
      fire:    { main: '#ea580c', core: '#fef08a', glow: 'rgba(234, 88, 12, 0.85)', width: 6 },
      ice:     { main: '#0284c7', core: '#e0f2fe', glow: 'rgba(56, 189, 248, 0.9)', width: 6 },
      cleric:  { main: '#eab308', core: '#ffffff', glow: 'rgba(234, 179, 8, 0.85)', width: 7 },
      archer:  { main: '#16a34a', core: '#dcfce7', glow: 'rgba(22, 163, 74, 0.85)', width: 5 },
      thief:   { main: '#9333ea', core: '#f3e8ff', glow: 'rgba(147, 51, 234, 0.9)', width: 6 },
      gunner:  { main: '#d97706', core: '#fef3c7', glow: 'rgba(217, 119, 6, 0.85)', width: 5 },
      spear:   { main: '#be185d', core: '#fce7f3', glow: 'rgba(190, 24, 93, 0.85)', width: 7 },
      brawler: { main: '#f97316', core: '#fed7aa', glow: 'rgba(249, 115, 22, 0.85)', width: 8 },
      cannon:  { main: '#b45309', core: '#fde68a', glow: 'rgba(180, 83, 9, 0.85)', width: 8 },
      king:    { main: '#ffd700', core: '#ffffff', glow: 'rgba(255, 215, 0, 0.95)', width: 8 },
      enemy:   { main: '#ef4444', core: '#fca5a5', glow: 'rgba(239, 68, 68, 0.75)', width: 5 },
      boss:    { main: '#991b1b', core: '#f87171', glow: 'rgba(153, 27, 27, 0.95)', width: 9 }
    },

    getThemeForUnit(unit, elem) {
      const themes = this.CLASS_TRAIL_THEMES;
      if (unit) {
        if (unit.king) return themes.king;
        if (unit.side === 'e') {
          const d = window.ENEMIES ? window.ENEMIES[unit.eid] : null;
          if (d && (d.boss || d.elite)) return themes.boss;
          return themes.enemy;
        }
        if (unit.cid && themes[unit.cid]) return themes[unit.cid];
      }
      if (elem) {
        if (elem.classList.contains('king')) return themes.king;
        if (elem.classList.contains('boss')) return themes.boss;
        if (elem.classList.contains('e')) return themes.enemy;
        const match = elem.id && elem.id.match(/^unit-(\d+)$/);
        if (match && window.B && window.B.units) {
          const u = window.B.units.find(un => un.uid === +match[1]);
          if (u) return this.getThemeForUnit(u);
        }
      }
      return themes.king;
    },

    getTrailSvg() {
      let svg = document.getElementById('motion-trail-svg');
      if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'motion-trail-svg';
        svg.style.position = 'fixed';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100vw';
        svg.style.height = '100vh';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '15';
        svg.style.overflow = 'visible';
        document.body.appendChild(svg);
      }
      return svg;
    },

    // 유닛 이동 애니메이션 (클래스별 네온 궤적 선 + 고스트 실루엣 잔상)
    animateMove(elem, dxPx, dyPx, isKnight = false, unit = null) {
      return new Promise(resolve => {
        if (!window.gsap || !elem) return resolve();

        let resolved = false;
        const finish = () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(safetyTimer);
          if (elem) elem.style.zIndex = '';
          resolve();
        };
        const safetyTimer = setTimeout(finish, isKnight ? 650 : 500);

        elem.style.zIndex = '25';

        const theme = this.getThemeForUnit(unit, elem);
        const rA = elem.getBoundingClientRect();
        const startX = rA.left + rA.width / 2;
        const startY = rA.top + rA.height / 2;
        const endX = startX + dxPx;
        const endY = startY + dyPx;

        // 궤적 SVG 패스 데이터 생성 (나이트는 포물선 아크, 일반 말은 직선)
        let pathD = '';
        if (isKnight) {
          const midX = (startX + endX) / 2;
          const midY = Math.min(startY, endY) - 55;
          pathD = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
        } else {
          pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
        }

        // SVG 레이어에 2중 발광 궤적 선(외곽 글로우 + 내부 코어 광선) 추가
        const svg = this.getTrailSvg();
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'motion-trail-group');

        // 1) 외곽 네온 글로우 선
        const outer = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        outer.setAttribute('d', pathD);
        outer.setAttribute('fill', 'none');
        outer.setAttribute('stroke', theme.main);
        outer.setAttribute('stroke-width', theme.width);
        outer.setAttribute('stroke-linecap', 'round');
        outer.setAttribute('stroke-linejoin', 'round');
        outer.style.filter = `drop-shadow(0 0 6px ${theme.main}) drop-shadow(0 0 14px ${theme.glow})`;
        outer.style.opacity = '0.92';

        // 2) 내부 고광도 코어 빔
        const inner = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        inner.setAttribute('d', pathD);
        inner.setAttribute('fill', 'none');
        inner.setAttribute('stroke', theme.core);
        inner.setAttribute('stroke-width', Math.max(2, theme.width * 0.35));
        inner.setAttribute('stroke-linecap', 'round');
        inner.setAttribute('stroke-linejoin', 'round');
        inner.style.opacity = '0.98';

        g.appendChild(outer);
        g.appendChild(inner);
        svg.appendChild(g);

        let pathLen = 100;
        try {
          pathLen = outer.getTotalLength() || 100;
        } catch (e) {
          pathLen = 100;
        }
        [outer, inner].forEach(p => {
          p.style.strokeDasharray = `${pathLen}`;
          p.style.strokeDashoffset = `${pathLen}`;
        });

        const moveDuration = isKnight ? 0.38 : 0.28;

        const tl = gsap.timeline({
          onComplete: finish
        });

        // 1단계: 이동 궤적 선 실시간 드로잉
        tl.to([outer, inner], {
          strokeDashoffset: 0,
          duration: moveDuration,
          ease: isKnight ? "power2.inOut" : "power2.out"
        }, 0);

        // 2단계: 유닛 기물 이동
        if (isKnight) {
          tl.to(elem, {
            x: dxPx,
            y: dyPx,
            duration: 0.38,
            ease: "power2.inOut"
          }, 0);
          const innerUnit = elem.querySelector('.unit-inner') || elem;
          tl.to(innerUnit, {
            y: -50,
            scale: 1.25,
            duration: 0.19,
            ease: "power1.out"
          }, 0);
          tl.to(innerUnit, {
            y: 0,
            scale: 1,
            duration: 0.19,
            ease: "bounce.out"
          }, 0.19);
        } else {
          tl.to(elem, {
            x: dxPx,
            y: dyPx,
            duration: 0.28,
            ease: "power2.out"
          }, 0);
        }

        // 3단계: 이동 경로 상에 고스트 실루엣 잔상 2기 스폰
        const spawnGhost = (fraction) => {
          const ghost = elem.cloneNode(true);
          ghost.className += ' unit-ghost-afterimage';
          ghost.style.position = 'fixed';
          ghost.style.left = `${rA.left + dxPx * fraction}px`;
          ghost.style.top = `${rA.top + dyPx * fraction + (isKnight ? -32 * Math.sin(fraction * Math.PI) : 0)}px`;
          ghost.style.width = `${rA.width}px`;
          ghost.style.height = `${rA.height}px`;
          ghost.style.pointerEvents = 'none';
          ghost.style.zIndex = '18';
          ghost.style.margin = '0';
          ghost.style.transform = 'none';
          ghost.style.opacity = '0.52';
          ghost.style.filter = `drop-shadow(0 0 10px ${theme.main}) brightness(1.2)`;
          document.body.appendChild(ghost);

          gsap.to(ghost, {
            opacity: 0,
            scale: 0.85,
            duration: 0.26,
            ease: "power2.out",
            onComplete: () => {
              if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
            }
          });
        };

        tl.call(() => spawnGhost(0.35), null, moveDuration * 0.35);
        tl.call(() => spawnGhost(0.70), null, moveDuration * 0.70);

        // 4단계: 궤적 선 부드러운 페이드아웃 및 정리
        gsap.to(g, {
          opacity: 0,
          duration: 0.32,
          delay: moveDuration * 0.65,
          ease: "power2.in",
          onComplete: () => {
            if (g.parentNode) g.parentNode.removeChild(g);
          }
        });
      });
    },

    // 유닛 공격 애니메이션 (직업별 다이내믹 모션 & 투사체 & 슬래시 타격감)
    animateAttack(attackerElem, targetElem, attackerUnit = null, targetUnit = null) {
      return new Promise(resolve => {
        if (!window.gsap || !attackerElem || !targetElem) return resolve();

        let resolved = false;
        const finish = () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(safetyTimer);
          if (attackerElem) attackerElem.style.zIndex = '';
          resolve();
        };
        const safetyTimer = setTimeout(finish, 850);

        const rA = attackerElem.getBoundingClientRect();
        const rT = targetElem.getBoundingClientRect();
        const dx = rT.left - rA.left;
        const dy = rT.top - rA.top;
        const dist = (attackerUnit && targetUnit) ? Math.max(Math.abs(attackerUnit.x - targetUnit.x), Math.abs(attackerUnit.y - targetUnit.y)) : 1;

        // 공격 타입 및 연출 프로필 판정
        const profile = (() => {
          if (attackerUnit && attackerUnit.king) {
            return { type: 'king', color: '#ffd700', sound: 'thunder' };
          }
          if (attackerUnit && attackerUnit.side === 'e') {
            const isBoss = (window.ENEMIES && attackerUnit.eid && window.ENEMIES[attackerUnit.eid]?.boss) || (window.D && D(attackerUnit)?.boss);
            if (isBoss) return { type: 'boss', color: '#dc2626', sound: 'claw' };
            if (attackerUnit.eid === 'evileye') return { type: 'magic', color: '#a855f7', icon: '👁️', sound: 'magic' };
            return { type: 'monster', color: '#ef4444', sound: 'claw' };
          }
          const cid = attackerUnit ? attackerUnit.cid : 'warrior';
          if (cid === 'cannon') return { type: 'projectile', icon: '💣', color: '#f97316', sound: 'cannon', arc: true };
          if (cid === 'gunner') return { type: 'projectile', icon: '💥', color: '#fbbf24', sound: 'cannon' };
          if (cid === 'archer' || cid === 'xbow') return { type: 'arrow', color: '#fde047', sound: 'arrow' };
          if (cid === 'fire') return { type: 'projectile', icon: '🔥', color: '#ef4444', sound: 'magic' };
          if (cid === 'ice') return { type: 'projectile', icon: '❄️', color: '#38bdf8', sound: 'magic' };
          if (cid === 'cleric') return { type: 'projectile', icon: '✨', color: '#facc15', sound: 'magic' };
          if (cid === 'spear') return { type: 'thrust', color: '#60a5fa', sound: 'thrust' };
          if (cid === 'brawler') return { type: 'punch', color: '#f97316', sound: 'punch' };
          if (cid === 'sin' || cid === 'shad') return { type: 'shadow_slash', color: '#c084fc', sound: 'slash' };
          if (dist > 1) return { type: 'arrow', color: '#fde047', sound: 'arrow' };
          return { type: 'slash', color: '#ffd700', sound: 'slash' };
        })();

        // 사운드 재생
        if (window.Sound && profile.sound && Sound[profile.sound]) {
          Sound[profile.sound]();
        }

        const innerA = attackerElem.querySelector('.unit-inner') || attackerElem;
        attackerElem.style.zIndex = '35';

        // 1) 국왕 신성 벼락 강타
        if (profile.type === 'king') {
          gsap.timeline({ onComplete: finish })
            .to(innerA, { scale: 1.25, y: -10, duration: 0.12, ease: "power2.out" })
            .call(() => {
              // 하늘에서 타겟 머리 위로 벼락 투하
              const thunder = document.createElement('div');
              thunder.className = 'attack-fx-thunder';
              thunder.style.left = (rT.left + rT.width / 2) + 'px';
              thunder.style.top = (rT.top + rT.height / 2) + 'px';
              document.body.appendChild(thunder);

              FX.shake(6);
              FX.createSparkles(rT.left + rT.width / 2, rT.top + rT.height / 2, '#ffd700', 16);
              FX.animateHit(targetElem, 0, 8);

              gsap.fromTo(thunder,
                { opacity: 1, scaleY: 0 },
                { scaleY: 1, duration: 0.12, ease: "power3.in", onComplete: () => {
                  gsap.to(thunder, { opacity: 0, duration: 0.18, onComplete: () => thunder.remove() });
                }}
              );
            })
            .to(innerA, { scale: 1, y: 0, duration: 0.2, ease: "back.out(1.5)" });
          return;
        }

        // 2) 원거리 투사체 비행 (화살, 포탄, 마법구 등)
        if (profile.type === 'arrow' || profile.type === 'projectile') {
          gsap.timeline({ onComplete: finish })
            // 공격자 반동
            .to(innerA, {
              x: -Math.sign(dx) * 8,
              y: -Math.sign(dy) * 8,
              scale: 0.95,
              duration: 0.08,
              ease: "power2.out"
            })
            .call(() => {
              const startX = rA.left + rA.width / 2;
              const startY = rA.top + rA.height / 2;
              const endX = rT.left + rT.width / 2;
              const endY = rT.top + rT.height / 2;
              const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);

              const proj = document.createElement('div');
              proj.className = 'attack-fx-projectile' + (profile.type === 'arrow' ? ' arrow-beam' : '');
              if (profile.type === 'arrow') {
                proj.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
              } else {
                proj.innerHTML = profile.icon || '💥';
                proj.style.setProperty('--proj-glow', profile.color);
              }
              proj.style.left = startX + 'px';
              proj.style.top = startY + 'px';
              document.body.appendChild(proj);

              const duration = profile.arc ? 0.32 : 0.18;
              const ease = profile.arc ? "power1.inOut" : "power2.in";

              // 비행 애니메이션
              gsap.to(proj, {
                left: endX,
                top: endY,
                duration: duration,
                ease: ease,
                onComplete: () => {
                  proj.remove();
                  if (window.Sound && Sound.hit) Sound.hit();
                  FX.createSparkles(endX, endY, profile.color, 12);
                  FX.createShockwave(endX, endY, profile.color);
                  FX.animateHit(targetElem, Math.sign(dx) * 10, Math.sign(dy) * 10);
                }
              });
            })
            .to(innerA, { x: 0, y: 0, scale: 1, duration: 0.22, delay: 0.12, ease: "elastic.out(1, 0.4)" });
          return;
        }

        // 3) 근접 베기 / 찌르기 / 할퀴기 / 펀치
        const lungeRatio = profile.type === 'boss' ? 0.75 : 0.65;
        gsap.timeline({ onComplete: finish })
          // 사전 장전 모션 (Anticipation)
          .to(innerA, {
            x: -dx * 0.15,
            y: -dy * 0.15,
            scale: 1.1,
            duration: 0.07,
            ease: "power2.out"
          })
          // 번개같은 돌격 타격 (Lunge)
          .to(innerA, {
            x: dx * lungeRatio,
            y: dy * lungeRatio,
            scale: profile.type === 'boss' ? 1.35 : 1.25,
            rotation: (Math.sign(dx) || 1) * 8,
            duration: 0.11,
            ease: "power3.in"
          })
          // 타격 시점 이펙트 오버레이 & 피격자 리액션
          .call(() => {
            const hitX = rT.left + rT.width / 2;
            const hitY = rT.top + rT.height / 2;

            if (profile.type === 'boss') {
              FX.shake(6);
              FX.createClawSlash(hitX, hitY, '#dc2626', 1.4);
            } else if (profile.type === 'monster') {
              FX.shake(3);
              FX.createClawSlash(hitX, hitY, '#ef4444', 1.0);
            } else if (profile.type === 'thrust') {
              FX.shake(3);
              FX.createShockwave(hitX, hitY, profile.color);
            } else if (profile.type === 'punch') {
              FX.shake(4);
              FX.createShockwave(hitX, hitY, '#f97316');
            } else {
              // 검기 참격 (Slash Arc)
              FX.shake(3);
              FX.createSwordSlash(hitX, hitY, profile.color);
            }

            FX.createSparkles(hitX, hitY, profile.color, 12);
            FX.animateHit(targetElem, Math.sign(dx) * 12, Math.sign(dy) * 12);
          })
          // 원래 위치로 복귀 (Recoil & Reset)
          .to(innerA, {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            duration: 0.22,
            ease: "back.out(1.6)"
          });
      });
    },

    // 검기 참격 이펙트 (Slash Arc)
    createSwordSlash(x, y, color = '#ffd700') {
      const slash = document.createElement('div');
      slash.className = 'attack-fx-slash';
      slash.style.left = x + 'px';
      slash.style.top = y + 'px';
      slash.style.setProperty('--slash-color', color);
      slash.innerHTML = `
        <svg viewBox="0 0 100 100" fill="none">
          <path d="M 10 90 Q 50 45 90 10" stroke="${color}" stroke-width="7" stroke-linecap="round" />
          <path d="M 15 85 Q 50 48 85 15" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
        </svg>
      `;
      document.body.appendChild(slash);

      gsap.fromTo(slash,
        { scale: 0.5, opacity: 1, rotation: -20 },
        { scale: 1.3, opacity: 0, rotation: 15, duration: 0.24, ease: "power2.out", onComplete: () => slash.remove() }
      );
    },

    // 발톱 할퀴기 이펙트 (Claw Slash)
    createClawSlash(x, y, color = '#ef4444', scale = 1) {
      const claw = document.createElement('div');
      claw.className = 'attack-fx-claw';
      claw.style.left = x + 'px';
      claw.style.top = y + 'px';
      claw.innerHTML = `
        <svg viewBox="0 0 100 100" fill="none">
          <path d="M 20 20 L 70 80" stroke="${color}" stroke-width="5" stroke-linecap="round" />
          <path d="M 35 15 L 85 75" stroke="${color}" stroke-width="6" stroke-linecap="round" />
          <path d="M 50 10 L 95 65" stroke="${color}" stroke-width="5" stroke-linecap="round" />
        </svg>
      `;
      document.body.appendChild(claw);

      gsap.fromTo(claw,
        { scale: 0.4 * scale, opacity: 1 },
        { scale: 1.25 * scale, opacity: 0, duration: 0.22, ease: "power2.out", onComplete: () => claw.remove() }
      );
    },

    // 충격파 링 생성 (Shockwave Ring)
    createShockwave(x, y, color = '#ffffff') {
      const wave = document.createElement('div');
      wave.className = 'attack-fx-shockwave';
      wave.style.left = x + 'px';
      wave.style.top = y + 'px';
      wave.style.setProperty('--impact-color', color);
      document.body.appendChild(wave);

      gsap.fromTo(wave,
        { width: 10, height: 10, opacity: 0.9 },
        { width: 75, height: 75, opacity: 0, duration: 0.28, ease: "power2.out", onComplete: () => wave.remove() }
      );
    },

    // 피격 애니메이션 (물리 넉백 & 플래시 & 셰이크)
    animateHit(targetElem, pushX = 0, pushY = 0) {
      if (!window.gsap || !targetElem) return;
      const inner = targetElem.querySelector('.unit-inner') || targetElem;
      gsap.killTweensOf(inner);

      targetElem.classList.add('hit-recoil');

      gsap.timeline({
        onComplete: () => {
          targetElem.classList.remove('hit-recoil');
        }
      })
        // 공격 방향으로 밀려남 (Knockback Push)
        .to(inner, {
          x: pushX,
          y: pushY,
          duration: 0.07,
          ease: "power2.out"
        })
        // 찰지게 복귀 및 진동
        .to(inner, {
          x: -pushX * 0.4,
          y: -pushY * 0.4,
          duration: 0.07
        })
        .to(inner, {
          x: 0,
          y: 0,
          duration: 0.16,
          ease: "elastic.out(1, 0.4)"
        });
    },

    // 턴 전환 배너 (슬더스 스타일 대형 텍스트 슬라이드)
    showTurnBanner(mainText, subText = '', color = '#c59b4c') {
      return new Promise(resolve => {
        let banner = document.getElementById('turn-banner');
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'turn-banner';
          banner.className = 'turn-banner';
          document.body.appendChild(banner);
        }

        banner.innerHTML = `
          <div class="banner-box" style="border-color:${color}; box-shadow: 0 0 30px ${color}44;">
            <div class="banner-main" style="color:${color}">${mainText}</div>
            ${subText ? `<div class="banner-sub">${subText}</div>` : ''}
          </div>
        `;
        banner.style.display = 'flex';

        if (window.gsap) {
          gsap.timeline({
            onComplete: () => {
              banner.style.display = 'none';
              resolve();
            }
          })
            .fromTo(banner.querySelector('.banner-box'), 
              { scale: 0.7, opacity: 0, y: -20 }, 
              { scale: 1, opacity: 1, y: 0, duration: 0.22, ease: "back.out(1.5)" }
            )
            .to(banner.querySelector('.banner-box'), {
              opacity: 0,
              y: 20,
              duration: 0.18,
              delay: 0.45,
              ease: "power2.in"
            });
        } else {
          setTimeout(() => { banner.style.display = 'none'; resolve(); }, 600);
        }
      });
    },

    // 슬더스 스타일 베지어 타겟팅 화살표 그리기
    drawTargetingArrow(startElem, targetX, targetY) {
      if (!arrowSvg) initArrowLayer();
      if (!startElem) {
        arrowSvg.innerHTML = '';
        return;
      }

      const rect = startElem.getBoundingClientRect();
      const sx = rect.left + rect.width / 2;
      const sy = rect.top + 10;
      const tx = targetX;
      const ty = targetY;

      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.hypot(dx, dy);
      if (dist < 20) {
        arrowSvg.innerHTML = '';
        return;
      }

      const cx = (sx + tx) / 2 - dy * 0.2;
      const cy = Math.min(sy, ty) - Math.abs(dx) * 0.2 - 40;

      const numPoints = 16;
      let dotsHtml = '';
      let lastPoint = { x: sx, y: sy };

      for (let i = 1; i <= numPoints; i++) {
        const t = i / numPoints;
        const x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * tx;
        const y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ty;

        const radius = 2.5 + t * 4.5;
        const alpha = 0.4 + t * 0.6;

        if (i === numPoints) {
          const angle = Math.atan2(y - lastPoint.y, x - lastPoint.x) * (180 / Math.PI);
          dotsHtml += `
            <g transform="translate(${x}, ${y}) rotate(${angle})">
              <polygon points="0,-12 18,0 0,12 -4,0" fill="#e23c3c" filter="drop-shadow(0 0 6px #ff4444)" />
              <polygon points="2,-7 14,0 2,7 0,0" fill="#ffd470" />
            </g>
          `;
        } else {
          dotsHtml += `
            <circle cx="${x}" cy="${y}" r="${radius}" fill="#e84040" opacity="${alpha}" filter="drop-shadow(0 0 4px #ff3333)" />
            <circle cx="${x}" cy="${y}" r="${radius * 0.5}" fill="#ffe082" opacity="${alpha}" />
          `;
        }
        lastPoint = { x, y };
      }

      arrowSvg.innerHTML = `
        <defs>
          <filter id="arrow-glow">
            <feGaussianBlur stdDeviation="3" result="glow"/>
            <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        ${dotsHtml}
      `;
    },

    clearTargetingArrow() {
      if (arrowSvg) arrowSvg.innerHTML = '';
    },

    // 파티클 스파크 생성 헬퍼
    createSparkles(x, y, color = '#ffd700', count = 12) {
      if (!window.gsap) return;
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = `${x}px`;
      container.style.top = `${y}px`;
      container.style.pointerEvents = 'none';
      container.style.zIndex = '10001';
      document.body.appendChild(container);

      for (let i = 0; i < count; i++) {
        const dot = document.createElement('div');
        dot.style.position = 'absolute';
        dot.style.width = '5px';
        dot.style.height = '5px';
        dot.style.borderRadius = '50%';
        dot.style.backgroundColor = i % 2 === 0 ? color : '#ffffff';
        dot.style.boxShadow = `0 0 6px ${color}`;
        container.appendChild(dot);

        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 30 + Math.random() * 45;
        gsap.to(dot, {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          scale: 0,
          opacity: 0,
          duration: 0.35 + Math.random() * 0.2,
          ease: "power2.out"
        });
      }
      setTimeout(() => {
        if (container.parentNode) container.parentNode.removeChild(container);
      }, 600);
    },

    // 슬롯머신 출진 추첨 모션 (화면 중앙 짠! 짠! 짠!)
    showSlotMachine(selectedUnits, lockedUnit) {
      return new Promise(resolve => {
        if (!selectedUnits || !selectedUnits.length) return resolve();

        const modal = document.createElement('div');
        modal.id = 'slot-machine-modal';
        modal.className = 'slot-modal-backdrop';

        const classDict = (typeof CLASS_BY !== 'undefined' ? CLASS_BY : (window.CLASS_BY || {}));
        const nameFunc = (typeof uname === 'function' ? uname : (window.uname || null));
        const iconFunc = (typeof uicon === 'function' ? uicon : (window.uicon || null));
        const atkFunc = (typeof effAtk === 'function' ? effAtk : (window.effAtk || null));
        const allClasses = window.CLASSES || (typeof CLASSES !== 'undefined' ? CLASSES : []);

        const slotData = selectedUnits.slice(0, 3).map((u, idx) => {
          const isLocked = lockedUnit && u.cid === lockedUnit.cid;
          const cls = classDict[u.cid] || null;

          const name = u.resolvedName || (nameFunc ? nameFunc(u) : (u.promoted && cls && cls.promo ? cls.promo.name : (cls ? cls.name : (u.name || '영웅'))));
          const icon = u.resolvedIcon || (iconFunc ? iconFunc(u) : (cls ? cls.icon : (u.icon || '♟')));
          const theme = u.resolvedTheme || (cls ? cls.theme : '#ffd700');
          const atkVal = u.resolvedAtk != null ? u.resolvedAtk : (atkFunc ? atkFunc(u) : u.atk);

          // 회전 시 지나가는 더미 심볼 2개
          const otherClasses = allClasses.filter(c => c.id !== u.cid);
          const d1 = otherClasses.length ? otherClasses[Math.floor(Math.random() * otherClasses.length)] : { name: '전사', icon: '🛡️' };
          const d2 = otherClasses.length ? otherClasses[Math.floor(Math.random() * otherClasses.length)] : { name: '마법사', icon: '🔥' };

          return { u, name, icon, theme, isLocked: idx === 0 && isLocked, atkVal, dummy1: d1, dummy2: d2 };
        });

        modal.innerHTML = `
          <div class="slot-cabinet">
            <div class="slot-header">
              <div class="slot-title">🎰 턴 출진 룰렛 머신</div>
              <div class="slot-sub">이번 턴 행동 및 고유 카드를 행사할 정예 3기를 선발합니다</div>
            </div>

            <div class="slot-reels-row">
              ${slotData.map((s, i) => `
                <div class="slot-reel-box" id="reel-box-${i}" style="--slot-theme:${s.theme}">
                  <div class="reel-type-badge ${s.isLocked ? 'badge-locked' : 'badge-random'}">
                    ${s.isLocked ? '★ 확정 출진' : (i === 0 ? '🌟 지정 1번' : '🎲 룰렛 선발')}
                  </div>
                  <div class="reel-window">
                    <div class="reel-spinner" id="reel-spin-${i}">
                      <div class="reel-slot-content dummy-content">
                        <span class="slot-icon">${s.dummy1.icon}</span>
                        <span class="slot-name">${s.dummy1.name}</span>
                        <span class="slot-hp">🎰 회전 중</span>
                      </div>
                      <div class="reel-slot-content dummy-content">
                        <span class="slot-icon">${s.dummy2.icon}</span>
                        <span class="slot-name">${s.dummy2.name}</span>
                        <span class="slot-hp">🎰 회전 중</span>
                      </div>
                      <div class="reel-slot-content final-content">
                        <span class="slot-icon">${s.icon}</span>
                        <span class="slot-name">${s.name}</span>
                        <span class="slot-hp">❤️ ${s.u.hp} ⚔️ ${s.atkVal}</span>
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="slot-footer-msg" id="slot-status-msg">
              <span class="msg-spinner">⚙️ 룰렛 회전 중...</span>
            </div>
          </div>
        `;

        document.body.appendChild(modal);

        if (!window.gsap) {
          setTimeout(() => {
            if (modal.parentNode) modal.parentNode.removeChild(modal);
            resolve();
          }, 800);
          return;
        }

        const cabinet = modal.querySelector('.slot-cabinet');
        gsap.fromTo(cabinet, 
          { scale: 0.7, opacity: 0, y: -40 }, 
          { scale: 1, opacity: 1, y: 0, duration: 0.26, ease: "back.out(1.5)" }
        );

        if (window.Sound && Sound.slotSpin) Sound.slotSpin();

        const tl = gsap.timeline();

        // 3개 슬롯 순차적 짠! 짠! 짠! 정지 애니메이션 (스크롤 릴 연출)
        slotData.forEach((s, i) => {
          const delay = 0.22 + i * 0.35;
          const reelBox = modal.querySelector(`#reel-box-${i}`);
          const spinner = modal.querySelector(`#reel-spin-${i}`);

          // 위에서 아래로 릴이 회전하여 최종 슬롯 위치(-180px)에 정지
          gsap.fromTo(spinner,
            { y: 0, filter: "blur(4px)" },
            { y: -180, filter: "blur(0px)", duration: 0.38, delay: delay, ease: "back.out(1.8)" }
          );

          tl.call(() => {
            if (window.Sound) {
              if (i === slotData.length - 1) {
                if (Sound.slotJackpot) Sound.slotJackpot();
                else if (Sound.slotStop) Sound.slotStop(i);
              } else {
                if (Sound.slotStop) Sound.slotStop(i);
              }
            }

            reelBox.classList.add('revealed');
            gsap.fromTo(reelBox,
              { scale: 1.15, filter: `brightness(2) drop-shadow(0 0 18px ${s.theme})` },
              { scale: 1, filter: `drop-shadow(0 0 10px ${s.theme})`, duration: 0.25, ease: "power2.out" }
            );

            const rect = reelBox.getBoundingClientRect();
            FX.createSparkles(rect.left + rect.width / 2, rect.top + rect.height / 2, s.theme, 10);
          }, null, delay);
        });

        // 3개 슬롯 완료 후 메시지 갱신
        const finalDelay = 0.22 + (slotData.length - 1) * 0.35 + 0.35;
        tl.call(() => {
          const msg = modal.querySelector('#slot-status-msg');
          if (msg) {
            msg.innerHTML = `<span class="ready-banner">⚔️ 정예 3기 선발 완료! 카드가 지급됩니다.</span>`;
            gsap.fromTo(msg, { scale: 0.8, opacity: 0 }, { scale: 1.05, opacity: 1, duration: 0.2, ease: "back.out(2)" });
          }
        }, null, finalDelay);

        // 퇴장 모션
        tl.to(cabinet, {
          y: -40,
          scale: 0.9,
          opacity: 0,
          duration: 0.24,
          delay: 0.45,
          ease: "power2.in",
          onComplete: () => {
            if (modal.parentNode) modal.parentNode.removeChild(modal);
            resolve();
          }
        });
      });
    },

    // ===== 데우스 엑스 마키나 : 시간 제어 비주얼 이펙트 =====
    // 1) 시간 역행 (Rewind Warp) - 화면 왜곡 & 테이프 되감기 잔상 글리치
    showRewindWarp() {
      const warp = document.createElement('div');
      warp.className = 'rewind-warp-overlay';
      warp.innerHTML = `
        <div class="rewind-scanner"></div>
        <div class="rewind-text">⏪ TIME REWIND : 인과율 역행 중...</div>
      `;
      document.body.appendChild(warp);

      if (window.gsap) {
        gsap.timeline()
          .fromTo(warp, { opacity: 0, filter: 'invert(0.8) hue-rotate(180deg) blur(4px)' }, { opacity: 1, filter: 'invert(0) hue-rotate(0deg) blur(0px)', duration: 0.18 })
          .to(warp, { opacity: 0, duration: 0.22, delay: 0.15, onComplete: () => warp.remove() });
      } else {
        setTimeout(() => warp.remove(), 450);
      }
    },

    // 2) 시간 정지 (Time Stop Flash)
    showTimeStopFlash() {
      const flash = document.createElement('div');
      flash.className = 'time-stop-flash';
      document.body.appendChild(flash);
      if (window.gsap) {
        gsap.fromTo(flash, { opacity: 0.8, scale: 1 }, { opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: () => flash.remove() });
      } else {
        setTimeout(() => flash.remove(), 450);
      }
    },

    // 3) 시간 재개 (Time Resume Flash)
    showTimeResumeFlash() {
      const flash = document.createElement('div');
      flash.className = 'time-resume-flash';
      document.body.appendChild(flash);
      if (window.gsap) {
        gsap.fromTo(flash, { opacity: 0.7 }, { opacity: 0, duration: 0.35, ease: 'power2.out', onComplete: () => flash.remove() });
      } else {
        setTimeout(() => flash.remove(), 350);
      }
    }
  };
})();

if (typeof window !== 'undefined') {
  window.FX = FX;
}
