const revealElements = document.querySelectorAll('.reveal');
const revealOnScroll = () => {
    const windowHeight = window.innerHeight;
    revealElements.forEach((reveal) => {
        const elementTop = reveal.getBoundingClientRect().top;
        if (elementTop < windowHeight - 50) reveal.classList.add("active");
    });
};
window.addEventListener("scroll", revealOnScroll);
revealOnScroll();

const counters = document.querySelectorAll('.stat-number, .stat-counter-large');
let started = false;
const startCounting = () => {
    counters.forEach(counter => {
        const targetAttr = counter.getAttribute('data-target');
        if (!targetAttr) return;
        const target = parseFloat(targetAttr);
        const suffix = targetAttr.replace(/[0-9.]/g, ''); 
        const speed = 100;
        const updateCount = () => {
            const currentText = counter.innerText.replace(suffix, ''); 
            const count = +currentText || 0;
            const inc = target / speed;
            if (count < target) {
                counter.innerText = Math.ceil(count + inc) + suffix;
                setTimeout(updateCount, 20);
            } else {
                counter.innerText = targetAttr;
            }
        };
        updateCount();
    });
};

const statsSection = document.getElementById('stats');
if(statsSection) {
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !started) {
            startCounting();
            started = true;
        }
    });
    observer.observe(statsSection);
}

function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return num;
}

function parseStatString(stat) {
    if (!stat) return 0;
    let val = parseFloat(stat) || 0;
    const s = String(stat).toUpperCase();
    if (s.includes('K')) val *= 1e3;
    if (s.includes('M')) val *= 1e6;
    if (s.includes('B')) val *= 1e9;
    return val;
}

async function fetchBatchStats(gamesList) {
    const workerUrl = 'https://roblox.fabidevgames.workers.dev/'; 
    if (workerUrl === 'YOUR_CLOUDFLARE_WORKER_URL_HERE') return;

    const gamesWithId = gamesList.filter(g => g.id);
    if (gamesWithId.length === 0) return;

    const universeIds = gamesWithId.map(g => g.id);
    let backupCCU = 0, backupVisits = 0;
    gamesList.forEach(g => { backupCCU += parseStatString(g.ccu); backupVisits += parseStatString(g.visits); });

    const hCCU = document.getElementById('total-ccu'), hVis = document.getElementById('total-visits');
    if(hCCU) { hCCU.classList.remove('skeleton-text'); hCCU.innerText = formatNumber(backupCCU); }
    if(hVis) { hVis.classList.remove('skeleton-text'); hVis.innerText = formatNumber(backupVisits); }

    try {
        const url = `${workerUrl}?url=${encodeURIComponent(`https://games.roblox.com/v1/games?universeIds=${universeIds.join(',')}`)}`;
        const res = await fetch(url);
        const data = await res.json();
        const map = {};
        if (data.data) data.data.forEach(s => map[s.id] = s);

        let tCCU = 0, tVis = 0;
        Object.values(map).forEach(s => { tCCU += s.playing; tVis += s.visits; });
        if (tCCU > 0 && hCCU) hCCU.innerText = formatNumber(tCCU);
        if (tVis > 0 && hVis) hVis.innerText = formatNumber(tVis);

        gamesWithId.forEach(game => {
            const s = map[game.id];
            const cards = document.querySelectorAll(`[data-game-id="${game.id}"]`);
            cards.forEach(card => {
                if (s) {
                    const t = card.querySelector('.game-title'), c = card.querySelector('.live-ccu'), v = card.querySelector('.live-visits');
                    if (t && s.name) t.innerText = s.name;
                    if (c) { c.classList.remove('skeleton-text'); c.innerText = formatNumber(s.playing); }
                    if (v) { v.classList.remove('skeleton-text'); v.innerText = formatNumber(s.visits); }
                }
            });
        });

        const thumbUrl = `${workerUrl}?url=${encodeURIComponent(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeIds.join(',')}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`)}`;
        const tRes = await fetch(thumbUrl);
        const tData = await tRes.json();
        const tMap = {};
        if (tData.data) tData.data.forEach(t => { if(t.thumbnails[0]) tMap[t.universeId] = t.thumbnails[0].imageUrl; });

        gamesWithId.forEach(game => {
            const img = tMap[game.id];
            const cards = document.querySelectorAll(`[data-game-id="${game.id}"]`);
            cards.forEach(card => {
                const el = card.querySelector('.game-img');
                if (img && el) {
                    const tmp = new Image(); tmp.src = img;
                    tmp.onload = () => { el.classList.remove('skeleton'); el.style.backgroundImage = `url('${img}')`; };
                }
            });
        });
    } catch (e) {}
}

const setupCarousel = () => {
    const track = document.getElementById('carousel-track');
    const leftBtn = document.getElementById('btn-left'), rightBtn = document.getElementById('btn-right');
    const viewport = document.getElementById('games-grid');
    if (!track || track.children.length === 0) return;

    const originalLength = track.children.length;
    const cards = Array.from(track.children);
    cards.forEach(c => track.appendChild(c.cloneNode(true)));
    cards.forEach(c => track.appendChild(c.cloneNode(true)));
    
    let isDragging = false, startX, scrollL, autoTimer, resumeTimer;

    const getUnit = () => track.children[0].offsetWidth + 20;
    const getBaseWidth = () => getUnit() * originalLength;

    viewport.scrollLeft = getBaseWidth();

    const checkInfinite = () => {
        const w = getBaseWidth();
        if (viewport.scrollLeft <= 0) viewport.scrollLeft = w;
        else if (viewport.scrollLeft >= w * 2) viewport.scrollLeft = w;
    };

    viewport.addEventListener('scroll', checkInfinite);

    const startAuto = () => {
        clearInterval(autoTimer);
        autoTimer = setInterval(() => {
            viewport.scrollBy({ left: 1, behavior: 'auto' });
        }, 30);
    };

    const stopAuto = () => {
        clearInterval(autoTimer);
        clearTimeout(resumeTimer);
    };

    const requestResume = () => {
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(startAuto, 5000);
    };

    startAuto();

    const start = (e) => {
        stopAuto();
        isDragging = true; track.classList.add('active');
        startX = (e.pageX || e.touches[0].pageX) - viewport.offsetLeft;
        scrollL = viewport.scrollLeft;
    };

    const end = () => {
        if (!isDragging) return;
        isDragging = false; track.classList.remove('active');
        requestResume();
    };

    const move = (e) => {
        if (!isDragging) return;
        const x = (e.pageX || e.touches[0].pageX) - viewport.offsetLeft;
        viewport.scrollLeft = scrollL - (x - startX);
    };

    viewport.addEventListener('mousedown', start);
    viewport.addEventListener('touchstart', start, {passive: true});
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
    window.addEventListener('mousemove', move);
    viewport.addEventListener('touchmove', move, {passive: true});

    leftBtn.onclick = () => { stopAuto(); viewport.scrollBy({ left: -getUnit(), behavior: 'smooth' }); requestResume(); };
    rightBtn.onclick = () => { stopAuto(); viewport.scrollBy({ left: getUnit(), behavior: 'smooth' }); requestResume(); };
};

fetch('assets/data.json').then(r => r.json()).then(async d => {
    d.games.sort((a, b) => (parseStatString(b.ccu) - parseStatString(a.ccu)) || (parseStatString(b.visits) - parseStatString(a.visits)));
    const jobs = document.getElementById('job-container');
    if (d.config?.showJobs && d.currentJobs) {
        d.currentJobs.forEach(j => {
            const card = document.createElement(j.link ? 'a' : 'div');
            card.className = 'job-card';
            if (j.link) { card.href = j.link; card.target = "_blank"; }
            card.innerHTML = `<img src="${j.icon}" class="job-icon"><div class="job-info"><div class="job-label">Associated With</div><div class="job-name">${j.studioName}</div><div class="job-role">${j.position}</div></div>`;
            jobs.appendChild(card);
        });
    }
    const track = document.getElementById('carousel-track');
    d.games.forEach(g => {
        const card = document.createElement('a');
        card.href = g.link; card.target = "_blank"; card.className = 'game-card'; card.setAttribute('data-game-id', g.id);
        card.innerHTML = `<div class="game-img skeleton"></div><div class="game-overlay"><h4 class="game-title">${g.title}</h4><div class="game-stats-overlay"><span class="stat-item"><svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg><span class="live-ccu skeleton-text">0000</span></span><span class="stat-item"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg><span class="live-visits skeleton-text">000000</span></span></div></div>`;
        track.appendChild(card);
    });
    setupCarousel();
    await fetchBatchStats(d.games);
});