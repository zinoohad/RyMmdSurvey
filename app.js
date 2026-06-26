const App = (() => {
  const OPTIONS = {
    yesNo: ['', 'כן', 'לא'],
    yesNoCheck: ['', 'כן', 'לא', 'לבדיקה'],
    surveyStatus: ['', 'לא נבדק', 'בבדיקה', 'חסר מידע', 'הושלם'],
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
  };

  const state = {
    residents: [],
    surveys: [],
    photos: [],
    actions: [],
    plans: [],
    dashboard: [],
    settings: {},
    selectedApartment: null,
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

  function bindEvents() {
    qsa('.nav-btn').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
    qs('#refreshBtn').addEventListener('click', loadBootstrap);
    qs('#newSurveyBtn').addEventListener('click', () => showView('survey'));
    qs('#exportCsvBtn').addEventListener('click', exportDashboardCsv);
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
      const timer = setTimeout(() => { cleanup(); reject(new Error('Timeout מול Apps Script')); }, 25000);
      function cleanup(){ clearTimeout(timer); delete window[callback]; script.remove(); }
      window[callback] = (res) => { cleanup(); res && res.ok ? resolve(res.data) : reject(new Error((res && res.error) || 'שגיאת שרת')); };
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
      const timer = setTimeout(() => { cleanup(); reject(new Error('שמירה נכשלה או לא התקבלה תשובה בזמן')); }, 60000);
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
    state.residents ||= []; state.surveys ||= []; state.photos ||= []; state.actions ||= []; state.plans ||= [];
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

  function renderAll() { renderDashboard(); renderApartments(); renderPhotos(); renderActions(); }

  function renderDashboard() {
    const rows = state.dashboard;
    const total = rows.length;
    const completed = rows.filter(r => r.surveyStatus === 'הושלם').length;
    const ready = rows.filter(r => r.executionReadinessStatus === 'מוכן לביצוע').length;
    const conditional = rows.filter(r => r.executionReadinessStatus === 'מוכן לביצוע בתנאים').length;
    const notReady = rows.filter(r => r.executionReadinessStatus === 'לא מוכן לביצוע').length;
    const first = rows.filter(r => r.readyForFirstPhase === 'מתאים').length;
    const openActions = state.actions.filter(a => a.status !== 'סגור').length;
    const photos = state.photos.length;
    const kpis = [
      ['סה״כ דירות', total], ['סקרים הושלמו', completed], ['מוכנים לביצוע', ready], ['מוכנים בתנאים', conditional],
      ['לא מוכנים', notReady], ['מתאימים לפעימה ראשונה', first], ['משימות פתוחות', openActions], ['תמונות', photos]
    ];
    qs('#kpiGrid').innerHTML = kpis.map(([t,v]) => `<div class="kpi"><span>${esc(t)}</span><strong>${esc(v)}</strong></div>`).join('');
    renderBarChart('#readinessChart', rows, 'executionReadinessStatus');
    renderBarChart('#statusChart', rows, 'surveyStatus');
    renderBarChart('#decisionChart', rows, 'decisionRequiredBy');
    renderBarChart('#areaChart', rows, 'area');
    fillFilter('#filterArea', unique(rows.map(r=>r.area)), 'כל האזורים');
    fillFilter('#filterReadiness', unique(rows.map(r=>r.executionReadinessStatus)), 'כל סטטוסי המוכנות');
    fillFilter('#filterSurveyStatus', unique(rows.map(r=>r.surveyStatus)), 'כל סטטוסי הסקר');
    fillFilter('#filterFirstPhase', unique(rows.map(r=>r.readyForFirstPhase)), 'פעימה ראשונה - הכל');
    renderDashboardTable();
  }

  function renderBarChart(selector, rows, field) {
    const counts = countBy(rows.filter(r => r[field]), r => r[field]);
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
      return (!search || hay.includes(search)) && (!area || r.area === area) && (!readiness || r.executionReadinessStatus === readiness) && (!surveyStatus || r.surveyStatus === surveyStatus) && (!first || r.readyForFirstPhase === first);
    });
    qs('#dashboardCount').textContent = `${rows.length} רשומות`;
    renderTable('#dashboardTable', ['מבנה','דירה','אזור','דייר','סטטוס סקר','מוכנות','מורכבות','חסם מרכזי','פעימה 1','תמונות','משימות','פעולה'], rows.map(r => [
      r.buildingNumber, r.unitNumber, r.area, r.residentName || '', badge(r.surveyStatus), badge(r.executionReadinessStatus), r.executionComplexity || '', truncate(r.openBlockers, 45), badge(r.readyForFirstPhase), r.photoCount || 0, r.openActionCount || 0,
      `<button class="btn mini" onclick="MamadApp.openSurvey('${escAttr(r.buildingNumber)}','${escAttr(r.unitNumber)}')">פתח</button>`
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
      <a class="photo-card" href="${esc(p.fileUrl)}" target="_blank" rel="noreferrer">
        <div class="photo-thumb">📷</div>
        <strong>מבנה ${esc(p.buildingNumber)} / דירה ${esc(p.unitNumber)}</strong>
        <span>${esc(p.photoType || 'תמונה')}</span>
        <small>${esc(p.photoDescription || p.fileName || '')}</small>
      </a>`).join('') : '<p class="muted">אין תמונות להצגה.</p>';
  }

  function renderActions() {
    const rows = state.actions || [];
    renderTable('#actionsTable', ['מבנה','דירה','קטגוריה','משימה','אחראי','יעד','עדיפות','סטטוס'], rows.map(a => [a.buildingNumber,a.unitNumber,a.category,a.actionDescription,a.owner,a.dueDate,a.priority,badge(a.status)]));
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

  function loadSurveyToForm() {
    const b = qs('#buildingSelect').value, u = qs('#unitSelect').value;
    const s = state.surveys.find(x => String(x.buildingNumber) === String(b) && String(x.unitNumber) === String(u));
    if (!s) return;
    const form = qs('#surveyForm');
    Object.entries(s).forEach(([key,val]) => { const el = form.elements[key]; if (el && !['buildingNumber','unitNumber','area','residentName'].includes(key)) el.value = val ?? ''; });
  }

  function clearSurveyForm() {
    qs('#surveyForm').reset(); qs('#photoPreview').innerHTML = ''; qs('#saveStatus').textContent = ''; populateSelectors();
  }

  async function saveSurvey(ev) {
    ev.preventDefault();
    const form = qs('#surveyForm');
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    if (!payload.buildingNumber || !payload.unitNumber) return toast('חובה לבחור מבנה ודירה');
    payload.surveyId = keyOf(payload.buildingNumber, payload.unitNumber);
    qs('#saveSurveyBtn').disabled = true; qs('#saveStatus').textContent = 'שומר...';
    try {
      await postIframe('upsertSurvey', payload);
      await uploadSelectedPhotos(payload);
      qs('#saveStatus').textContent = 'נשמר בהצלחה';
      toast('הסקר נשמר');
      await loadBootstrap();
    } catch (e) { showAlert(e.message, 'error'); qs('#saveStatus').textContent = 'שמירה נכשלה'; }
    finally { qs('#saveSurveyBtn').disabled = false; }
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
    const titles = { dashboard:['Dashboard','תמונת מצב מלאה לפי מבנה, דירה, חסמים ומוכנות לביצוע'], apartments:['דירות / מבנים','מקור המידע מה־Google Sheet'], survey:['טופס סקר','מילוי סקר שטח לפי דירה/מבנה'], photos:['תמונות','תמונות שהועלו מהשטח'], actions:['משימות','מעקב חסמים ומשימות פתוחות'], settings:['הגדרות','חיבור ל־Apps Script Backend'] };
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
  function csvCell(v){ return '"' + String(v ?? '').replace(/"/g,'""') + '"'; }

  function setConnection(kind, text){ const d=qs('#connectionDot'); d.className=`dot ${kind}`; qs('#connectionText').textContent=text; }
  function toast(msg){ const t=qs('#toast'); t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'), 2800); }
  function showAlert(msg, kind='info'){ const a=qs('#alertBox'); a.textContent=msg; a.className=`alert ${kind}`; setTimeout(()=>a.classList.add('hidden'), 8000); }

  return { init, openSurvey };
})();

window.MamadApp = App;
document.addEventListener('DOMContentLoaded', App.init);
