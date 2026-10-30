/* Progressive enhancements: the page remains readable without this file or third-party services. */
(function () {
  'use strict';
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducesMotion() { return Boolean(motionQuery && motionQuery.matches); }

  // Every component is independent of the optional newsletter service.
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    function setMenu(open) {
      navLinks.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    navToggle.type = 'button';
    navToggle.setAttribute('aria-controls', navLinks.id);
    setMenu(false);
    navToggle.addEventListener('click', function () {
      setMenu(navToggle.getAttribute('aria-expanded') !== 'true');
    });
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        navToggle.focus();
      }
    });
    document.addEventListener('click', function (event) {
      if (!navLinks.contains(event.target) && !navToggle.contains(event.target)) setMenu(false);
    });
    document.documentElement.classList.add('site-nav-enhanced');
  }

  var faqItems = [];
  document.querySelectorAll('.faq-q').forEach(function (button, index) {
    var item = button.closest('.faq-item');
    var answer = item && item.querySelector('.faq-a');
    if (!answer) return;
    button.type = 'button';
    button.id = button.id || 'faq-question-' + (index + 1);
    answer.id = answer.id || 'faq-answer-' + (index + 1);
    button.setAttribute('aria-controls', answer.id);
    answer.setAttribute('role', 'region');
    answer.setAttribute('aria-labelledby', button.id);
    var icon = button.querySelector('.faq-icon');
    if (icon) icon.setAttribute('aria-hidden', 'true');
    function setOpen(open) {
      item.classList.toggle('open', open);
      answer.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    }
    setOpen(false);
    faqItems.push(setOpen);
    button.addEventListener('click', function () {
      var shouldOpen = button.getAttribute('aria-expanded') !== 'true';
      faqItems.forEach(function (close) { close(false); });
      setOpen(shouldOpen);
    });
  });

  // Content starts visible. An intersecting element receives a short entrance
  // animation; no observer failure or blocked script can strand invisible copy.
  if ('IntersectionObserver' in window && !reducesMotion()) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('site-reveal-enter');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.anim').forEach(function (element) { revealObserver.observe(element); });
  }

  var monthlyPrices = ['$0', '$9.99', '$19.99'];
  var yearlyPrices = ['$0', '$59.99', '$179.99'];
  window.setPricing = function (mode) {
    var annual = mode === 'yearly';
    var prices = annual ? yearlyPrices : monthlyPrices;
    document.querySelectorAll('.price-card').forEach(function (card, index) {
      var amount = card.querySelector('.price-amount');
      var period = card.querySelector('.price-period');
      if (amount && prices[index]) amount.textContent = prices[index];
      if (period) period.textContent = index === 0 ? 'forever' : (annual ? '/year' : '/month');
    });
    ['Monthly', 'Yearly'].forEach(function (name) {
      var button = document.getElementById('toggle' + name);
      if (!button) return;
      var selected = (name === 'Yearly') === annual;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  };
  var pricingToggle = document.querySelector('.pricing-toggle');
  if (pricingToggle) {
    pricingToggle.setAttribute('role', 'group');
    pricingToggle.setAttribute('aria-label', 'Billing period');
    pricingToggle.setAttribute('data-enhanced', '');
    ['Monthly', 'Yearly'].forEach(function (name) {
      var button = document.getElementById('toggle' + name);
      if (!button) return;
      button.type = 'button';
      button.removeAttribute('onclick');
      button.addEventListener('click', function () { window.setPricing(name.toLowerCase()); });
    });
    window.setPricing('monthly');
  }
  document.querySelectorAll('.price-features .off').forEach(function (item) {
    var prefix = document.createElement('span');
    prefix.className = 'sr-only';
    prefix.textContent = 'Not included: ';
    item.prepend(prefix);
  });

  var scrollButton = document.getElementById('scrollTop');
  if (scrollButton) {
    scrollButton.type = 'button';
    scrollButton.removeAttribute('onclick');
    scrollButton.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reducesMotion() ? 'auto' : 'smooth' });
    });
    function updateScrollButton() { scrollButton.classList.toggle('show', window.scrollY > 400); }
    window.addEventListener('scroll', updateScrollButton, { passive: true });
    updateScrollButton();
  }
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var id = link.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.getElementById(decodeURIComponent(id.slice(1)));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reducesMotion() ? 'auto' : 'smooth', block: 'start' });
      if (link.classList.contains('skip-link')) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
      if (history.replaceState) history.replaceState(null, '', id);
    });
  });

  // Firebase is loaded only after the user submits the optional email form.
  // Service failures affect the signup result, never navigation or page visibility.
  var databasePromise;
  function loadScript(source) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var timeout = window.setTimeout(function () {
        script.remove();
        reject(new Error('Newsletter service timed out.'));
      }, 12000);
      script.src = source;
      script.async = true;
      script.onload = function () { clearTimeout(timeout); resolve(); };
      script.onerror = function () { clearTimeout(timeout); script.remove(); reject(new Error('Newsletter service unavailable.')); };
      document.head.appendChild(script);
    });
  }
  function newsletterDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = Promise.resolve().then(function () {
      return window.firebase ? undefined : loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    }).then(function () {
      return window.firebase && window.firebase.firestore ? undefined : loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js');
    }).then(function () {
      if (!window.firebase || !window.firebase.firestore) throw new Error('Newsletter service unavailable.');
      var firebase = window.firebase;
      var app = firebase.apps.length ? firebase.app() : firebase.initializeApp({
        apiKey: 'AIzaSyBqoKxfNM1EBp5j_c5s7ocdWRfuCmijfX0',
        authDomain: 'cryptosage-ai.firebaseapp.com',
        projectId: 'cryptosage-ai',
        storageBucket: 'cryptosage-ai.firebasestorage.app',
        messagingSenderId: '554507965330',
        appId: '1:554507965330:ios:e43a62b0f7bce75c33e79f'
      });
      return app.firestore();
    }).catch(function (error) { databasePromise = null; throw error; });
    return databasePromise;
  }

  var signupForm = document.querySelector('.signup-form');
  var signupEmail = document.getElementById('signupEmail');
  if (signupForm && signupEmail) {
    signupEmail.name = 'email';
    signupEmail.autocomplete = 'email';
    signupEmail.inputMode = 'email';
    if (!document.querySelector('label[for="signupEmail"]')) {
      var label = document.createElement('label');
      label.htmlFor = signupEmail.id;
      label.className = 'sr-only';
      label.textContent = 'Email address for CryptoSage product updates';
      signupForm.insertBefore(label, signupEmail);
    }
    var signupStatus = document.getElementById('signupStatus');
    if (!signupStatus) {
      signupStatus = document.createElement('p');
      signupStatus.id = 'signupStatus';
      signupStatus.className = 'signup-status';
      signupForm.after(signupStatus);
    }
    signupStatus.setAttribute('role', 'status');
    signupStatus.setAttribute('aria-live', 'polite');
    signupStatus.setAttribute('aria-atomic', 'true');
    signupEmail.setAttribute('aria-describedby', 'signupStatus');
    var pending = false;
    window.handleSignup = function (event) {
      event.preventDefault();
      if (pending || !signupForm.reportValidity()) return;
      var email = signupEmail.value.trim();
      if (!email) return;
      var button = signupForm.querySelector('button[type="submit"]');
      var originalLabel = button.innerHTML;
      pending = true;
      button.disabled = true;
      button.textContent = 'Saving…';
      signupForm.setAttribute('aria-busy', 'true');
      signupStatus.textContent = 'Saving your email address…';
      var confirmationTimer;
      newsletterDatabase().then(function (database) {
        confirmationTimer = window.setTimeout(function () {
          button.textContent = 'Awaiting confirmation…';
          signupStatus.textContent = 'Your signup is still awaiting confirmation. Please check your connection and avoid submitting again. You can also contact us through Support.';
        }, 15000);
        return database.collection('early_access').add({
          email: email,
          source: 'website',
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        });
      }).then(function () {
        signupEmail.value = '';
        signupStatus.textContent = 'Thanks — you’re subscribed to CryptoSage product updates.';
        if (typeof window.gtag === 'function') window.gtag('event', 'sign_up', { method: 'email' });
      }).catch(function () {
        signupStatus.textContent = 'We couldn’t save your email. Please try again, or contact us through Support.';
      }).finally(function () {
        window.clearTimeout(confirmationTimer);
        pending = false;
        button.disabled = false;
        button.innerHTML = originalLabel;
        signupForm.removeAttribute('aria-busy');
      });
    };
    signupForm.removeAttribute('onsubmit');
    signupForm.addEventListener('submit', window.handleSignup);
    signupForm.setAttribute('data-enhanced', '');
    var fallback = document.querySelector('.signup-fallback');
    if (fallback) fallback.hidden = true;
  }
}());
