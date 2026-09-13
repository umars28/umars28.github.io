(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function norm(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }

  document.querySelectorAll('.cov').forEach(function (el) {
    var src = el.dataset.img;
    if (!src) return;
    var img = new Image();
    img.onload = function () {
      el.style.backgroundImage = 'url("' + src + '")';
      el.classList.add('has');
    };
    img.src = src;
  });

  var modal = document.querySelector('[data-modal]');
  var cards = [].slice.call(document.querySelectorAll('.pcard'));

  if (modal && cards.length) {
    var mbody = modal.querySelector('[data-mbody]');
    var mcov = modal.querySelector('[data-mcov]');
    var mcovt = modal.querySelector('[data-mcovt]');
    var opener = null;

    var open = function (card) {
      var detail = document.querySelector('.pcd[data-d="' + card.dataset.k + '"]');
      if (!detail) return;
      opener = card;
      mbody.innerHTML = detail.innerHTML;
      var h = mbody.querySelector('h3');
      if (h) h.id = 'mtitle';

      var cov = card.querySelector('.cov');
      mcov.style.setProperty('--hue', getComputedStyle(card).getPropertyValue('--hue').trim());
      if (cov && cov.classList.contains('has')) {
        mcov.style.backgroundImage = cov.style.backgroundImage;
        mcov.classList.add('has');
      } else {
        mcov.style.backgroundImage = '';
        mcov.classList.remove('has');
        if (mcovt && cov) mcovt.textContent = cov.textContent.trim();
      }

      modal.hidden = false;
      document.body.classList.add('lock');
      modal.querySelector('.mx').focus();
    };

    var close = function () {
      modal.hidden = true;
      document.body.classList.remove('lock');
      if (opener) { opener.focus(); opener = null; }
    };

    cards.forEach(function (c) {
      c.addEventListener('click', function () { open(c); });
      c.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(c); }
      });
    });

    modal.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
  }

  var pillars = [].slice.call(document.querySelectorAll('.pil'));
  if (pillars.length) {
    if (reduced || !('IntersectionObserver' in window)) {
      pillars.forEach(function (g) { g.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.style.transitionDelay = pillars.indexOf(e.target) * 110 + 'ms';
          e.target.classList.add('in');
          io.unobserve(e.target);
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -40px' });
      pillars.forEach(function (g) { io.observe(g); });
    }
  }

  var buttons = [].slice.call(document.querySelectorAll('.fb'));
  if (buttons.length && cards.length) {
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (x) { x.classList.toggle('is-on', x === btn); });
        var want = btn.dataset.f;
        var shown = 0;
        cards.forEach(function (c) {
          var show = want === 'all' ||
            (want === 'oss' ? c.dataset.oss === '1' : c.dataset.era === want);
          c.classList.toggle('out', !show);
          c.classList.remove('pop');
          if (!show || reduced) return;
          void c.offsetWidth;
          c.style.animationDelay = (shown++ * 35) + 'ms';
          c.classList.add('pop');
        });
      });
    });
  }

  var cv = document.querySelector('[data-cv]');
  if (cv) {
    var frame = cv.querySelector('[data-cvframe]');
    var cvSrc = cv.querySelector('.cvout').getAttribute('href');
    var cvOpener = null;

    var cvClose = function () {
      cv.hidden = true;
      document.body.classList.remove('lock');
      if (cvOpener) { cvOpener.focus(); cvOpener = null; }
    };

    document.querySelectorAll('[data-cvopen]').forEach(function (b) {
      b.addEventListener('click', function () {
        cvOpener = b;
        if (!frame.getAttribute('src')) frame.setAttribute('src', cvSrc + '#view=FitH');
        cv.hidden = false;
        document.body.classList.add('lock');
        cv.querySelector('.mx').focus();
      });
    });

    cv.querySelectorAll('[data-cvclose]').forEach(function (b) {
      b.addEventListener('click', cvClose);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !cv.hidden) cvClose();
    });
  }

  var hint = document.querySelector('[data-hint]');
  var index = {};
  cards.forEach(function (c) {
    var detail = document.querySelector('.pcd[data-d="' + c.dataset.k + '"]');
    if (!detail) return;
    detail.querySelectorAll('.stk li').forEach(function (li) {
      var key = norm(li.textContent);
      if (!index[key]) index[key] = [];
      if (index[key].indexOf(c) === -1) index[key].push(c);
    });
  });

  document.querySelectorAll('.chips li').forEach(function (chip) {
    var hits = index[chip.dataset.t];
    if (!hits || !hits.length) return;
    chip.classList.add('hot');
    chip.tabIndex = 0;

    var enter = function () {
      chip.classList.add('on');
      cards.forEach(function (c) {
        c.classList.add(hits.indexOf(c) === -1 ? 'dim' : 'lit');
      });
      if (hint) {
        hint.textContent = chip.textContent + ' → ' + hits.map(function (c) {
          return c.querySelector('h3').textContent;
        }).join(' · ');
        hint.classList.add('on');
      }
    };

    var leave = function () {
      chip.classList.remove('on');
      cards.forEach(function (c) { c.classList.remove('dim', 'lit'); });
      if (hint) hint.classList.remove('on');
    };

    chip.addEventListener('mouseenter', enter);
    chip.addEventListener('mouseleave', leave);
    chip.addEventListener('focus', enter);
    chip.addEventListener('blur', leave);
  });
})();
