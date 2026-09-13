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
  if (buttons.length && cards.length) {
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (x) { x.classList.toggle('is-on', x === btn); });
        var want = btn.dataset.f;
        var shown = 0;
        cards.forEach(function (c) {
          var show = want === 'all' || c.dataset.era === want;
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

})();
