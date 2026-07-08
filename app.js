// v13: canonical field mapping + delete uploaded photos
const App = (() => {
  const OPTIONS = {
    yesNo: ['', 'כן', 'לא'],
    yesNoCheck: ['', 'כן', 'לא', 'לבדיקה'],
    surveyStatus: ['', 'לא התחיל', 'לא נבדק', 'בבדיקה', 'חסר מידע', 'הושלם'],
    complexity: ['', 'נמוכה', 'בינונית', 'גבוהה', 'חריגה'],
    readiness: ['', 'לא נבדק', 'בבדיקה', 'חסר מידע', 'מוכן לביצוע', 'מוכן לביצוע בתנאים', 'לא מוכן לביצוע', 'דורש החלטת ועדת תכנון', 'דורש טיפול תשתיות', 'דורש טיפול נוי', 'דורש תיאום דייר'],
    firstPhase: ['', 'מתאים', 'לא מתאים', 'מתאים לאחר סגירת חסם', 'לבדיקה'],
    access: ['', 'קיימת', 'לא קיימת', 'חלקית', 'לבדיקה'],
    impact: ['', 'אין', 'קיים', 'מפריע', 'דורש פירוק', 'לבדיקה'],
    infraStatus: ['', 'אין', 'קיים', 'לבדיקה', 'דורש הזזה', 'דורש הגנה', 'דורש פירוק', 'דורש תיאום'],
    owner: ['', 'חשמל', 'מים', 'ביוב', 'תקשורת', 'נוי', 'בניין', 'קבלן', 'אחר'],
    vegetation: ['', 'שיחים', 'עץ', 'גדר חיה', 'מדשאה', 'אחר'],
    gardenAction: ['', 'ללא', 'גיזום', 'הסרה', 'העתקה', 'בדיקה נוספת'],
    demolition: ['', 'לא קיים', 'ללא', 'פירוק', 'התאמה', 'הזזה', 'החזרה', 'לבדיקה'],
    interior: ['', 'ללא', 'קיר', 'פתח', 'חלון', 'דלת', 'מטבח', 'ארון', 'חשמל', 'אינסטלציה', 'אחר'],
    decisionBy: ['', 'אין', 'ועדת תכנון', 'תשתיות', 'נוי', 'דייר', 'הנהלה', 'קבלן', 'אחר'],
    photoType: ['', 'מיקום ממ״ד', 'גישה לכלים', 'ציר גישה', 'תשתיות', 'נוי / עצים', 'פירוקים', 'פנים הדירה', 'אחר'],
    requiredNotRequired: ['לא נדרש', 'נדרש'],
  };

  const state = {
    residents: [],
    surveys: [],
    photos: [],
    actions: [],
    history: [],
    plans: [],
    dashboard: [],
    settings: {},
    selectedApartment: null,
    currentSurveyRecord: null,
    currentView: 'dashboard',
  };

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const config = () => ({
    ...(window.MAMAD_APP_CONFIG || {}),
    API_BASE_URL: localStorage.getItem('MAMAD_API_BASE_URL') || (window.MAMAD_APP_CONFIG || {}).API_BASE_URL,
    API_KEY: localStorage.getItem('MAMAD_API_KEY') || (window.MAMAD_APP_CONFIG || {}).API_KEY,
  });

  function init() {
    fillOptions();
    fillMultiOptions();
    bindEvents();
    loadLocalSettings();
    loadBootstrap();
  }

  function fillOptions() {
    qsa('select[data-options]').forEach(sel => {
      const key = sel.dataset.options;
      sel.innerHTML = (OPTIONS[key] || ['']).map(v => `<option value="${esc(v)}">${esc(v || 'בחר')}</option>`).join('');
    });
  }

function fillMultiOptions() {
  qsa('[data-multi-options]').forEach(container => {
    const key = container.dataset.multiOptions;
    const targetId = container.dataset.target;
    const values = (OPTIONS[key] || []).filter(Boolean);

    container.innerHTML = values.map(value => `
      <label class="multi-check-item">
        <input type="checkbox" value="${esc(value)}" data-multi-target="${esc(targetId)}">
        <span>${esc(value)}</span>
      </label>
    `).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => syncMultiHiddenInput(targetId));
    });
  });
}

function syncMultiHiddenInput(targetId) {
  const hidden = document.getElementById(targetId);
  if (!hidden) return;
  const checked = qsa(`[data-multi-target="${targetId}"]:checked`).map(cb => cb.value);
  hidden.value = checked.join(', ');
}

function setMultiFromHidden(targetId, value) {
  const selected = String(value || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  qsa(`[data-multi-target="${targetId}"]`).forEach(cb => {
    cb.checked = selected.includes(cb.value);
  });

  syncMultiHiddenInput(targetId);
}

function syncAllMultiHiddenInputs() {
  qsa('[data-multi-options]').forEach(container => {
    syncMultiHiddenInput(container.dataset.target);
  });
}

  function bindEvents() {
    qsa('.nav-btn').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
    qs('#refreshBtn').addEventListener('click', loadBootstrap);
    qs('#newSurveyBtn').addEventListener('click', () => showView('survey'));
    qs('#exportCsvBtn').addEventListener('click', exportDashboardCsv);
    qs('#exportHistoryCsvBtn')?.addEventListener('click', exportHistoryCsv);
    qs('#saveSettingsBtn').addEventListener('click', saveLocalSettings);
    qs('#testConnectionBtn').addEventListener('click', testConnection);
    qs('#clearSurveyBtn').addEventListener('click', clearSurveyForm);
    qs('#surveyForm').addEventListener('submit', saveSurvey);
    qs('#buildingSelect').addEventListener('change', onBuildingChange);
    qs('#unitSelect').addEventListener('change', onUnitChange);
    qs('#photoFiles').addEventListener('change', previewSelectedPhotos);
    qs('#dashboardSearch').addEventListener('input', renderDashboardTable);
    qs('#filterArea').addEventListener('change', renderDashboardTable);
    qs('#filterReadiness').addEventListener('change', renderDashboardTable);
    qs('#filterSurveyStatus').addEventListener('change', renderDashboardTable);
    qs('#filterFirstPhase').addEventListener('change', renderDashboardTable);
    qs('#apartmentsSearch').addEventListener('input', renderApartments);
    qs('#apartmentsAreaFilter').addEventListener('change', renderApartments);
    qs('#photosSearch').addEventListener('input', renderPhotos);
    qs('#actionsSearch')?.addEventListener('input', renderActions);
    qs('#actionsStatusFilter')?.addEventListener('change', renderActions);
    qs('#historySearch')?.addEventListener('input', renderHistory);
    qs('#addActionBtn')?.addEventListener('click', () => openActionModal());
    qs('#closeActionModalBtn')?.addEventListener('click', closeActionModal);
    qs('#cancelActionBtn')?.addEventListener('click', closeActionModal);
    qs('#actionForm')?.addEventListener('submit', saveActionFromForm);
    qs('#runDiagnoseBtn')?.addEventListener('click', runDiagnostics);
    qs('#closeSnapshotModalBtn')?.addEventListener('click', closeSnapshotModal);
    qsa('.step-btn').forEach(btn => btn.addEventListener('click', () => showStep(btn.dataset.step)));
    window.addEventListener('message', handleTransportMessage);
  }

  function loadLocalSettings() {
    const c = config();
    qs('#backendUrlInput').value = c.API_BASE_URL || '';
    qs('#apiKeyInput').value = c.API_KEY || '';
  }

  function saveLocalSettings() {
    localStorage.setItem('MAMAD_API_BASE_URL', qs('#backendUrlInput').value.trim());
    localStorage.setItem('MAMAD_API_KEY', qs('#apiKeyInput').value.trim());
    toast('ההגדרות נשמרו בדפדפן');
  }

  function apiReady() {
    const c = config();
    return c.API_BASE_URL && !c.API_BASE_URL.includes('PASTE_') && c.API_KEY && !c.API_KEY.includes('CHANGE_ME');
  }

  function normalizeApiPayload(res) {
    if (!res || typeof res !== 'object') return res;

    // Supported response formats:
    // 1) { ok:true, data:{...} }
    // 2) { ok:true, exists:true, survey:{...} }
    // 3) Bad legacy nested format: { ok:true, survey:{ survey:{...}, photos:[], actions:[], history:{history:[]} } }
    const payload = Object.prototype.hasOwnProperty.call(res, 'data') && res.data && typeof res.data === 'object'
      ? res.data
      : res;

    if (payload.survey && payload.survey.survey) {
      const nested = payload.survey;
      payload.survey = nested.survey || null;
      payload.photos = Array.isArray(payload.photos) ? payload.photos : (Array.isArray(nested.photos) ? nested.photos : []);
      payload.actions = Array.isArray(payload.actions) ? payload.actions : (Array.isArray(nested.actions) ? nested.actions : []);
      payload.history = Array.isArray(payload.history) ? payload.history : (Array.isArray(nested.history) ? nested.history : (nested.history && Array.isArray(nested.history.history) ? nested.history.history : []));
      if (typeof payload.exists === 'undefined') payload.exists = !!payload.survey || nested.exists === true;
      if (!payload.surveyId) payload.surveyId = nested.surveyId || payload.survey?.surveyId || '';
    }

    if (payload.history && !Array.isArray(payload.history) && Array.isArray(payload.history.history)) {
      payload.history = payload.history.history;
    }

    payload.photos = Array.isArray(payload.photos) ? payload.photos : [];
    payload.actions = Array.isArray(payload.actions) ? payload.actions : [];
    payload.history = Array.isArray(payload.history) ? payload.history : [];

    if (payload.survey) payload.survey = normalizeSurveyForForm(payload.survey);
    if (Array.isArray(payload.dashboard)) payload.dashboard = payload.dashboard.map(row => row && row.survey ? ({ ...row, survey: normalizeSurveyForForm(row.survey) }) : row);

    return payload;
  }

  function jsonp(action, params = {}) {
    const c = config();
    if (!apiReady()) return Promise.reject(new Error('חסר URL של Apps Script או API Key. עבור למסך הגדרות.'));
    const callback = `__mamad_cb_${Date.now()}_${Math.floor(Math.random()*99999)}`;
    const url = new URL(c.API_BASE_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('apiKey', c.API_KEY);
    url.searchParams.set('callback', callback);
    Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v ?? ''));
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => { cleanup(); reject(new Error('Timeout מול Apps Script')); }, 45000);
      function cleanup(){ clearTimeout(timer); delete window[callback]; script.remove(); }
      window[callback] = (res) => {
        cleanup();
        if (!res || res.ok === false) {
          reject(new Error((res && res.error) || 'שגיאת שרת'));
          return;
        }
        resolve(normalizeApiPayload(res));
      };
      script.onerror = () => { cleanup(); reject(new Error('טעינת Apps Script נכשלה')); };
      script.src = url.toString();
      document.body.appendChild(script);
    });
  }

  function postIframe(action, payload) {
    const c = config();
    if (!apiReady()) return Promise.reject(new Error('חסר URL של Apps Script או API Key.'));
    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.floor(Math.random()*99999)}`;
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = c.API_BASE_URL;
      form.target = 'transportFrame';
      form.className = 'hidden';
      const fields = { action, apiKey: c.API_KEY, responseMode: 'iframe', requestId, payload: JSON.stringify(payload || {}) };
      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement('input'); input.name = name; input.value = value; form.appendChild(input);
      });
      const timer = setTimeout(() => { cleanup(); reject(new Error('השמירה כנראה בוצעה, אבל לא התקבלה תשובה מהשרת בזמן. רענן נתונים ובדוק את הרשומה.')); }, 120000);
      function listener(ev) {
        if (!ev.data || ev.data.type !== 'MAMAD_APPS_SCRIPT_RESPONSE' || ev.data.requestId !== requestId) return;
        cleanup();
        ev.data.ok ? resolve(ev.data.data) : reject(new Error(ev.data.error || 'שגיאת שמירה'));
      }
      function cleanup(){ clearTimeout(timer); window.removeEventListener('message', listener); form.remove(); }
      window.addEventListener('message', listener);
      document.body.appendChild(form);
      form.submit();
    });
  }

  function handleTransportMessage(){ /* handled per request */ }

  async function loadBootstrap() {
    setConnection('warning', 'טוען נתונים');
    try {
      const data = await jsonp('bootstrap');
      Object.assign(state, data);
      normalizeState();
      populateSelectors();
      renderAll();
      setConnection('ok', 'מחובר');
    } catch (err) {
      setConnection('error', 'אין חיבור');
      showAlert(err.message || err, 'error');
    }
  }

  async function testConnection() {
    try { const d = await jsonp('ping'); toast(`חיבור תקין: ${d.version || ''}`); setConnection('ok','מחובר'); }
    catch(e){ showAlert(e.message, 'error'); setConnection('error','אין חיבור'); }
  }

  function normalizeState() {
    state.residents ||= []; state.surveys ||= []; state.photos ||= []; state.actions ||= []; state.history ||= []; state.plans ||= [];
    state.surveys = state.surveys.map(s => normalizeSurveyForForm(s));
    state.dashboard = buildDashboardRows();
  }

  function buildDashboardRows() {
    const surveyMap = new Map(state.surveys.map(s => [keyOf(s.buildingNumber, s.unitNumber), s]));
    const photoCounts = countBy(state.photos, p => keyOf(p.buildingNumber, p.unitNumber));
    const actionCounts = countBy(state.actions.filter(a => a.status !== 'סגור'), a => keyOf(a.buildingNumber, a.unitNumber));
    return state.residents.map(r => {
      const k = keyOf(r.buildingNumber, r.unitNumber);
      const s = surveyMap.get(k) || {};
      return { ...r, ...s, surveyId: s.surveyId || k, photoCount: photoCounts[k] || 0, openActionCount: actionCounts[k] || 0 };
    });
  }

  function keyOf(b,u){ return `${String(b||'').trim()}-${String(u||'').trim()}`; }
  function countBy(arr, fn){ return arr.reduce((m,x)=>{ const k=fn(x); m[k]=(m[k]||0)+1; return m; },{}); }

  function renderAll() { renderDashboard(); renderApartments(); renderPhotos(); renderActions(); renderHistory(); renderSelectedApartmentPhotos(); renderSelectedSurveyHistory(); }


  function splitMultiValue(value) {
    return String(value || '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);
  }

  function multiValueIncludes(value, option) {
    if (!option) return true;
    return splitMultiValue(value).includes(option);
  }

  function countByMultiValue(rows, field) {
    return rows.reduce((acc, row) => {
      const values = splitMultiValue(row[field]);
      values.forEach(v => { acc[v] = (acc[v] || 0) + 1; });
      return acc;
    }, {});
  }

  function renderDashboard() {
    const rows = state.dashboard;
    const total = rows.length;
    const completed = rows.filter(r => r.surveyStatus === 'הושלם').length;
    const ready = rows.filter(r => multiValueIncludes(r.executionReadinessStatus, 'מוכן לביצוע')).length;
    const conditional = rows.filter(r => multiValueIncludes(r.executionReadinessStatus, 'מוכן לביצוע בתנאים')).length;
    const notReady = rows.filter(r => multiValueIncludes(r.executionReadinessStatus, 'לא מוכן לביצוע')).length;
    const first = rows.filter(r => r.readyForFirstPhase === 'מתאים').length;
    const openActions = state.actions.filter(a => a.status !== 'סגור').length;
    const photos = state.photos.length;
    const kpiColors = ['','accent','primary','accent','danger','primary','warning','muted'];
    const kpis = [
      ['סה״כ דירות', total], ['סקרים הושלמו', completed], ['מוכנים לביצוע', ready], ['מוכנים בתנאים', conditional],
      ['לא מוכנים', notReady], ['מתאימים לפעימה ראשונה', first], ['משימות פתוחות', openActions], ['תמונות', photos]
    ];
    qs('#kpiGrid').innerHTML = kpis.map(([t,v],i) => `<div class="kpi ${kpiColors[i]||''}""><span>${esc(t)}</span><strong>${esc(v)}</strong></div>`).join('');
    renderBarChart('#readinessChart', rows, 'executionReadinessStatus');
    renderBarChart('#statusChart', rows, 'surveyStatus');
    renderBarChart('#decisionChart', rows, 'decisionRequiredBy');
    renderBarChart('#areaChart', rows, 'area');
    fillFilter('#filterArea', unique(rows.map(r=>r.area)), 'כל האזורים');
    fillFilter('#filterReadiness', unique(rows.flatMap(r => splitMultiValue(r.executionReadinessStatus))), 'כל סטטוסי המוכנות');
    fillFilter('#filterSurveyStatus', unique(rows.map(r=>r.surveyStatus)), 'כל סטטוסי הסקר');
    fillFilter('#filterFirstPhase', unique(rows.map(r=>r.readyForFirstPhase)), 'פעימה ראשונה - הכל');
    renderDashboardTable();
  }

  function renderBarChart(selector, rows, field) {
    const counts = field === 'executionReadinessStatus'
      ? countByMultiValue(rows, field)
      : countBy(rows.filter(r => r[field]), r => r[field]);
    const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const max = Math.max(1, ...entries.map(e=>e[1]));
    qs(selector).innerHTML = entries.length ? entries.map(([label,val]) => `
      <div class="bar-row"><span>${esc(label)}</span><div class="bar"><i style="width:${Math.round(val/max*100)}%"></i></div><b>${val}</b></div>`).join('') : '<p class="muted">אין נתונים</p>';
  }

  function renderDashboardTable() {
    const search = qs('#dashboardSearch').value.trim().toLowerCase();
    const area = qs('#filterArea').value;
    const readiness = qs('#filterReadiness').value;
    const surveyStatus = qs('#filterSurveyStatus').value;
    const first = qs('#filterFirstPhase').value;
    const rows = state.dashboard.filter(r => {
      const hay = [r.buildingNumber,r.unitNumber,r.area,r.residentName,r.surveyStatus,r.executionReadinessStatus,r.openBlockers].join(' ').toLowerCase();
      return (!search || hay.includes(search)) && (!area || r.area === area) && (!readiness || multiValueIncludes(r.executionReadinessStatus, readiness)) && (!surveyStatus || r.surveyStatus === surveyStatus) && (!first || r.readyForFirstPhase === first);
    });
    qs('#dashboardCount').textContent = `${rows.length} רשומות`;
    renderTable('#dashboardTable', ['מבנה','דירה','אזור','דייר','סטטוס סקר','מוכנות','מורכבות','חסם מרכזי','פעימה 1','תמונות','משימות','פעולה'], rows.map(r => [
      r.buildingNumber, r.unitNumber, r.area, r.residentName || '', badge(r.surveyStatus), badge(r.executionReadinessStatus), r.executionComplexity || '', truncate(r.openBlockers, 45), badge(r.readyForFirstPhase), r.photoCount || 0, r.openActionCount || 0,
      `<button class="btn mini" onclick="MamadApp.openSurvey('${escAttr(r.buildingNumber)}','${escAttr(r.unitNumber)}')">פתח / ערוך</button>`
    ]));
  }

  function renderApartments() {
    const areaSelect = qs('#apartmentsAreaFilter');
    fillFilter('#apartmentsAreaFilter', unique(state.residents.map(r=>r.area)), 'כל האזורים');
    areaSelect.value = areaSelect.value || '';
    const search = qs('#apartmentsSearch').value.trim().toLowerCase();
    const area = qs('#apartmentsAreaFilter').value;
    const rows = state.residents.filter(r => {
      const hay = [r.buildingNumber,r.unitNumber,r.area,r.residentName].join(' ').toLowerCase();
      return (!search || hay.includes(search)) && (!area || r.area === area);
    });
    qs('#apartmentsCount').textContent = `${rows.length} דירות`;
    renderTable('#apartmentsTable', ['מבנה','דירה','אזור','דייר','טלפון','תוכנית','פעולה'], rows.map(r => [
      r.buildingNumber, r.unitNumber, r.area, r.residentName || '', r.phone || '', planLink(r.buildingNumber), `<button class="btn mini" onclick="MamadApp.openSurvey('${escAttr(r.buildingNumber)}','${escAttr(r.unitNumber)}')">סקר</button>`
    ]));
    populateSelectors();
  }

  function renderPhotos() {
    const s = qs('#photosSearch').value.trim().toLowerCase();
    const photos = state.photos.filter(p => !s || [p.buildingNumber,p.unitNumber,p.photoType,p.photoDescription,p.fileName].join(' ').toLowerCase().includes(s));
    qs('#photosGrid').innerHTML = photos.length ? photos.map(p => `
      <div class="photo-card photo-card-wrap">
        <button type="button" class="photo-delete-btn" title="מחיקת תמונה" onclick="MamadApp.deletePhotoConfirm('${escAttr(p.photoId)}')">×</button>
        <a class="photo-card-link" href="${esc(p.fileUrl)}" target="_blank" rel="noreferrer">
          ${photoPreviewUrl(p) ? `<img class="photo-thumb-img" src="${esc(photoPreviewUrl(p))}" alt="${esc(p.photoDescription || p.fileName || 'תמונה')}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'), {className:'photo-thumb', textContent:'📷'}))">` : '<div class="photo-thumb">📷</div>'}
          <strong>מבנה ${esc(p.buildingNumber)} / דירה ${esc(p.unitNumber)}</strong>
          <span>${esc(p.photoType || 'תמונה')}</span>
          <small>${esc(p.photoDescription || p.fileName || '')}</small>
        </a>
      </div>`).join('') : '<p class="muted">אין תמונות להצגה.</p>';
  }

  function getPhotoSection(photoType) {
    const t = String(photoType || '').trim();
    if (['מיקום ממ״ד', 'מיקום ממ"ד', 'תכנון', 'מיקום ותכנון'].includes(t)) return 'planning';
    if (['גישה לכלים', 'ציר גישה', 'גישה', 'כלים הנדסיים'].includes(t)) return 'access';
    if (['תשתיות', 'חשמל', 'מים', 'ביוב', 'ניקוז', 'תקשורת', 'גז'].includes(t)) return 'infra';
    if (['נוי / עצים', 'נוי', 'עצים', 'פירוקים'].includes(t)) return 'garden';
    if (['פנים הדירה', 'פנים', 'חריגים', 'פנים וחריגים'].includes(t)) return 'interior';
    return 'other';
  }

  function selectedApartmentPhotos() {
    const b = qs('#buildingSelect')?.value || state.selectedApartment?.buildingNumber;
    const u = qs('#unitSelect')?.value || state.selectedApartment?.unitNumber;
    if (!b || !u) return [];
    return (state.photos || []).filter(p => String(p.buildingNumber) === String(b) && String(p.unitNumber) === String(u));
  }

  function renderSelectedApartmentPhotos() {
    const photos = selectedApartmentPhotos();
    const buckets = { planning: [], access: [], infra: [], garden: [], interior: [], other: [] };
    photos.forEach(p => buckets[getPhotoSection(p.photoType)].push(p));

    renderInlinePhotoBucket('#planningPhotos', buckets.planning, 'אין עדיין תמונות מיקום ותכנון לדירה זו.');
    renderInlinePhotoBucket('#accessPhotos', buckets.access, 'אין עדיין תמונות גישה וכלים לדירה זו.');
    renderInlinePhotoBucket('#infraPhotos', buckets.infra, 'אין עדיין תמונות תשתיות לדירה זו.');
    renderInlinePhotoBucket('#gardenPhotos', buckets.garden, 'אין עדיין תמונות נוי / פירוקים לדירה זו.');
    renderInlinePhotoBucket('#interiorPhotos', buckets.interior, 'אין עדיין תמונות פנים וחריגים לדירה זו.');
    renderInlinePhotoBucket('#otherPhotos', buckets.other, 'אין עדיין תמונות כלליות / אחרות לדירה זו.');
    renderInlinePhotoBucket('#currentSurveyPhotos', photos, 'אין עדיין תמונות לדירה זו.');
  }

  function renderInlinePhotoBucket(selector, photos, emptyText) {
    const el = qs(selector);
    if (!el) return;
    el.innerHTML = photos.length ? photos.map(photoCardHtml).join('') : `<p class="muted inline-empty">${esc(emptyText)}</p>`;
  }

  function photoPreviewUrl(p) {
    const id = p.driveFileId || p.fileId || p.drive_file_id || '';
    if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w500`;
    return '';
  }

  function photoCardHtml(p) {
    const preview = photoPreviewUrl(p);
    const title = p.photoDescription || p.fileName || p.photoType || 'תמונה';
    return `
      <div class="inline-photo-card inline-photo-wrap" title="${esc(title)}">
        <button type="button" class="photo-delete-btn inline" title="מחיקת תמונה" onclick="MamadApp.deletePhotoConfirm('${escAttr(p.photoId)}')">×</button>
        <a class="inline-photo-link" href="${esc(p.fileUrl)}" target="_blank" rel="noreferrer">
          ${preview ? `<img src="${esc(preview)}" alt="${esc(title)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'), {className:'photo-fallback', textContent:'📷'}))">` : '<div class="photo-fallback">📷</div>'}
          <div class="inline-photo-meta">
            <strong>${esc(p.photoType || 'תמונה')}</strong>
            <span>${esc(title)}</span>
          </div>
        </a>
      </div>`;
  }

  async function deletePhotoConfirm(photoId) {
    const photo = (state.photos || []).find(p => String(p.photoId) === String(photoId));
    if (!photo) {
      toast('התמונה לא נמצאה ברשימת התמונות המקומית. רענן נתונים ונסה שוב.');
      return;
    }

    const label = `${photo.photoType || 'תמונה'} — מבנה ${photo.buildingNumber || ''} / דירה ${photo.unitNumber || ''}`;
    const ok = window.confirm(`למחוק את התמונה?\n\n${label}\n\nהפעולה תסיר את הרשומה מהמערכת ותעביר את הקובץ ב-Google Drive לאשפה.`);
    if (!ok) return;

    try {
      await postIframe('deletePhoto', {
        photoId: photo.photoId,
        driveFileId: photo.driveFileId,
        surveyId: photo.surveyId,
        buildingNumber: photo.buildingNumber,
        unitNumber: photo.unitNumber
      });

      removePhotoFromState(photo.photoId);
      state.dashboard = buildDashboardRows();
      renderDashboard();
      renderPhotos();
      renderSelectedApartmentPhotos();
      updateSurveyRecordPanel(state.currentSurveyRecord ? 'edit' : 'new', state.currentSurveyRecord, {
        photos: selectedApartmentPhotos(),
        actions: selectedApartmentActions(),
        history: selectedApartmentHistory()
      });
      toast('התמונה נמחקה');
    } catch (e) {
      showAlert('מחיקת תמונה נכשלה: ' + (e.message || e), 'error');
    }
  }

  function removePhotoFromState(photoId) {
    state.photos = (state.photos || []).filter(p => String(p.photoId) !== String(photoId));
  }

  function renderActions() {
    const search = qs('#actionsSearch')?.value?.trim().toLowerCase() || '';
    const statusFilter = qs('#actionsStatusFilter')?.value || '';
    const all = state.actions || [];
    fillFilter('#actionsStatusFilter', unique(all.map(a => a.status)), 'כל הסטטוסים');
    if (statusFilter) qs('#actionsStatusFilter').value = statusFilter;
    const rows = all.filter(a => {
      const hay = [a.buildingNumber,a.unitNumber,a.category,a.actionDescription,a.owner,a.status,a.priority].join(' ').toLowerCase();
      return (!search || hay.includes(search)) && (!statusFilter || a.status === statusFilter);
    });
    renderTable('#actionsTable', ['מבנה','דירה','קטגוריה','משימה','אחראי','יעד','עדיפות','סטטוס','פעולה'], rows.map(a => [
      a.buildingNumber,a.unitNumber,a.category,truncate(a.actionDescription,70),a.owner,a.dueDate,a.priority,badge(a.status),
      `<button class="btn mini" onclick="MamadApp.editAction('${escAttr(a.actionId)}')">ערוך</button>`
    ]));
  }

  function openActionModal(action = null) {
    const modal = qs('#actionModal');
    const form = qs('#actionForm');
    form.reset();
    qs('#actionIdInput').value = action?.actionId || '';
    qs('#actionBuildingInput').value = action?.buildingNumber || qs('#buildingSelect')?.value || state.selectedApartment?.buildingNumber || '';
    qs('#actionUnitInput').value = action?.unitNumber || qs('#unitSelect')?.value || state.selectedApartment?.unitNumber || '';
    qs('#actionCategoryInput').value = action?.category || '';
    qs('#actionOwnerInput').value = action?.owner || '';
    qs('#actionDueDateInput').value = action?.dueDate || '';
    qs('#actionPriorityInput').value = action?.priority || 'רגילה';
    qs('#actionStatusInput').value = action?.status || 'פתוח';
    qs('#actionDescriptionInput').value = action?.actionDescription || '';
    qs('#actionClosureNotesInput').value = action?.closureNotes || '';
    modal.classList.remove('hidden');
  }

  function closeActionModal() { qs('#actionModal')?.classList.add('hidden'); }

  function editAction(actionId) {
    const action = (state.actions || []).find(a => String(a.actionId) === String(actionId));
    if (!action) return toast('המשימה לא נמצאה');
    openActionModal(action);
  }

  async function saveActionFromForm(ev) {
    ev.preventDefault();
    const payload = Object.fromEntries(new FormData(qs('#actionForm')).entries());
    if (!payload.buildingNumber || !payload.unitNumber || !payload.actionDescription) {
      toast('חובה למלא מבנה, דירה ותיאור משימה');
      return;
    }
    payload.surveyId = keyOf(payload.buildingNumber, payload.unitNumber);
    try {
      const res = await postIframe('saveAction', payload);
      toast('המשימה נשמרה');
      closeActionModal();
      await loadBootstrap();
      if (qs('#buildingSelect')?.value && qs('#unitSelect')?.value) {
        await loadSurveyToForm();
      }
      renderActions();
    } catch(e) {
      showAlert('שמירת משימה נכשלה: ' + e.message, 'error');
    }
  }

  function renderHistory() {
    const search = qs('#historySearch')?.value?.trim().toLowerCase() || '';
    const rows = (state.history || [])
      .slice()
      .sort((a,b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')))
      .filter(h => {
        const hay = [h.buildingNumber,h.unitNumber,h.residentName,h.area,h.submittedBy,h.surveyStatus,h.executionReadinessStatus,h.openBlockers,h.summary].join(' ').toLowerCase();
        return !search || hay.includes(search);
      });
    renderTable('#historyTable', ['תאריך','מבנה','דירה','סוקר','סוג שינוי','סטטוס','מוכנות','פעימה 1','חסמים','פעולה'], rows.map(h => [
      h.submittedAt,h.buildingNumber,h.unitNumber,h.submittedBy,h.changeType,badge(h.surveyStatus),badge(h.executionReadinessStatus),badge(h.readyForFirstPhase),truncate(h.openBlockers || h.summary,80),
      `<button class="btn mini" onclick="MamadApp.showSnapshot('${escAttr(h.historyId)}')">צפייה</button>`
    ]));
  }

  function showSnapshot(historyId) {
    const row = (state.history || []).find(h => String(h.historyId) === String(historyId));
    if (!row) return toast('לא נמצא Snapshot');
    let parsed = row.snapshotJson || '';
    try { parsed = JSON.stringify(JSON.parse(row.snapshotJson || '{}'), null, 2); } catch(e) {}
    qs('#snapshotOutput').textContent = parsed;
    qs('#snapshotModal').classList.remove('hidden');
  }

  function closeSnapshotModal() { qs('#snapshotModal')?.classList.add('hidden'); }

  async function runDiagnostics() {
    const b = qs('#diagBuilding')?.value || qs('#buildingSelect')?.value || '';
    const u = qs('#diagUnit')?.value || qs('#unitSelect')?.value || '';
    qs('#diagnosticsOutput').textContent = 'מריץ אבחון...';
    try {
      const res = await jsonp('diagnose', { buildingNumber: b, unitNumber: u });
      qs('#diagnosticsOutput').textContent = JSON.stringify(res, null, 2);
    } catch(e) {
      qs('#diagnosticsOutput').textContent = 'אבחון נכשל: ' + e.message + '\n\nבדוק שאתה משתמש בכתובת Web App שמסתיימת ב-/exec ושבוצע Deploy לגרסה החדשה.';
    }
  }

  function renderTable(selector, headers, rows) {
    qs(selector).innerHTML = `<thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>`;
  }

  function populateSelectors() {
    const buildings = unique(state.residents.map(r => r.buildingNumber));
    qs('#buildingSelect').innerHTML = '<option value="">בחר מבנה</option>' + buildings.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
    onBuildingChange();
  }

  function onBuildingChange() {
    const b = qs('#buildingSelect').value;
    const units = state.residents.filter(r => String(r.buildingNumber) === String(b));
    qs('#unitSelect').innerHTML = '<option value="">בחר דירה</option>' + units.map(r => `<option value="${esc(r.unitNumber)}">${esc(r.unitNumber)} — ${esc(r.residentName || '')}</option>`).join('');
    updateSelectedApartment();
  }

  function onUnitChange() { updateSelectedApartment(); loadSurveyToForm(); }

  function updateSelectedApartment() {
    const b = qs('#buildingSelect').value, u = qs('#unitSelect').value;
    const r = state.residents.find(x => String(x.buildingNumber) === String(b) && String(x.unitNumber) === String(u));
    state.selectedApartment = r || null;
    qs('#areaInput').value = r?.area || '';
    qs('#residentInput').value = r?.residentName || '';
    renderPlanPanel(r?.buildingNumber);
    renderSelectedApartmentPhotos();
    renderSelectedSurveyHistory();
    updateSurveyRecordPanel(qs('#buildingSelect').value && qs('#unitSelect').value ? 'new' : 'idle');
  }

  function renderPlanPanel(buildingNumber) {
    const link = getPlan(buildingNumber);
    qs('#planPanel').innerHTML = link ? `<a href="${esc(link)}" target="_blank" rel="noreferrer">פתיחת תוכנית מבנה ${esc(buildingNumber)}</a>` : '<span class="muted">לא נמצאה תוכנית מבנה מקושרת.</span>';
  }

  function getPlan(buildingNumber) { return (state.plans || []).find(p => String(p.buildingNumber) === String(buildingNumber))?.imageLink || ''; }
  function planLink(buildingNumber) { const l = getPlan(buildingNumber); return l ? `<a href="${esc(l)}" target="_blank">פתח</a>` : '<span class="muted">אין</span>'; }

  function openSurvey(building, unit) {
    showView('survey');
    qs('#buildingSelect').value = building;
    onBuildingChange();
    qs('#unitSelect').value = unit;
    updateSelectedApartment();
    loadSurveyToForm();
  }

  async function loadSurveyToForm() {
    const b = qs('#buildingSelect').value;
    const u = qs('#unitSelect').value;

    clearSurveyFieldsOnly();
    updateSurveyRecordPanel('idle');
    renderSelectedApartmentPhotos();

    if (!b || !u) return;

    updateSurveyRecordPanel('loading');

    try {
      const result = normalizeApiPayload(await jsonp('survey', { buildingNumber: b, unitNumber: u }));
      mergeCurrentSurveyPayload(result);

      const survey = result?.survey || null;
      const exists = result?.exists === true || !!survey;

      if (exists && survey) {
        fillSurveyForm(survey);
        state.currentSurveyRecord = survey;
        updateSurveyRecordPanel('edit', survey, result);
      } else {
        state.currentSurveyRecord = null;
        updateSurveyRecordPanel('new', null, result);
      }

      renderSelectedApartmentPhotos();
      renderActions();
      renderHistory();
      renderSelectedSurveyHistory();
      renderDashboard();
    } catch (e) {
      updateSurveyRecordPanel('error');
      showAlert('טעינת סקר קיים נכשלה: ' + e.message, 'error');
    }
  }

  function clearSurveyFieldsOnly() {
    const form = qs('#surveyForm');
    [...form.elements].forEach(el => {
      if (!el.name || ['buildingNumber','unitNumber','area','residentName'].includes(el.name)) return;
      if (el.tagName === 'SELECT') {
        el.value = el.name === 'columnStrengtheningRequired' ? 'לא נדרש' : '';
      } else if (el.type === 'file') {
        el.value = '';
      } else if (el.type === 'checkbox') {
        el.checked = false;
      } else {
        el.value = '';
      }
    });
    setMultiFromHidden('executionReadinessStatusMulti', '');
    syncAllMultiHiddenInputs();
    qs('#photoPreview').innerHTML = '';
    qs('#saveStatus').textContent = '';
  }

  const SURVEY_FIELD_ALIASES = {
    surveyId: ['surveyId', 'Survey_ID'],
    buildingNumber: ['buildingNumber', 'Building_Number'],
    unitNumber: ['unitNumber', 'Unit_Number'],
    residentName: ['residentName', 'Resident_Name'],
    area: ['area', 'Area'],
    surveyor: ['surveyor', 'Surveyor'],
    surveyDate: ['surveyDate', 'Survey_Date'],
    surveyStatus: ['surveyStatus', 'Survey_Status'],
    executionComplexity: ['executionComplexity', 'Execution_Complexity'],
    proposedMamadLocation: ['proposedMamadLocation', 'Proposed_Mamad_Location'],
    planningNotes: ['planningNotes', 'Planning_Notes'],
    locationFeasible: ['locationFeasible', 'Location_Feasible'],
    locationChangeRequired: ['locationChangeRequired', 'Location_Change_Required'],
    engineeringAccessStatus: ['engineeringAccessStatus', 'Engineering_Access_Status'],
    engineeringAccessPoint: ['engineeringAccessPoint', 'Engineering_Access_Point'],
    accessDemolitionRequired: ['accessDemolitionRequired', 'Access_Demolition_Required'],
    privateYardAccess: ['privateYardAccess', 'Private_Yard_Access'],
    sidewalkImpact: ['sidewalkImpact', 'Sidewalk_Impact'],
    accessNotes: ['accessNotes', 'Access_Notes'],
    electricityStatus: ['electricityStatus', 'Electricity_Status'],
    waterStatus: ['waterStatus', 'Water_Status'],
    sewageStatus: ['sewageStatus', 'Sewage_Status'],
    drainageStatus: ['drainageStatus', 'Drainage_Status'],
    communicationStatus: ['communicationStatus', 'Communication_Status'],
    gasStatus: ['gasStatus', 'Gas_Status'],
    acStatus: ['acStatus', 'AC_Status'],
    infraSurveyRequired: ['infraSurveyRequired', 'Infra_Survey_Required'],
    infraOwner: ['infraOwner', 'Infra_Owner'],
    columnStrengtheningRequired: ['columnStrengtheningRequired', 'Column_Strengthening_Required'],
    infrastructureNotes: ['infrastructureNotes', 'Infrastructure_Notes'],
    vegetationImpact: ['vegetationImpact', 'Vegetation_Impact'],
    vegetationType: ['vegetationType', 'Vegetation_Type'],
    vegetationAction: ['vegetationAction', 'Vegetation_Action'],
    treeImpact: ['treeImpact', 'Tree_Impact'],
    treePermitRequired: ['treePermitRequired', 'Tree_Permit_Required'],
    pergolaAction: ['pergolaAction', 'Pergola_Action'],
    fenceGateAction: ['fenceGateAction', 'Fence_Gate_Action'],
    outdoorCabinetAction: ['outdoorCabinetAction', 'Outdoor_Cabinet_Action'],
    externalAcAction: ['externalAcAction', 'External_AC_Action'],
    windowBarsShutterAction: ['windowBarsShutterAction', 'Window_Bars_Shutter_Action'],
    gardenDemolitionNotes: ['gardenDemolitionNotes', 'Garden_Demolition_Notes'],
    internalStructuralChange: ['internalStructuralChange', 'Internal_Structural_Change'],
    interiorChangeType: ['interiorChangeType', 'Interior_Change_Type'],
    kitchenImpact: ['kitchenImpact', 'Kitchen_Impact'],
    openingWindowDoorImpact: ['openingWindowDoorImpact', 'Opening_Window_Door_Impact'],
    smallApartmentFlag: ['smallApartmentFlag', 'Small_Apartment_Flag'],
    smallApartmentClassificationImpact: ['smallApartmentClassificationImpact', 'Small_Apartment_Classification_Impact'],
    planningCommitteeDecisionRequired: ['planningCommitteeDecisionRequired', 'Planning_Committee_Decision_Required'],
    interiorNotes: ['interiorNotes', 'Interior_Notes'],
    presentedToResident: ['presentedToResident', 'Presented_To_Resident'],
    residentCommentsReceived: ['residentCommentsReceived', 'Resident_Comments_Received'],
    residentComments: ['residentComments', 'Resident_Comments'],
    residentCommentDecision: ['residentCommentDecision', 'Resident_Comment_Decision'],
    readyForFirstPhase: ['readyForFirstPhase', 'Ready_For_First_Phase'],
    executionReadinessStatus: ['executionReadinessStatus', 'Execution_Readiness_Status'],
    decisionRequiredBy: ['decisionRequiredBy', 'Decision_Required_By'],
    openBlockers: ['openBlockers', 'Open_Blockers'],
    surveyorRecommendation: ['surveyorRecommendation', 'Surveyor_Recommendation'],
    lastUpdate: ['lastUpdate', 'Last_Update'],
    updatedBy: ['updatedBy', 'Updated_By']
  };

  function firstDefinedValue(obj, aliases) {
    for (const key of aliases) {
      if (Object.prototype.hasOwnProperty.call(obj || {}, key)) {
        const val = obj[key];
        if (val !== undefined && val !== null) return val;
      }
    }
    return '';
  }

  function normalizeSurveyForForm(survey) {
    const raw = survey || {};
    const s = {};
    Object.entries(SURVEY_FIELD_ALIASES).forEach(([uiName, aliases]) => {
      s[uiName] = firstDefinedValue(raw, aliases);
    });
    return s;
  }

  function normalizeDateInputValue(value) {
    if (!value) return '';
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
    return '';
  }

  function setSelectValueSafe(selectEl, rawValue) {
    const value = String(rawValue ?? '').trim();
    if (!value) {
      selectEl.value = '';
      return;
    }
    const options = Array.from(selectEl.options || []);
    const exact = options.find(o => String(o.value).trim() === value);
    if (exact) {
      selectEl.value = exact.value;
      return;
    }
    const byText = options.find(o => String(o.textContent).trim() === value);
    if (byText) {
      selectEl.value = byText.value;
      return;
    }
    // Do not drop DB values that are not in the current select list.
    // Add them visibly so data is preserved and the mismatch is obvious.
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = `${value} ⚠`;
    selectEl.appendChild(opt);
    selectEl.value = value;
  }

  function setFormElementValue(el, value) {
    if (!el) return;
    const normalized = value ?? '';
    if (el.tagName === 'SELECT') {
      setSelectValueSafe(el, normalized);
    } else if (el.type === 'checkbox') {
      el.checked = normalized === true || normalized === 'true' || normalized === 'כן';
    } else if (el.type === 'date') {
      el.value = normalizeDateInputValue(normalized);
    } else if (el.type !== 'file') {
      el.value = normalized;
    }
  }

  function fillSurveyForm(survey) {
    const form = qs('#surveyForm');
    if (!form || !survey) return;

    const normalized = normalizeSurveyForForm(survey);

    Object.entries(normalized).forEach(([fieldName, value]) => {
      setFormElementValue(form.elements[fieldName], value);
    });

    setMultiFromHidden('executionReadinessStatusMulti', normalized.executionReadinessStatus);

    state.currentSurveyRecord = normalized;

    // Critical debug line: keep this until field alignment is fully proven in production.
    console.info('MAMAD fillSurveyForm normalized survey:', normalized);
  }

  function sanitizeSurveyPayloadForServer(payload) {
    const form = qs('#surveyForm');
    if (!form || !payload) return { payload, warnings: [] };

    const warnings = [];

    qsa('select[data-options]', form).forEach(sel => {
      const name = sel.name;
      if (!name) return;

      const key = sel.dataset.options;
      const allowed = OPTIONS[key] || [];
      const value = String(payload[name] ?? '').trim();

      // If setSelectValueSafe added an old DB value with a warning marker, it is not a real UI option.
      // Do not send it back to the server, because it can block validation or preserve corrupted data.
      if (value && !allowed.includes(value)) {
        warnings.push(`${name}: "${value}" נמחק כי אינו מופיע ברשימת האפשרויות של ה-UI`);
        payload[name] = '';
        sel.value = '';
      }
    });

    return { payload, warnings };
  }

  function mergeCurrentSurveyPayload(result) {
    result = normalizeApiPayload(result);

    const b = qs('#buildingSelect').value;
    const u = qs('#unitSelect').value;
    const key = keyOf(b, u);

    const sameKey = (x) =>
      keyOf(x?.buildingNumber, x?.unitNumber) === key ||
      String(x?.surveyId || '') === key;

    state.surveys = (state.surveys || []).filter(x => !sameKey(x));
    if (result?.survey) state.surveys.push(result.survey);

    const photos = Array.isArray(result?.photos) ? result.photos : [];
    const actions = Array.isArray(result?.actions) ? result.actions : [];
    const history = Array.isArray(result?.history) ? result.history : [];

    state.photos = (state.photos || []).filter(x => !sameKey(x)).concat(photos);
    state.actions = (state.actions || []).filter(x => !sameKey(x)).concat(actions);
    state.history = (state.history || []).filter(x => !sameKey(x)).concat(history);
    state.dashboard = buildDashboardRows();
  }

  function updateSurveyRecordPanel(mode, survey = null, result = null) {
    const panel = qs('#surveyRecordPanel');
    if (!panel) return;
    panel.className = `survey-record-panel ${mode || 'new'}`;
    const modeEl = qs('#surveyRecordMode');
    const metaEl = qs('#surveyRecordMeta');
    const photoEl = qs('#surveyPhotoCount');
    const actionEl = qs('#surveyActionCount');

    const photos = result?.photos ?? selectedApartmentPhotos();
    const actions = result?.actions ?? selectedApartmentActions();
    const openActions = (actions || []).filter(a => a.status !== 'סגור').length;

    if (mode === 'loading') {
      modeEl.textContent = 'טוען סקר קיים...';
      metaEl.textContent = 'בודק בגיליון סקר ממדים לפי מבנה ודירה.';
    } else if (mode === 'edit') {
      modeEl.textContent = 'סקר קיים — מצב עריכה';
      metaEl.textContent = `Survey_ID: ${esc(survey?.surveyId || keyOf(qs('#buildingSelect').value, qs('#unitSelect').value))} | עודכן לאחרונה: ${esc(survey?.lastUpdate || 'לא ידוע')}`;
    } else if (mode === 'error') {
      modeEl.textContent = 'שגיאה בטעינת סקר';
      metaEl.textContent = 'הנתונים אולי קיימים ב־Sheet, אך לא נטענו לאתר.';
    } else if (qs('#buildingSelect').value && qs('#unitSelect').value) {
      modeEl.textContent = 'סקר חדש';
      metaEl.textContent = 'לא נמצא סקר שמור לדירה זו. שמירה תיצור רשומה חדשה.';
    } else {
      modeEl.textContent = 'בחר מבנה ודירה';
      metaEl.textContent = 'המערכת תטען אוטומטית סקר קיים אם כבר מולא.';
    }

    photoEl.textContent = `${(photos || []).length} תמונות`;
    actionEl.textContent = `${openActions} משימות פתוחות`;
    qs('#saveSurveyBtn').textContent = mode === 'edit' ? '💾 שמירת עדכון' : '💾 שמירת סקר';
  }


  function selectedApartmentHistory() {
    const b = qs('#buildingSelect')?.value || state.selectedApartment?.buildingNumber;
    const u = qs('#unitSelect')?.value || state.selectedApartment?.unitNumber;
    if (!b || !u) return [];
    const k = keyOf(b, u);
    return (state.history || [])
      .filter(h => keyOf(h.buildingNumber, h.unitNumber) === k || String(h.surveyId || '') === k)
      .sort((a,b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
  }

  function renderSelectedSurveyHistory() {
    const el = qs('#selectedHistoryPanel');
    if (!el) return;
    const rows = selectedApartmentHistory().slice(0, 5);
    if (!qs('#buildingSelect')?.value || !qs('#unitSelect')?.value) {
      el.innerHTML = '';
      return;
    }
    if (!rows.length) {
      el.innerHTML = '<div class="mini-history muted">אין עדיין היסטוריית שמירות לדירה זו.</div>';
      return;
    }
    el.innerHTML = `<div class="mini-history"><strong>היסטוריית עדכונים אחרונה</strong><div class="mini-history-list">${rows.map(h => `
      <button type="button" class="history-pill" onclick="MamadApp.showSnapshot('${escAttr(h.historyId)}')">
        <span>${esc(h.submittedAt || '')}</span>
        <b>${esc(h.submittedBy || 'לא צוין')}</b>
        <small>${esc(h.changeType || '')} · ${esc(h.surveyStatus || '')}</small>
      </button>`).join('')}</div></div>`;
  }

  function selectedApartmentActions() {
    const b = qs('#buildingSelect')?.value || state.selectedApartment?.buildingNumber;
    const u = qs('#unitSelect')?.value || state.selectedApartment?.unitNumber;
    if (!b || !u) return [];
    return (state.actions || []).filter(a => String(a.buildingNumber) === String(b) && String(a.unitNumber) === String(u));
  }

  function clearSurveyForm() {
    qs('#surveyForm').reset();
    setMultiFromHidden('executionReadinessStatusMulti', '');
    const strengthening = qs('[name="columnStrengtheningRequired"]');
    if (strengthening) strengthening.value = 'לא נדרש';
    qs('#photoPreview').innerHTML = '';
    qs('#saveStatus').textContent = '';
    state.currentSurveyRecord = null;
    populateSelectors();
    renderSelectedApartmentPhotos();
    renderSelectedSurveyHistory();
    updateSurveyRecordPanel('idle');
  }

  async function saveSurvey(ev) {
    ev.preventDefault();
    const form = qs('#surveyForm');
    syncAllMultiHiddenInputs();
    const fd = new FormData(form);
    let payload = Object.fromEntries(fd.entries());
    const sanitized = sanitizeSurveyPayloadForServer(payload);
    payload = sanitized.payload;
    if (sanitized.warnings.length) {
      console.warn('MAMAD save payload sanitized:', sanitized.warnings);
      toast('נוקו ערכים ישנים/לא חוקיים לפני שמירה. בדוק את ה-Console לפרטים.');
    }

    if (!payload.buildingNumber || !payload.unitNumber) {
      toast('חובה לבחור מבנה ודירה');
      return;
    }

    payload.surveyId = keyOf(payload.buildingNumber, payload.unitNumber);

    const savedBuildingNumber = payload.buildingNumber;
    const savedUnitNumber = payload.unitNumber;

    qs('#saveSurveyBtn').disabled = true;
    qs('#saveStatus').textContent = 'שומר...';

    try {
      const saveResult = await postIframe('upsertSurvey', payload);
      await uploadSelectedPhotos(payload);

      qs('#saveStatus').textContent = 'נשמר בהצלחה — טוען מחדש את הסקר השמור...';
      toast(saveResult?.mode === 'updated' || saveResult?.mode === 'upsert' ? 'הסקר עודכן' : 'הסקר נשמר');

      // Do not reset the form or reload the whole app immediately after save.
      // Reload only this survey from the backend, so the UI shows exactly what was stored.
      qs('#buildingSelect').value = savedBuildingNumber;
      onBuildingChange();
      qs('#unitSelect').value = savedUnitNumber;
      updateSelectedApartment();
      await loadSurveyToForm();

    } catch (e) {
      showAlert(e.message, 'error');
      qs('#saveStatus').textContent = 'שמירה נכשלה';
    } finally {
      qs('#saveSurveyBtn').disabled = false;
    }
  }

  async function uploadSelectedPhotos(surveyPayload) {
    const input = qs('#photoFiles');
    const files = [...(input.files || [])];
    if (!files.length) return;
    const max = config().MAX_PHOTO_SIZE_BYTES || 5 * 1024 * 1024;
    const tooBig = files.find(f => f.size > max);
    if (tooBig) throw new Error(`קובץ גדול מ־5MB: ${tooBig.name}`);
    const encoded = await Promise.all(files.map(fileToDataUrl));
    await postIframe('uploadPhotos', {
      surveyId: surveyPayload.surveyId,
      buildingNumber: surveyPayload.buildingNumber,
      unitNumber: surveyPayload.unitNumber,
      uploadedBy: surveyPayload.surveyor,
      files: encoded.map(f => ({...f, photoType: qs('#photoType').value, description: qs('#photoDescription').value}))
    });
    input.value = ''; qs('#photoPreview').innerHTML = '';
    renderSelectedApartmentPhotos();
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, size: file.size, type: file.type, dataUrl: reader.result });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function previewSelectedPhotos() {
    const files = [...(qs('#photoFiles').files || [])];
    qs('#photoPreview').innerHTML = files.map(f => `<span class="chip">${esc(f.name)} — ${(f.size/1024/1024).toFixed(2)}MB</span>`).join('');
  }

  function showView(view) {
    state.currentView = view;
    qsa('.view').forEach(v => v.classList.toggle('active', v.id === `${view}View`));
    qsa('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    const titles = { dashboard:['Dashboard','תמונת מצב מלאה לפי מבנה, דירה, חסמים ומוכנות לביצוע'], apartments:['דירות / מבנים','מקור המידע מה־Google Sheet'], survey:['טופס סקר','מילוי סקר שטח לפי דירה/מבנה'], photos:['תמונות','תמונות שהועלו מהשטח'], actions:['משימות','מעקב חסמים ומשימות פתוחות'], history:['היסטוריה','כל שמירה ועדכון שבוצעו לסקרים'], diagnostics:['בדיקות מערכת','אבחון טעינת נתונים וחיבור ל־Apps Script'], settings:['הגדרות','חיבור ל־Apps Script Backend'] };
    qs('#pageTitle').textContent = titles[view]?.[0] || '';
    qs('#pageSubtitle').textContent = titles[view]?.[1] || '';
  }

  function showStep(step) {
    qsa('.step-btn').forEach(b => b.classList.toggle('active', b.dataset.step === step));
    qsa('.step-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === step));
  }

  function fillFilter(selector, values, placeholder) {
    const el = qs(selector); const current = el.value;
    el.innerHTML = `<option value="">${esc(placeholder)}</option>` + values.filter(Boolean).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if (values.includes(current)) el.value = current;
  }

  function unique(arr){ return [...new Set(arr.filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(v => String(v).trim()))].sort((a,b)=>a.localeCompare(b,'he')); }
  function truncate(s,n){ s=String(s||''); return s.length>n ? esc(s.slice(0,n))+'…' : esc(s); }
  function escAttr(v){ return String(v ?? '').replace(/'/g, '&#39;').replace(/"/g,'&quot;'); }
  function badge(v){ if(!v) return '<span class="badge empty">—</span>'; return `<span class="badge">${esc(v)}</span>`; }

  function exportDashboardCsv() {
    const headers = ['buildingNumber','unitNumber','area','residentName','surveyStatus','executionReadinessStatus','executionComplexity','readyForFirstPhase','decisionRequiredBy','openBlockers','photoCount','openActionCount'];
    const lines = [headers.join(',')].concat(state.dashboard.map(r => headers.map(h => csvCell(r[h])).join(',')));
    const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `mamad-dashboard-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
  function exportHistoryCsv() {
    const headers = ['submittedAt','surveyId','buildingNumber','unitNumber','area','residentName','submittedBy','changeType','surveyStatus','executionReadinessStatus','readyForFirstPhase','decisionRequiredBy','openBlockers','summary'];
    const lines = [headers.join(',')].concat((state.history || []).map(r => headers.map(h => csvCell(r[h])).join(',')));
    const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `mamad-history-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  function csvCell(v){ return '"' + String(v ?? '').replace(/"/g,'""') + '"'; }

  function setConnection(kind, text){ const d=qs('#connectionDot'); d.className=`dot ${kind}`; qs('#connectionText').textContent=text; }
  function toast(msg){ const t=qs('#toast'); t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'), 2800); }
  function showAlert(msg, kind='info'){ const a=qs('#alertBox'); a.textContent=msg; a.className=`alert ${kind}`; setTimeout(()=>a.classList.add('hidden'), 8000); }

  return { init, openSurvey, editAction, showSnapshot, deletePhotoConfirm };
})();

window.MamadApp = App;
document.addEventListener('DOMContentLoaded', App.init);
