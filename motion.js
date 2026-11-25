(() => {
  const section = document.querySelector('.box-scroll');
  const track = section.querySelector('.box-track');
  const stage = section.querySelector('.box-stage');
  const media = section.querySelector('.box-media');
  const video = media.querySelector('video');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const detail = [...document.querySelectorAll('[data-drift]')];
  const hero = document.querySelector('.hero');
  const ritualGallery = document.querySelector('.ritual-gallery');
  const ritualFrames = [...ritualGallery.querySelectorAll('[data-ritual-frame]')];
  const story = document.querySelector('.founder-story');
  const plates = document.querySelectorAll('.pastries .image-clip');
  let wordCount = 0;
  const clampProgress = value => Math.max(0, Math.min(1, value));

  function prepareStory() {
    if (wordCount) return;
    const words = document.createDocumentFragment();
    for (const part of story.textContent.split(/(\s+)/)) {
      if (!part || /^\s+$/.test(part)) {
        words.append(part);
        continue;
      }
      const word = document.createElement('span');
      word.className = 'story-word';
      word.style.setProperty('--word-index', wordCount++);
      word.textContent = part;
      words.append(word);
    }
    story.replaceChildren(words);
  }

  function paintEditorialMotion(viewport) {
    const desktop = innerWidth > 760;
    const galleryTop = ritualGallery.getBoundingClientRect().top;
    for (const [index, frame] of ritualFrames.entries()) {
      const frameTop = frame.getBoundingClientRect().top;
      const trigger = Math.max(frameTop, galleryTop + index * viewport * .18);
      const value = clampProgress((viewport * .91 - trigger) / (viewport * (desktop ? .24 : .21)));
      frame.style.setProperty('--ritual-progress', value.toFixed(3));
    }

    for (const plate of plates) {
      const rect = plate.getBoundingClientRect();
      const value = clampProgress((viewport * .94 - rect.top) / (viewport * .35));
      plate.style.setProperty('--plate-entrance', value.toFixed(3));
    }

    const storyRect = story.getBoundingClientRect();
    // Start as the paragraph enters and finish while the last line is still on screen.
    const storyTravel = storyRect.height + viewport * .58;
    const value = clampProgress((viewport * .91 - storyRect.top) / storyTravel);
    story.style.setProperty('--story-progress', (value * (wordCount + 2)).toFixed(2));
  }
  const reveals = [...document.querySelectorAll('[data-reveal]')];
  const approved = { frames: 32, fps: 18 };
  let progress = 0;
  let requestedFrame = 0;
  let queued = 0;
  let loading = false;
  let failed = false;
  let inRange = false;
  let observer;
  let pendingFrame = null;

  function startVideo() {
    if (loading || failed || reduce.matches) return;
    loading = true;
    video.preload = 'auto';
    video.src = video.dataset.src;
    video.load();
  }

  function seek() {
    if (reduce.matches || failed || !loading || video.readyState < 1 ||
        !Number.isFinite(video.duration) || video.seeking) return;
    const target = Math.min(video.duration - 0.5 / approved.fps,
      (requestedFrame + 0.5) / approved.fps);
    if (pendingFrame === requestedFrame && Math.abs(video.currentTime - target) < 0.012) {
      if (video.readyState >= 2) media.classList.add('is-video-visible');
      return;
    }
    pendingFrame = requestedFrame;
    if (Math.abs(video.currentTime - target) >= 0.012) {
      try { video.currentTime = target; } catch { pendingFrame = null; }
    } else if (video.readyState >= 2) {
      media.classList.add('is-video-visible');
    }
  }

  function paint() {
    queued = 0;
    if (reduce.matches) return;
    if (!failed) {
      const rect = track.getBoundingClientRect();
      const sticky = parseFloat(getComputedStyle(stage).top) || 0;
      progress = Math.max(0, Math.min(1, (sticky - rect.top) /
        Math.max(1, rect.height - stage.offsetHeight)));
      requestedFrame = Math.round(progress * (approved.frames - 1));
      section.style.setProperty('--progress', progress.toFixed(4));
      if (inRange || !observer) startVideo();
      seek();
    }

    const viewport = window.innerHeight;
    paintEditorialMotion(viewport);
    const heroProgress = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / Math.max(hero.offsetHeight, 1)));
    hero.style.setProperty('--hero-shift', (-heroProgress * 33).toFixed(2) + 'px');
    for (const item of detail) {
      // Measure the figure's untransformed layout, avoiding a feedback loop.
      const rect = item.getBoundingClientRect();
      const previous = Number(item.dataset.driftOffset || 0);
      const isHero = item.classList.contains('hero-product');
      const center = rect.top - (isHero ? 0 : previous) + rect.height * 0.5;
      if (rect.bottom < -40 || rect.top > viewport + 40) continue;
      const distance = (viewport * 0.5 - center) / viewport;
      const limit = isHero ? 13 : (innerWidth <= 760 ? 14 : 37);
      const offset = Math.max(-limit, Math.min(limit, distance * (2 * limit)));
      item.style.setProperty('--drift', offset.toFixed(2) + 'px');
      item.dataset.driftOffset = offset.toFixed(2);
    }
  }

  function schedule() {
    if (!queued) queued = requestAnimationFrame(paint);
  }

  function syncMotion() {
    section.classList.toggle('is-enhanced', !reduce.matches && !failed);
    if (!reduce.matches) prepareStory();
    document.documentElement.classList.toggle('has-scroll-motion', !reduce.matches);
    if (reduce.matches) {
      media.classList.remove('is-video-visible');
      video.pause();
    }
    schedule();
  }

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(([entry]) => {
      inRange = entry.isIntersecting;
      if (inRange) startVideo();
      schedule();
    }, { rootMargin: '380px 0px' });
    observer.observe(section);
    const revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -9% 0px', threshold: 0.06 });
    document.documentElement.classList.add('has-reveal');
    reveals.forEach(item => revealObserver.observe(item));
  }

  for (const name of ['loadedmetadata', 'loadeddata', 'canplay', 'seeked']) {
    video.addEventListener(name, seek);
  }
  video.addEventListener('error', () => {
    failed = true;
    media.classList.remove('is-video-visible');
    // Keep the pinned interval in place while the visitor is inside it.
    media.classList.add('is-unavailable');
    if (!inRange) section.classList.remove('is-enhanced');
  });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  if (reduce.addEventListener) reduce.addEventListener('change', syncMotion);
  else reduce.addListener(syncMotion);
  syncMotion();
})();
