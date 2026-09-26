window.fdReady = true;
document.documentElement.setAttribute('data-js', '');

const RAIL_QUERY = '(min-width: 64rem) and (min-height: 46rem)';
const WORKER = 'https://roblox.fabidevgames.workers.dev/';
const POLL_MS = 60000;
const TIMEOUT_MS = 8000;

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = () => motionQuery.matches;

const fullNumber = (value) => value.toLocaleString('en-US');
const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact' }).format;

const viaWorker = (url) => `${WORKER}?url=${encodeURIComponent(url)}`;
const gamesUrl = (ids) => `https://games.roblox.com/v1/games?universeIds=${ids.join(',')}`;
const thumbnailsUrl = (ids) => `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${ids.join(',')}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`;

function cubicBezier(x1, y1, x2, y2) {
    const curve = (a1, a2, t) => ((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t * t + 3 * a1 * t;
    return (x) => {
        let low = 0;
        let high = 1;
        let t = x;
        for (let i = 0; i < 24; i++) {
            t = (low + high) / 2;
            if (curve(x1, x2, t) < x) low = t;
            else high = t;
        }
        return curve(y1, y2, t);
    };
}

const easeBrake = cubicBezier(0.16, 1, 0.3, 1);

async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

function paintDigits(element, text, previous) {
    const offset = previous == null ? 0 : text.length - previous.length;
    element.replaceChildren(...Array.from(text, (char, index) => {
        const cell = document.createElement('span');
        const glyph = document.createElement('span');
        cell.className = 'dg';
        glyph.textContent = char;
        if (previous != null && previous[index - offset] !== char && !reducedMotion()) glyph.className = 'dg-in';
        cell.append(glyph);
        return cell;
    }));
}

function countUp(element, target, format) {
    if (reducedMotion() || target === 0) {
        paintDigits(element, format(target));
        return;
    }
    const start = performance.now();
    const step = (now) => {
        const progress = Math.min(1, (now - start) / 900);
        if (progress < 1) {
            element.textContent = format(Math.round(target * easeBrake(progress)));
            requestAnimationFrame(step);
        } else {
            paintDigits(element, format(target));
        }
    };
    requestAnimationFrame(step);
}

function liveNumber(element, format, textElement) {
    let shown = null;
    return {
        set(value) {
            const text = format(value);
            if (textElement) textElement.textContent = text;
            if (!element) return text;
            if (shown == null) countUp(element, value, format);
            else if (text !== shown) paintDigits(element, text, shown);
            shown = text;
            return text;
        },
    };
}

function setYear() {
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
}

function initMenu() {
    const bar = document.querySelector('.bar');
    const button = document.querySelector('.bar-menu');
    const sheet = document.getElementById('menu');
    if (!bar || !button || !sheet) return;

    let closeTimer = 0;
    const isOpen = () => button.getAttribute('aria-expanded') === 'true';

    function open() {
        clearTimeout(closeTimer);
        sheet.hidden = false;
        sheet.inert = false;
        button.setAttribute('aria-expanded', 'true');
        sheet.getBoundingClientRect();
        sheet.classList.add('is-open');
        sheet.querySelector('a')?.focus();
    }

    function close({ returnFocus = false } = {}) {
        if (!isOpen()) return;
        button.setAttribute('aria-expanded', 'false');
        sheet.classList.remove('is-open');
        if (returnFocus) button.focus();
        closeTimer = setTimeout(() => {
            sheet.inert = true;
            sheet.hidden = true;
        }, reducedMotion() ? 0 : 150);
    }

    button.addEventListener('click', () => (isOpen() ? close() : open()));
    sheet.addEventListener('click', (event) => {
        if (event.target.closest('a')) close();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isOpen()) close({ returnFocus: true });
    });
    document.addEventListener('pointerdown', (event) => {
        if (isOpen() && !bar.contains(event.target)) close();
    });
    bar.addEventListener('focusout', (event) => {
        if (isOpen() && event.relatedTarget && !bar.contains(event.relatedTarget)) close();
    });
    matchMedia(RAIL_QUERY).addEventListener('change', (event) => {
        if (event.matches) close();
    });
}

function initScrollspy() {
    const links = [...document.querySelectorAll('[data-spy]')];
    const sections = [...document.querySelectorAll('main > section, body > footer')];
    if (!links.length || !('IntersectionObserver' in window)) return;

    const spyId = (section) => (section.tagName === 'FOOTER' ? 'contact' : section.id);

    function setCurrent(id) {
        for (const link of links) {
            if (link.dataset.spy === id) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
        }
    }

    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) setCurrent(spyId(entry.target));
        }
    }, { rootMargin: '-45% 0px -54% 0px' });

    sections.forEach((section) => observer.observe(section));
}

function createRevealer() {
    const reveal = (element) => element.setAttribute('data-revealed', '');
    const observer = 'IntersectionObserver' in window
        ? new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                reveal(entry.target);
                observer.unobserve(entry.target);
            }
        }, { rootMargin: '0px 0px -10% 0px' })
        : null;

    document.addEventListener('focusin', (event) => {
        const target = event.target.closest?.('[data-reveal]');
        if (target) reveal(target);
    });

    return {
        watch(elements) {
            for (const element of elements) {
                if (observer) observer.observe(element);
                else reveal(element);
            }
        },
    };
}

const revealer = createRevealer();

function initCounters() {
    const strip = document.querySelector('.counters');
    if (!strip) return;

    for (const number of strip.querySelectorAll('.counter-digits')) {
        const digits = [...number.textContent.trim()];
        number.replaceChildren(...digits.map((digit, index) => {
            const frame = document.createElement('span');
            const column = document.createElement('span');
            frame.className = 'odo';
            column.className = 'odo-col';
            column.style.setProperty('--d', digit);
            column.style.setProperty('--delay', `${index * 80}ms`);
            for (let value = 0; value <= 9; value++) {
                const row = document.createElement('span');
                row.textContent = value;
                column.append(row);
            }
            frame.append(column);
            return frame;
        }));
    }

    if (reducedMotion() || !('IntersectionObserver' in window)) {
        strip.classList.add('is-counted');
        return;
    }
    const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        strip.classList.add('is-counted');
        observer.disconnect();
    }, { threshold: 0.5 });
    observer.observe(strip);
}

function initLive(games,{ onFirst = () => {}, onUpdate = () => {}, onFail = () => {} } = {}) {
    const ids = games.map((game) => game.id).filter(Boolean);
    const body = document.body;
    const readouts = [...document.querySelectorAll('.readout')];
    const heroLive = document.querySelector('.hero__live');
    const heroCount = document.querySelector('.hero__count');
    const people = document.querySelector('[data-people]');
    const stamp = document.querySelector('[data-stamp]');
    const liveParts = [heroLive, document.querySelector('.hero__stat'), document.querySelector('.hero__stamp'), ...readouts].filter(Boolean);

    const heroNumber = liveNumber(document.querySelector('[data-readout="full"]'), fullNumber, document.querySelector('[data-readout-text]'));
    const railNumbers = [...document.querySelectorAll('[data-readout="compact"]')].map((element) => liveNumber(element, compactNumber, element.nextElementSibling));
    const visitsNumber = liveNumber(document.querySelector('[data-visits]'), compactNumber, document.querySelector('[data-visits-text]'));
    const latest = new Map();

    let paused = false;
    let polling = false;
    let lastFetch = 0;

    async function fetchStats() {
        const json = await fetchJson(viaWorker(gamesUrl(ids)));
        const stats = new Map();
        for (const game of json.data ?? []) {
            stats.set(String(game.id), { playing: Number(game.playing) || 0, visits: Number(game.visits) || 0 });
        }
        if (!stats.size) throw new Error('The games response had no data');
        lastFetch = Date.now();
        return stats;
    }

    function render(stats) {
        for (const [id, stat] of stats) latest.set(id, stat);
        let playing = 0;
        let visits = 0;
        for (const stat of latest.values()) {
            playing += stat.playing;
            visits += stat.visits;
        }
        const text = heroNumber.set(playing);
        if (heroCount) {
            heroCount.classList.remove('is-pending');
            heroCount.style.minWidth = `calc(${text.length} * (1ch - .04em) + .56em)`;
        }
        if (people) people.textContent = playing === 1 ? 'person is' : 'people are';
        railNumbers.forEach((number) => number.set(playing));
        visitsNumber.set(visits);
        if (stamp) {
            const now = new Date();
            stamp.dateTime = now.toISOString();
            stamp.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    }

    function fail(error) {
        console.warn('Live Roblox numbers are unavailable, showing the page without them.', error);
        body.dataset.live = 'failed';
        liveParts.forEach((part) => part.classList.add('is-gone'));
        onFail(error);
    }

    async function poll() {
        if (polling || paused || body.dataset.live !== 'ok' || document.visibilityState !== 'visible') return;
        polling = true;
        const stats = await fetchStats().catch(() => null);
        polling = false;
        if (!stats || paused) return;
        render(stats);
        onUpdate(stats);
    }

    function setPaused(value) {
        paused = value;
        for (const readout of readouts) {
            readout.setAttribute('aria-pressed', String(value));
            readout.querySelector('.readout-state').textContent = value ? 'Paused' : 'Live';
        }
        if (!value && Date.now() - lastFetch >= POLL_MS) poll();
    }

    readouts.forEach((readout) => readout.addEventListener('click', () => setPaused(!paused)));
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastFetch >= POLL_MS) poll();
    });

    if (!ids.length) {
        fail(new Error('data.json lists no games with an id'));
        return;
    }

    fetchStats().then((stats) => {
        body.dataset.live = 'ok';
        heroLive?.removeAttribute('aria-hidden');
        render(stats);
        onFirst(stats);
        setInterval(poll, POLL_MS);
    }, fail);
}

const CARD_HTML = `
    <div class="reel-thumb"><span class="reel-loading">Loading</span><span class="reel-chip" aria-hidden="true"></span></div>
    <div class="reel-body">
        <h3 class="reel-title fd-head"><span class="reel-name"></span> <span class="fd-arrow" aria-hidden="true">↗</span></h3>
        <div class="reel-num is-pending" aria-hidden="true">
            <span class="reel-playing digits">···</span>
            <span class="reel-state">Playing</span>
            <span class="reel-visits"><span class="digits">···</span> visits</span>
        </div>
    </div>
    <p class="reel-line"></p>
    <span class="sr-only reel-sr"></span>`;

const twoDigits = (value) => String(value).padStart(2, '0');

function createCard(game, index) {
    const id = `game-${index + 1}`;
    const item = document.createElement('li');
    const card = document.createElement('a');
    item.className = 'reel-item fd-tile';
    card.className = 'reel-card';
    card.innerHTML = CARD_HTML;
    card.draggable = false;
    card.dataset.gameId = game.id;
    if (game.link) {
        card.href = game.link;
        card.target = '_blank';
        card.rel = 'noopener';
    }

    const title = card.querySelector('.reel-title');
    const line = card.querySelector('.reel-line');
    const sr = card.querySelector('.reel-sr');
    title.id = `${id}-title`;
    line.id = `${id}-line`;
    sr.id = `${id}-stats`;
    card.querySelector('.reel-name').textContent = game.title;
    line.textContent = [game.role, game.description].map((part) => (part || '').trim()).filter(Boolean).join(' · ');
    card.setAttribute('aria-labelledby', title.id);
    card.setAttribute('aria-describedby', `${sr.id} ${line.id}`);
    item.append(card);

    return {
        game,
        item,
        card,
        sr,
        stat: null,
        thumb: card.querySelector('.reel-thumb'),
        chip: card.querySelector('.reel-chip'),
        num: card.querySelector('.reel-num'),
        playing: liveNumber(card.querySelector('.reel-playing'), fullNumber),
        visits: liveNumber(card.querySelector('.reel-visits .digits'), compactNumber),
    };
}

function initReel(games) {
    const reel = document.querySelector('.reel');
    const track = reel?.querySelector('.reel-track');
    const wrap = reel?.querySelector('.reel-wrap');
    const slot = reel?.querySelector('.reel-slot');
    const meta = document.querySelector('.work-meta');
    const controls = document.querySelector('.reel-controls');
    if (!reel || !track || !controls || !games.length) {
        controls?.remove();
        return null;
    }

    const cards = games.map(createCard);
    let order = cards.slice();
    track.replaceChildren(...order.map((entry) => entry.item));

    const count = controls.querySelector('.reel-count');
    const indexText = controls.querySelector('[data-reel-index]');
    const status = controls.querySelector('[data-reel-status]');
    const pauseButton = controls.querySelector('[data-reel="pause"]');
    controls.querySelector('[data-reel-total]').textContent = twoDigits(cards.length);

    let active = 0;
    let paused = false;
    let hovering = false;
    let focused = false;
    let onScreen = false;
    let holdUntil = 0;
    let drag = null;
    let suppressClickUntil = 0;
    let statusTimer = 0;

    const behavior = () => (reducedMotion() ? 'auto' : 'smooth');
    const indexOf = (card) => order.findIndex((entry) => entry.card === card);
    const centerLeft = (item) => item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2;

    function rank() {
        order.forEach((entry, index) => {
            entry.chip.textContent = `#${twoDigits(index + 1)}`;
            entry.item.style.setProperty('--i', index);
            entry.item.style.setProperty('--d', `${(index % 3) * 70}ms`);
        });
    }

    function setActive(index) {
        if (index < 0) return;
        active = index;
        order.forEach((entry, position) => entry.card.classList.toggle('is-active', position === index));
        indexText.textContent = twoDigits(index + 1);
        clearTimeout(statusTimer);
        statusTimer = setTimeout(() => {
            const text = `Game ${active + 1} of ${order.length}`;
            if (status.textContent !== text) status.textContent = text;
        }, 400);
    }

    function goTo(index, scroll = behavior()) {
        const total = order.length;
        const target = order[((index % total) + total) % total];
        track.scrollTo({ left: centerLeft(target.item), behavior: scroll });
    }

    function nearestIndex() {
        const center = track.scrollLeft + track.clientWidth / 2;
        let best = 0;
        let bestDistance = Infinity;
        order.forEach((entry, index) => {
            const distance = Math.abs(entry.item.offsetLeft + entry.item.offsetWidth / 2 - center);
            if (distance < bestDistance) {
                best = index;
                bestDistance = distance;
            }
        });
        return best;
    }

    function hold() {
        holdUntil = Date.now() + 10000;
        count.setAttribute('aria-live', 'polite');
    }

    function setPaused(value) {
        paused = value;
        pauseButton.textContent = value ? 'Play' : 'Pause';
        pauseButton.setAttribute('aria-label', value ? 'Play game reel' : 'Pause game reel');
        count.setAttribute('aria-live', value ? 'polite' : 'off');
    }

    function advance() {
        if (paused || hovering || focused || drag || !onScreen || document.hidden || Date.now() < holdUntil) return;
        count.setAttribute('aria-live', 'off');
        goTo(active + 1);
    }

    rank();
    setActive(0);
    setPaused(reducedMotion());

    controls.querySelector('[data-reel="prev"]').addEventListener('click', () => {
        hold();
        goTo(active - 1);
    });
    controls.querySelector('[data-reel="next"]').addEventListener('click', () => {
        hold();
        goTo(active + 1);
    });
    pauseButton.addEventListener('click', () => setPaused(!paused));

    const activeObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) setActive(indexOf(entry.target));
        }
    }, { root: track, rootMargin: '0px -45% 0px -45%' });
    cards.forEach((entry) => activeObserver.observe(entry.card));

    new IntersectionObserver(([entry]) => {
        onScreen = entry.intersectionRatio >= 0.5;
    }, { threshold: [0, 0.5, 1] }).observe(wrap);

    wrap.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'mouse') hovering = true;
    });
    wrap.addEventListener('pointerleave', () => {
        hovering = false;
    });
    track.addEventListener('focusin', (event) => {
        focused = true;
        const index = indexOf(event.target);
        if (index < 0 || !event.target.matches(':focus-visible')) return;
        setActive(index);
        goTo(index);
    });
    track.addEventListener('focusout', (event) => {
        if (!track.contains(event.relatedTarget)) focused = false;
    });
    track.addEventListener('wheel', hold, { passive: true });
    track.addEventListener('touchstart', hold, { passive: true });

    track.addEventListener('keydown', (event) => {
        const index = indexOf(document.activeElement);
        if (index < 0) return;
        const total = order.length;
        const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: total - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        hold();
        order[(next + total) % total].card.focus({ preventScroll: true });
    });

    track.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        drag = { id: event.pointerId, x: event.clientX, left: track.scrollLeft, moved: false };
    });
    track.addEventListener('pointermove', (event) => {
        if (!drag || event.pointerId !== drag.id) return;
        if (!(event.buttons & 1)) {
            endDrag(event);
            return;
        }
        const dx = event.clientX - drag.x;
        if (!drag.moved) {
            if (Math.abs(dx) < 6) return;
            drag.moved = true;
            hold();
            track.setPointerCapture(event.pointerId);
            track.classList.add('is-dragging');
        }
        track.scrollLeft = drag.left - dx;
    });
    function endDrag(event) {
        if (!drag || event.pointerId !== drag.id) return;
        const moved = drag.moved;
        drag = null;
        track.classList.remove('is-dragging');
        if (!moved) return;
        suppressClickUntil = performance.now() + 400;
        goTo(nearestIndex());
    }
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    track.addEventListener('click', (event) => {
        if (performance.now() < suppressClickUntil) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);
    track.addEventListener('dragstart', (event) => event.preventDefault());

    const wide = matchMedia('(min-width: 64rem)');
    const placeControls = () => {
        const focusedControl = controls.contains(document.activeElement) ? document.activeElement : null;
        (wide.matches ? meta : slot)?.append(controls);
        focusedControl?.focus({ preventScroll: true });
    };
    wide.addEventListener('change', placeControls);
    placeControls();

    setInterval(advance, 6000);

    function markFailed(entry) {
        entry.num.classList.remove('is-pending', 'is-zero');
        entry.num.classList.add('is-failed');
        entry.num.querySelector('.reel-playing').textContent = '—';
        entry.num.querySelector('.reel-visits .digits').textContent = '—';
        entry.sr.textContent = 'Player numbers unavailable.';
    }

    function sort() {
        const focusedCard = document.activeElement;
        const keep = track.contains(focusedCard) ? order[indexOf(focusedCard)] : Date.now() < holdUntil ? order[active] : null;
        const playing = (entry) => entry.stat?.playing ?? -1;
        const visits = (entry) => entry.stat?.visits ?? -1;
        order = cards.slice().sort((a, b) => playing(b) - playing(a) || visits(b) - visits(a));
        track.append(...order.map((entry) => entry.item));
        rank();
        const index = keep ? Math.max(0, order.indexOf(keep)) : 0;
        goTo(index, 'auto');
        setActive(index);
        if (track.contains(focusedCard)) focusedCard.focus({ preventScroll: true });
    }

    function setThumbnail(entry, url) {
        const image = new Image(768, 432);
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.draggable = false;
        image.addEventListener('load', () => entry.thumb.classList.add('is-loaded'));
        image.addEventListener('error', () => {
            image.remove();
            entry.thumb.classList.add('is-empty');
        });
        image.src = url;
        entry.thumb.append(image);
    }

    return {
        applyStats(stats, first) {
            for (const entry of cards) {
                const stat = stats.get(String(entry.game.id));
                if (!stat) {
                    if (first) markFailed(entry);
                    continue;
                }
                entry.stat = stat;
                entry.num.classList.remove('is-pending', 'is-failed');
                entry.num.classList.toggle('is-zero', stat.playing === 0);
                entry.playing.set(stat.playing);
                entry.visits.set(stat.visits);
                entry.sr.textContent = `${fullNumber(stat.playing)} playing, ${compactNumber(stat.visits)} visits.`;
            }
            if (first) sort();
        },
        fail() {
            cards.forEach(markFailed);
            document.querySelector('[data-sorted]')?.remove();
        },
        async loadThumbnails() {
            const ids = cards.map((entry) => entry.game.id).filter(Boolean);
            const json = ids.length ? await fetchJson(viaWorker(thumbnailsUrl(ids))).catch(() => null) : null;
            const urls = new Map();
            for (const entry of json?.data ?? []) {
                const url = entry.thumbnails?.[0]?.imageUrl;
                if (url) urls.set(String(entry.universeId), url);
            }
            for (const entry of cards) {
                const url = urls.get(String(entry.game.id));
                if (url) setThumbnail(entry, url);
                else entry.thumb.classList.add('is-empty');
            }
        },
    };
}

function initCredits(config, jobs) {
    const band = document.querySelector('.credits');
    const roll = band?.querySelector('.credits-roll');
    if (!band || !roll) return;
    if (!config?.showJobs || !jobs.length) {
        band.remove();
        return;
    }

    band.querySelectorAll('[data-studio-count]').forEach((element) => {
        element.textContent = jobs.length;
    });

    roll.replaceChildren(...jobs.map((job, index) => {
        const item = document.createElement('li');
        const row = document.createElement(job.link ? 'a' : 'div');
        const position = document.createElement('span');
        const name = document.createElement('span');
        item.className = 'credit-item fd-tile';
        item.dataset.reveal = '';
        item.style.setProperty('--i', index);
        item.style.setProperty('--d', `${(index % 3) * 70}ms`);
        row.className = 'credit';
        position.className = 'credit-pos';
        position.textContent = job.position;
        name.className = 'credit-name';

        if (job.icon) {
            const logo = new Image(48, 48);
            logo.className = 'credit-logo';
            logo.alt = '';
            logo.loading = 'lazy';
            logo.decoding = 'async';
            logo.src = job.icon;
            name.append(logo);
        }
        name.append(job.studioName);

        if (job.link) {
            row.href = job.link;
            row.target = '_blank';
            row.rel = 'noopener';
            row.classList.add('fd-invert');
            const arrow = document.createElement('span');
            arrow.className = 'fd-arrow';
            arrow.setAttribute('aria-hidden', 'true');
            arrow.textContent = '↗';
            name.append(' ', arrow);
        }

        row.append(position, name);
        item.append(row);
        return item;
    }));
    band.hidden = false;
    revealer.watch(roll.children);
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const previous = document.activeElement;
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        const copied = document.execCommand('copy');
        area.remove();
        previous?.focus?.({ preventScroll: true });
        return copied;
    }
}

function initCopyButtons() {
    const status = document.querySelector('[data-status]');
    for (const button of document.querySelectorAll('[data-copy]')) {
        let resetTimer = 0;
        button.addEventListener('click', async () => {
            const source = document.querySelector(button.dataset.copy);
            if (!source || !(await copyText(source.textContent.trim()))) return;
            clearTimeout(resetTimer);
            button.textContent = 'Copied';
            if (status) {
                status.textContent = '';
                requestAnimationFrame(() => {
                    status.textContent = 'Copied';
                });
            }
            resetTimer = setTimeout(() => {
                button.textContent = 'Copy';
            }, 1800);
        });
    }
}

function compareVersions(a, b) {
    const parse = (version) => {
        const dash = version.indexOf('-');
        const core = dash < 0 ? version : version.slice(0, dash);
        return { parts: core.split('.').map(Number), pre: dash < 0 ? '' : version.slice(dash + 1) };
    };
    const left = parse(a);
    const right = parse(b);
    for (let i = 0; i < 3; i++) {
        const difference = (left.parts[i] || 0) - (right.parts[i] || 0);
        if (difference) return difference;
    }
    if (left.pre === right.pre) return 0;
    if (!left.pre) return 1;
    if (!right.pre) return -1;
    return left.pre.localeCompare(right.pre, 'en', { numeric: true });
}

function initLoren() {
    const install = document.querySelector('[data-install]');
    const version = document.querySelector('[data-loren-version]');
    const stars = document.querySelector('[data-stars]');

    fetchJson('https://registry.npmjs.org/loren-framework', { headers: { Accept: 'application/vnd.npm.install-v1+json' } })
        .then((json) => {
            const { latest, next } = json['dist-tags'] ?? {};
            if (!latest && !next) return;
            const useNext = Boolean(next) && (!latest || compareVersions(next, latest) > 0);
            if (install) install.textContent = useNext ? 'npm i -g loren-framework@next' : 'npm i -g loren-framework';
            if (version) version.textContent = useNext ? next : latest;
        })
        .catch(() => null);

    if (!stars) return;
    const showStars = (count) => {
        stars.querySelector('[data-stars-count]').textContent = count.toLocaleString('en-US');
        stars.hidden = false;
    };
    const cached = readCache(STARS_KEY, STARS_MAX_AGE);
    if (Number.isFinite(cached)) {
        showStars(cached);
        return;
    }
    fetchJson('https://api.github.com/repos/fabideveloper/Loren-Framework')
        .then((json) => {
            if (!Number.isFinite(json.stargazers_count)) return;
            writeCache(STARS_KEY, json.stargazers_count);
            showStars(json.stargazers_count);
        })
        .catch(() => null);
}

const STARS_KEY = 'fd-loren-stars';
const STARS_MAX_AGE = 6 * 60 * 60 * 1000;

function storage() {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function readCache(key, maxAge) {
    try {
        const entry = JSON.parse(storage()?.getItem(key) ?? 'null');
        return entry && Date.now() - entry.time < maxAge ? entry.value : null;
    } catch {
        return null;
    }
}

function writeCache(key, value) {
    try {
        storage()?.setItem(key, JSON.stringify({ value, time: Date.now() }));
        return true;
    } catch {
        return false;
    }
}

async function loadSiteData() {
    const response = await fetch('assets/data.json');
    if (!response.ok) throw new Error(`HTTP ${response.status} for assets/data.json`);
    return response.json();
}

async function main() {
    setYear();
    initMenu();
    initScrollspy();
    revealer.watch(document.querySelectorAll('[data-reveal]'));
    initCounters();
    initCopyButtons();
    initLoren();

    let data;
    try {
        data = await loadSiteData();
    } catch (error) {
        data = { config: {}, currentJobs: [], games: [] };
        console.warn('assets/data.json could not be loaded.', error);
    }

    const games = Array.isArray(data.games) ? data.games : [];
    document.querySelectorAll('[data-game-count]').forEach((element) => {
        element.textContent = games.length;
    });

    initCredits(data.config, Array.isArray(data.currentJobs) ? data.currentJobs : []);

    const reel = initReel(games);
    initLive(games, {
        onFirst(stats) {
            reel?.applyStats(stats, true);
            reel?.loadThumbnails();
        },
        onUpdate(stats) {
            reel?.applyStats(stats, false);
        },
        onFail() {
            reel?.fail();
            reel?.loadThumbnails();
        },
    });
}

main();
