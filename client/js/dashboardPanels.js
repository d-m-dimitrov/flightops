/* Flight dashboard panels: independent collapse and per-user local change alerts.
   This enhancement leaves the existing dashboard renderers and action buttons intact. */
(() => {
  const flight = new URLSearchParams(location.search).get('id');
  if (!flight) return;
  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}')._id || 'guest'; } catch { return 'guest'; } })();
  const prefix = 'flightPanels:v1:' + user + ':' + flight + ':';
  const configs = [
    ['passengers', '#passengerPanel'],
    ['special', '#specialHandlingPanel'],
    ['messages', '#messagesLink'],
    ['lir', '#lirCard'],
    ['staff', '#staffPanel'],
    ['timeline', '#timeline'],
    ['chat', '#chatMessages']
  ];
  const panels = new Map();
  function signature(el) {
    // Ignore presentation-only attributes, layout changes and badge updates.
    return (el?.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function setAlert(panel, on) {
    panel.unread = on;
    panel.badge.hidden = !on;
    panel.card.classList.toggle('flight-panel-new', on);
    panel.button.setAttribute('aria-label', panel.label + (on ? ' — new updates' : ''));
  }
  function markRead(panel) {
    panel.lastSeen = panel.lastValue;
    try { localStorage.setItem(prefix + panel.key + ':seen', panel.lastSeen); } catch {}
    setAlert(panel, false);
  }
  function initialize() {
    for (const [key, selector] of configs) {
      const el = document.querySelector(selector);
      const card = el?.closest('.card');
      const header = card?.querySelector(':scope > .card-header');
      const body = card?.querySelector(':scope > .card-body');
      if (!card || !header || !body) continue;
      const label = header.textContent.replace(/\s+/g, ' ').trim();
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'flight-panel-toggle btn btn-link text-reset text-decoration-none p-0 text-start';
      button.innerHTML = '<span class="panel-chevron" aria-hidden="true">⌄</span><span class="panel-label"></span>';
      button.querySelector('.panel-label').textContent = label;
      const badge = document.createElement('span');
      badge.className = 'flight-panel-alert badge text-bg-danger';
      badge.textContent = 'Updated';
      badge.hidden = true;
      button.append(badge);
      // Preserve interactive controls in the header (e.g. Staff Edit / links).
      const headerNodes = [...header.childNodes];
      const titleNode = headerNodes.find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (key === 'staff') {
        // Keep handover/gate links and Edit button outside the toggle button.
        button.querySelector('.panel-label').textContent = 'Staff';
      } else if (titleNode) {
        titleNode.remove();
      }
      header.prepend(button);
      header.classList.add('d-flex', 'align-items-center', 'gap-2');
      button.style.flex = '1';
      const bodyId = 'flight-panel-body-' + key;
      body.id ||= bodyId;
      button.setAttribute('aria-controls', body.id);
      let collapsed = false;
      try { collapsed = localStorage.getItem(prefix + key + ':collapsed') === 'true'; } catch {}
      const panel = {key, card, body, button, badge, label, el, lastValue:null, lastSeen:null, unread:false, ready:false};
      panels.set(key, panel);
      function toggle(expanded) {
        body.hidden = !expanded;
        // Bootstrap's .d-flex overrides [hidden] on some browsers.
        body.style.display = expanded ? '' : 'none';
        button.setAttribute('aria-expanded', String(expanded));
        try { localStorage.setItem(prefix + key + ':collapsed', String(!expanded)); } catch {}
        if (expanded) markRead(panel);
      }
      button.onclick = () => toggle(button.getAttribute('aria-expanded') !== 'true');
      toggle(!collapsed);
      try { panel.lastSeen = localStorage.getItem(prefix + key + ':seen'); } catch {}
    }
  }
  function poll() {
    for (const panel of panels.values()) {
      if (panel.card.hidden) continue;
      const value = signature(panel.el);
      if (!value || /^(Loading…|Loading\.\.\.|No events)$/i.test(value)) continue;
      if (!panel.ready) {
        panel.ready = true;
        panel.lastValue = value;
        // On first visit, do not mark all existing content as an update.
        if (panel.lastSeen === null) markRead(panel);
        else setAlert(panel, panel.lastSeen !== value && panel.button.getAttribute('aria-expanded') === 'false');
        continue;
      }
      if (value === panel.lastValue) continue;
      panel.lastValue = value;
      if (panel.button.getAttribute('aria-expanded') === 'true') {
        // Visible changes are already available to the user.
        markRead(panel);
        panel.card.classList.add('flight-panel-new');
        setTimeout(() => { if (!panel.unread) panel.card.classList.remove('flight-panel-new'); }, 1800);
      } else setAlert(panel, value !== panel.lastSeen);
    }
  }
  function notify(key) {
    const panel = panels.get(key);
    if (!panel || !panel.ready) return;
    if (panel.button.getAttribute('aria-expanded') === 'false') setAlert(panel, true);
    else {
      panel.card.classList.add('flight-panel-new');
      setTimeout(() => { if (!panel.unread) panel.card.classList.remove('flight-panel-new'); }, 1800);
    }
  }
  initialize();
  poll();
  setInterval(poll, 2000);
  // Event notifications supplement snapshot comparison for link-only panels.
  if (typeof socket !== 'undefined') {
    socket.on('newChatMessage', () => notify('chat'));
    socket.on('lirUpdated', () => notify('lir'));
    socket.on('assignmentsUpdated', () => notify('staff'));
  }
})();
