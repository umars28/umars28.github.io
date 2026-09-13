(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  var buttons = [].slice.call(document.querySelectorAll('.fb'));
  var moreWrap = document.querySelector('.pmore');
  var moreBtn = document.querySelector('[data-more]');
  var LIMIT = 12;
  var want = 'all';
  var expanded = false;

  function render(animate) {
    var matched = cards.filter(function (c) {
      return want === 'all' || c.dataset.type === want;
    });
    var shown = 0;
    cards.forEach(function (c) {
      var i = matched.indexOf(c);
      var visible = i !== -1 && (expanded || i < LIMIT);
      c.classList.toggle('out', !visible);
      c.classList.remove('pop');
      if (!visible || !animate || reduced) return;
      void c.offsetWidth;
      c.style.animationDelay = (shown++ * 30) + 'ms';
      c.classList.add('pop');
    });
    if (!moreWrap) return;
    var hidden = matched.length - LIMIT;
    moreWrap.hidden = expanded || hidden <= 0;
    if (!moreWrap.hidden) moreBtn.firstChild.nodeValue = 'Show ' + hidden + ' more ';
  }

  if (buttons.length && cards.length) {
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (x) { x.classList.toggle('is-on', x === btn); });
        want = btn.dataset.f;
        expanded = false;
        render(true);
      });
    });
  }

  if (moreBtn) {
    moreBtn.addEventListener('click', function () {
      expanded = true;
      render(true);
      var first = cards.filter(function (c) { return !c.classList.contains('out'); })[LIMIT];
      if (first) first.focus({ preventScroll: true });
    });
  }

  if (cards.length) render(false);

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

})();
