const revealElements = document.querySelectorAll('.reveal');
const revealOnScroll = () => {
    const windowHeight = window.innerHeight;
    const elementVisible = 50;
    revealElements.forEach((reveal) => {
        const elementTop = reveal.getBoundingClientRect().top;
        if (elementTop < windowHeight - elementVisible) {
            reveal.classList.add("active");
        }
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
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num;
}

function parseStatString(stat) {
    if (!stat) return 0;
    let val = parseFloat(stat) || 0;
    const statStr = String(stat).toUpperCase();
    if (statStr.includes('K')) val *= 1000;
    if (statStr.includes('M')) val *= 1000000;
    if (statStr.includes('B')) val *= 1000000000;
    return val;
}

async function fetchBatchStats(gamesList) {
    const workerUrl = 'https://roblox.fabidevgames.workers.dev/'; 
    if (workerUrl === 'YOUR_CLOUDFLARE_WORKER_URL_HERE') return;

    const gamesWithId = gamesList.filter(g => g.id);
    if (gamesWithId.length === 0) return;

    const universeIds = gamesWithId.map(g => g.id);
    let backupCCU = 0;
    let backupVisits = 0;
    
    gamesList.forEach(g => {
        backupCCU += parseStatString(g.ccu);
        backupVisits += parseStatString(g.visits);
    });

    const headerCCU = document.getElementById('total-ccu');
    const headerVisits = document.getElementById('total-visits');
    if(headerCCU) {
        headerCCU.classList.remove('skeleton-text');
        headerCCU.innerText = formatNumber(backupCCU);
    }
    if(headerVisits) {
        headerVisits.classList.remove('skeleton-text');
        headerVisits.innerText = formatNumber(backupVisits);
    }

    try {
        const statsUrl = `https://games.roblox.com/v1/games?universeIds=${universeIds.join(',')}`;
        const finalUrl = `${workerUrl}?url=${encodeURIComponent(statsUrl)}`;
        const statsRes = await fetch(finalUrl);
        if (!statsRes.ok) throw new Error();
        
        const statsData = await statsRes.json();
        const statsMap = {};
        if (statsData.data && Array.isArray(statsData.data)) {
            statsData.data.forEach(stat => statsMap[stat.id] = stat);
        }

        let totalCCU = 0;
        let totalVisits = 0;
        Object.values(statsMap).forEach(stat => {
            totalCCU += stat.playing;
            totalVisits += stat.visits;
        });
        
        if (totalCCU > 0 && headerCCU) headerCCU.innerText = formatNumber(totalCCU);
        if (totalVisits > 0 && headerVisits) headerVisits.innerText = formatNumber(totalVisits);

        gamesWithId.forEach(game => {
            const stats = statsMap[game.id];
            const cards = document.querySelectorAll(`[data-game-id="${game.id}"]`);
            cards.forEach(card => {
                if (stats) {
                    const titleEl = card.querySelector('.game-title');
                    if (titleEl && stats.name) titleEl.innerText = stats.name;
                    const ccuEl = card.querySelector('.live-ccu');
                    const visitsEl = card.querySelector('.live-visits');
                    if(ccuEl) {
                        ccuEl.classList.remove('skeleton-text');
                        ccuEl.innerText = formatNumber(stats.playing);
                    }
                    if(visitsEl) {
                        visitsEl.classList.remove('skeleton-text');
                        visitsEl.innerText = formatNumber(stats.visits);
                    }
                }
            });
        });
    } catch (err) {}

    try {
        const thumbUrl = `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeIds.join(',')}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`;
        const finalThumbUrl = `${workerUrl}?url=${encodeURIComponent(thumbUrl)}`;
        const thumbRes = await fetch(finalThumbUrl);
        if (!thumbRes.ok) throw new Error();
        
        const thumbData = await thumbRes.json();
        const thumbMap = {};
        if (thumbData.data && Array.isArray(thumbData.data)) {
            thumbData.data.forEach(t => {
                if(t.thumbnails && t.thumbnails.length > 0) {
                    thumbMap[t.universeId] = t.thumbnails[0].imageUrl;
                }
            });
        }

        gamesWithId.forEach(game => {
            const thumb = thumbMap[game.id];
            const cards = document.querySelectorAll(`[data-game-id="${game.id}"]`);
            cards.forEach(card => {
                if (thumb) {
                    const imgEl = card.querySelector('.game-img');
                    if(imgEl) {
                        const tempImg = new Image();
                        tempImg.src = thumb;
                        tempImg.onload = () => {
                            imgEl.classList.remove('skeleton');
                            imgEl.style.backgroundImage = `url('${thumb}')`;
                        };
                    }
                }
            });
        });
    } catch (err) {}
}

const setupCarousel = () => {
    const track = document.getElementById('carousel-track');
    const leftBtn = document.getElementById('btn-left');
    const rightBtn = document.getElementById('btn-right');
    
    if (!track) return;

    let items = Array.from(track.children);
    if (items.length === 0) return;

    let itemWidth = items[0].getBoundingClientRect().width + 24; 
    let currentIndex = items.length;
    let isTransitioning = false;

    items.forEach(item => {
        track.appendChild(item.cloneNode(true));
    });
    items.forEach(item => {
        track.insertBefore(item.cloneNode(true), track.firstChild);
    });

    track.style.transform = `translateX(-${currentIndex * itemWidth}px)`;

    const updateWidths = () => {
        if(track.children.length > 0) {
            itemWidth = track.children[0].getBoundingClientRect().width + 24;
            track.style.transition = 'none';
            track.style.transform = `translateX(-${currentIndex * itemWidth}px)`;
        }
    };
    window.addEventListener('resize', updateWidths);

    const slide = (direction) => {
        if (isTransitioning) return;
        isTransitioning = true;
        track.style.transition = 'transform 0.4s ease-in-out';
        
        if (direction === 'right') {
            currentIndex++;
        } else {
            currentIndex--;
        }
        track.style.transform = `translateX(-${currentIndex * itemWidth}px)`;
    };

    if (rightBtn) rightBtn.addEventListener('click', () => slide('right'));
    if (leftBtn) leftBtn.addEventListener('click', () => slide('left'));

    track.addEventListener('transitionend', () => {
        isTransitioning = false;
        
        if (currentIndex <= 0) {
            track.style.transition = 'none';
            currentIndex = items.length;
            track.style.transform = `translateX(-${currentIndex * itemWidth}px)`;
        }
        
        if (currentIndex >= track.children.length - items.length) {
            track.style.transition = 'none';
            currentIndex = items.length;
            track.style.transform = `translateX(-${currentIndex * itemWidth}px)`;
        }
    });

    let isDragging = false;
    let startPos = 0;
    let currentTranslate = 0;

    track.addEventListener('mousedown', (e) => {
        if (isTransitioning) return;
        isDragging = true;
        startPos = e.pageX;
        track.classList.add('active');
        const matrix = window.getComputedStyle(track).transform;
        if (matrix !== 'none') {
            currentTranslate = parseInt(matrix.split(',')[4].trim());
        }
        track.style.transition = 'none';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const currentPosition = e.pageX;
        const diff = currentPosition - startPos;
        track.style.transform = `translateX(${currentTranslate + diff}px)`;
    });

    window.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        track.classList.remove('active');
        
        const endPos = e.pageX;
        const diff = endPos - startPos;
        
        if (Math.abs(diff) > 100) {
            if (diff > 0) slide('left');
            else slide('right');
        } else {
            track.style.transition = 'transform 0.3s ease-in-out';
            track.style.transform = `translateX(-${currentIndex * itemWidth}px)`;
        }
    });

    track.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            track.classList.remove('active');
            track.style.transition = 'transform 0.3s ease-in-out';
            track.style.transform = `translateX(-${currentIndex * itemWidth}px)`;
        }
    });
};

fetch('assets/data.json')
    .then(response => response.json())
    .then(async data => {
        data.games.sort((a, b) => {
            const ccuA = parseStatString(a.ccu);
            const ccuB = parseStatString(b.ccu);
            if (ccuA !== ccuB) return ccuB - ccuA;
            const visitsA = parseStatString(a.visits);
            const visitsB = parseStatString(b.visits);
            return visitsB - visitsA;
        });
        
        const jobContainer = document.getElementById('job-container');
        if (data.config?.showJobs && data.currentJobs && data.currentJobs.length > 0) {
            data.currentJobs.forEach(job => {
                const jobCard = document.createElement('div');
                jobCard.className = 'job-card';
                jobCard.innerHTML = `
                    <img src="${job.icon}" alt="Icon" class="job-icon">
                    <div class="job-info">
                        <div class="job-label">Associated With</div>
                        <div class="job-name">${job.studioName}</div>
                        <div class="job-role">${job.position}</div>
                    </div>
                `;
                jobContainer.appendChild(jobCard);
            });
        }

        const track = document.getElementById('carousel-track');
        data.games.forEach(game => {
            const card = document.createElement('a');
            card.href = game.link;
            card.target = "_blank";
            card.className = 'game-card';
            card.setAttribute('data-game-id', game.id);
            card.innerHTML = `
                <div class="game-img skeleton"></div>
                <div class="game-overlay">
                    <h4 class="game-title">${game.title}</h4>
                    <div class="game-stats-overlay">
                        <span class="stat-item">
                            <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                            <span class="live-ccu skeleton-text">0000</span>
                        </span>
                        <span class="stat-item">
                            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            <span class="live-visits skeleton-text">000000</span>
                        </span>
                    </div>
                </div>
            `;
            track.appendChild(card);
        });

        setupCarousel();
        await fetchBatchStats(data.games);
    })
    .catch(err => console.error(err));