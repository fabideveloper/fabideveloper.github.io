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

window.addEventListener('scroll', () => {
    const bg1 = document.getElementById('bg1');
    if(bg1) {
        const scrollPos = window.scrollY;
        const height = window.innerHeight;
        let opacity = 1 - (scrollPos / height);
        if(opacity < 0) opacity = 0;
        bg1.style.opacity = opacity;
    }
});

const statsSection = document.getElementById('stats');
const counters = document.querySelectorAll('.stat-number');
let started = false;

const startCounting = () => {
    counters.forEach(counter => {
        const rawTarget = counter.getAttribute('data-target');
        const target = parseFloat(rawTarget);
        const suffix = rawTarget.replace(/[0-9.]/g, ''); 
        const speed = 100;

        const updateCount = () => {
            const currentText = counter.innerText.replace(suffix, ''); 
            const count = +currentText || 0;
            const inc = target / speed;

            if (count < target) {
                counter.innerText = Math.ceil(count + inc);
                setTimeout(updateCount, 20);
            } else {
                counter.innerText = rawTarget;
            }
        };
        updateCount();
    });
};

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

async function fetchBatchStats(gamesList) {
    // PASTE YOUR CLOUDFLARE WORKER URL BELOW
    const workerUrl = 'https://roblox.fabidevgames.workers.dev/'; 

    if (workerUrl === 'YOUR_CLOUDFLARE_WORKER_URL_HERE') {
        console.warn("Update workerUrl in main.js");
        return;
    }

    const gamesWithId = gamesList.filter(g => g.id);
    if (gamesWithId.length === 0) return;

    const universeIds = gamesWithId.map(g => g.id);
    
    let backupCCU = 0;
    let backupVisits = 0;
    
    gamesList.forEach(g => {
        let ccu = parseFloat(g.ccu) || 0;
        let vis = parseFloat(g.visits) || 0;
        if(g.ccu && g.ccu.includes('K')) ccu *= 1000;
        if(g.ccu && g.ccu.includes('M')) ccu *= 1000000;
        if(g.visits && g.visits.includes('K')) vis *= 1000;
        if(g.visits && g.visits.includes('M')) vis *= 1000000;
        backupCCU += ccu;
        backupVisits += vis;
    });

    const headerCCU = document.getElementById('total-ccu');
    const headerVisits = document.getElementById('total-visits');
    if(headerCCU) headerCCU.innerText = formatNumber(backupCCU);
    if(headerVisits) headerVisits.innerText = formatNumber(backupVisits);

    try {
        const statsUrl = `https://games.roblox.com/v1/games?universeIds=${universeIds.join(',')}`;
        const finalUrl = `${workerUrl}?url=${encodeURIComponent(statsUrl)}`;
        
        const statsRes = await fetch(finalUrl);
        if (!statsRes.ok) throw new Error(`Proxy Error: ${statsRes.status}`);
        
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
            const card = document.getElementById(`game-card-${game.id}`);

            if (card && stats) {
                const titleEl = card.querySelector('.game-title-overlay');
                if (titleEl && stats.name) titleEl.innerText = stats.name;

                const ccuEl = card.querySelector('.live-ccu');
                const visitsEl = card.querySelector('.live-visits');
                
                if(ccuEl) {
                    ccuEl.style.opacity = 0;
                    setTimeout(() => { ccuEl.innerText = formatNumber(stats.playing); ccuEl.style.opacity = 1; }, 200);
                }
                if(visitsEl) {
                    visitsEl.style.opacity = 0;
                    setTimeout(() => { visitsEl.innerText = formatNumber(stats.visits); visitsEl.style.opacity = 1; }, 200);
                }
            }
        });
    } catch (err) {
        console.warn(err);
    }

    try {
        const thumbUrl = `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeIds.join(',')}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`;
        const finalThumbUrl = `${workerUrl}?url=${encodeURIComponent(thumbUrl)}`;
        
        const thumbRes = await fetch(finalThumbUrl);
        if (!thumbRes.ok) throw new Error("Thumbnail fetch failed");
        
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
            const card = document.getElementById(`game-card-${game.id}`);
            if (card && thumb) {
                const imgEl = card.querySelector('.game-img');
                if(imgEl) {
                    const tempImg = new Image();
                    tempImg.src = thumb;
                    tempImg.onload = () => {
                        imgEl.style.backgroundImage = `url('${thumb}')`;
                    };
                }
            }
        });
    } catch (err) {
        console.warn(err);
    }
}

fetch('assets/data.json')
    .then(response => response.json())
    .then(data => {
        
        const jobContainer = document.getElementById('job-container');
        if (data.config?.showJobs && data.currentJobs.length > 0) {
            jobContainer.style.display = 'flex';
            data.currentJobs.forEach(job => {
                const jobCard = document.createElement('div');
                jobCard.className = 'job-card';
                jobCard.innerHTML = `
                    <img src="${job.icon}" alt="Icon" class="job-icon">
                    <div class="job-info">
                        <div class="job-label">Associated With:</div>
                        <div class="job-name">${job.studioName}</div>
                        <div class="job-role">${job.position}</div>
                    </div>
                `;
                jobContainer.appendChild(jobCard);
            });
        }

        const gamesContainer = document.getElementById('games-grid');
        data.games.forEach(game => {
            const card = document.createElement('div');
            card.className = 'glass-card game-card';
            card.id = `game-card-${game.id}`; 
            
            card.innerHTML = `
                <div class="game-img" style="background-image: url('${game.image}')">
                    <div class="game-overlay">
                        <h4 class="game-title-overlay">${game.title}</h4>
                        <div class="game-stats">
                            <div class="stat-item" title="Concurrent Users">
                                <svg class="stat-icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                                <span class="live-ccu">${game.ccu || '0'}</span>
                            </div>
                            <div class="stat-item" title="Total Visits">
                                <svg class="stat-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                <span class="live-visits">${game.visits || '0'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-content">
                    <span class="role-tag">${game.role}</span>
                    <p>${game.description}</p>
                    <a href="${game.link}" target="_blank" class="card-link">Play ↗</a>
                </div>
            `;
            gamesContainer.appendChild(card);
        });

        const codeContainer = document.getElementById('code-grid');
        data.code.forEach(project => {
            const card = document.createElement('div');
            card.className = 'glass-card code-card';
            const formattedCode = project.snippet.join('\n');
            card.innerHTML = `
                <div class="card-content">
                    <div class="code-header">
                        <h4>${project.title}</h4>
                        <span class="lang-tag">${project.language}</span>
                    </div>
                    <p>${project.description}</p>
                    <div class="code-preview">
                        <pre><code class="language-lua">${formattedCode}</code></pre>
                    </div>
                </div>
            `;
            codeContainer.appendChild(card);
        });

        if(window.Prism) Prism.highlightAll();

        fetchBatchStats(data.games);
    })
    .catch(err => console.error(err));

const yearSpan = document.getElementById('year');
if (yearSpan) {
    yearSpan.innerText = new Date().getFullYear();
}
