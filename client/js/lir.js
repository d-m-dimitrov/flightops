checkAuth();
const $ = id => document.getElementById(id);
const flightId = new URLSearchParams(location.search).get('id');
const base = `/api/lir/${encodeURIComponent(flightId || '')}`;
const canvas = $('documentCanvas'), ctx = canvas.getContext('2d');
const signatureCanvas = $('signatureCanvas'), signatureCtx = signatureCanvas.getContext('2d');
const background = document.createElement('canvas'), backgroundCtx = background.getContext('2d');
const state = { permissions:{}, sequence:0, revisions:[], doc:null, latestId:null, page:1, pages:0,
  annotations:[], signature:[], history:[], historyIndex:0, dirty:false, busy:false, stale:false,
  tool:'tick', pdf:null, textPages:[], ready:false, renderVersion:0, fileBuffer:null };
const touchView = window.matchMedia?.('(pointer: coarse)').matches || false;
const view = { zoom:1, fit:!touchView, pan:touchView };
function applyZoom() {
  const viewport = $('documentViewport');
  if (view.fit) view.zoom = Math.min(1, Math.max(0.1, (viewport.clientWidth - 24) / canvas.width));
  canvas.style.width = `${Math.round(canvas.width * view.zoom)}px`;
  $('zoomLabel').textContent = `${Math.round(view.zoom * 100)}%`;
  $('zoomOutBtn').disabled = view.zoom <= 0.25;
  $('zoomInBtn').disabled = view.zoom >= 3;
}
function setZoom(zoom) {
  const viewport = $('documentViewport');
  const oldWidth = canvas.getBoundingClientRect().width || canvas.width;
  const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / oldWidth;
  const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / oldWidth;
  view.fit = false; view.zoom = Math.min(3, Math.max(0.25, zoom));
  applyZoom();
  viewport.scrollLeft = centerX * canvas.width * view.zoom - viewport.clientWidth / 2;
  viewport.scrollTop = centerY * canvas.width * view.zoom - viewport.clientHeight / 2;
}
$('zoomInBtn').onclick = () => setZoom(view.zoom * 1.25);
$('zoomOutBtn').onclick = () => setZoom(view.zoom / 1.25);
$('actualSizeBtn').onclick = () => setZoom(1);
$('fitBtn').onclick = () => { view.fit=true; applyZoom(); };
$('panBtn').onclick = () => { view.pan=!view.pan; strikeStart=null; controls(); redraw(); };
window.addEventListener('resize', () => { if(view.fit) applyZoom(); });
let pendingServerChange = false;
let pendingAnnotation = null, strikeStart = null, signatureStroke = null;
const socket = io();
const live = io('/lir-live', { auth:callback => callback({ token:localStorage.getItem('token') || '' }) });
let remoteDraft = null, liveTimer = null;
function liveStatus(text) { $('liveStatus').textContent=text; }
function watchLive() {
  if (!live.connected || !state.doc) return;
  const id=state.doc._id;
  live.emit('watch',{documentId:id}, result => {
    if(state.doc?._id!==id)return;
    if(!result.ok)liveStatus(result.error);
    else if(!remoteDraft)liveStatus('Live connected · annotations appear here before Save.');
  });
}
function publishLive() {
  liveTimer=null;
  if(!live.connected || state.busy || !state.dirty || state.stale || !state.doc || remoteDraft)return;
  const id=state.doc._id, version=state.doc.annotationVersion;
  live.emit('draft',{documentId:id,expectedVersion:state.doc.annotationVersion,annotations:state.annotations}, result=>{
    if(state.doc?._id!==id || state.doc.annotationVersion!==version || !state.dirty)return;
    if(result.retry){queueLive();return;}
    if(!result.ok){state.stale=true;liveStatus(result.error);controls();}
    else liveStatus('LIVE · Sharing your unsaved annotations. Use Save to keep them.');
  });
}
function queueLive() { if(liveTimer)clearTimeout(liveTimer);liveTimer=setTimeout(publishLive,150); }
function releaseLive() {
  if(liveTimer)clearTimeout(liveTimer);liveTimer=null;
  if(live.connected)live.emit('leave',{});
  remoteDraft=null;
}
live.on('connect',watchLive);
live.on('connect_error',()=>liveStatus('Live unavailable. You can still save normally; reconnect or sign in again.'));
live.on('disconnect',()=>{
  remoteDraft=null;redraw();controls();
  liveStatus('Live disconnected · displaying saved or local annotations.');
});
live.on('draft',draft=>{
  if(draft.documentId!==state.doc?._id || draft.expectedVersion!==state.doc.annotationVersion || draft.owner===live.id || state.doc.status==='COMPLETED')return;
  if(state.dirty){state.stale=true;liveStatus(`${draft.author} is editing live. Your own draft is preserved; export it before refreshing.`);controls();return;}
  remoteDraft=draft;redraw();controls();
  liveStatus(`LIVE · ${draft.author} · UNSAVED preview. Editing pauses while this operator works.`);
});
live.on('draftCleared',data=>{
  if(data.documentId!==state.doc?._id)return;
  remoteDraft=null;redraw();controls();
  liveStatus('Live preview ended · displaying saved or local annotations.');
});
const liveHeartbeat=setInterval(publishLive,10000);
window.addEventListener('pagehide',()=>{clearInterval(liveHeartbeat);releaseLive();live.disconnect();});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
$('backLink').href = `dashboard.html?id=${encodeURIComponent(flightId || '')}`;
function message(text, kind = 'info') {
  $('message').textContent = text;
  $('message').className = `alert alert-${kind}`;
}
function london(value) { return new Date(value).toLocaleString('en-GB', { timeZone:'Europe/London', timeZoneName:'short' }); }
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers:{ Authorization:`Bearer ${localStorage.getItem('token') || ''}`,
    ...(options.body ? { 'Content-Type':'application/json' } : {}), ...options.headers } });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const failure = new Error(error.error || `Request failed (${response.status})`);
    failure.status = response.status;
    throw failure;
  }
  return response;
}
function editable() { return !remoteDraft && state.ready && state.permissions.annotate && !state.busy && !state.stale && state.doc?.status !== 'COMPLETED' && state.doc?._id === state.latestId; }
function controls() {
  if (!state.busy && pendingServerChange) { pendingServerChange=false; queueMicrotask(serverChanged); }
  const canEdit = editable();
  $('uploadSection').hidden = !state.permissions.upload;
  $('uploadBtn').disabled = state.busy;
  $('editor').hidden = !state.doc;
  $('annotationTools').hidden = !state.permissions.annotate || state.doc?.status === 'COMPLETED' || state.doc?._id !== state.latestId;
  $('signActions').hidden = $('annotationTools').hidden;
  $('annotationTools').querySelectorAll('button').forEach(btn => { btn.disabled = !canEdit; });
  $('saveBtn').disabled = !canEdit || !state.dirty;
  $('completeBtn').disabled = !canEdit || !state.signature.length;
  $('clearSignatureBtn').disabled = !canEdit;
  $('undoBtn').disabled = !canEdit || state.historyIndex <= 0;
  $('redoBtn').disabled = !canEdit || state.historyIndex >= state.history.length - 1;
  $('prevBtn').disabled = state.busy || !state.ready || state.page <= 1;
  $('nextBtn').disabled = state.busy || !state.ready || state.page >= state.pages;
  $('pngBtn').disabled = !state.ready || state.busy;
  $('sourceDownloadBtn').disabled = !state.doc || state.busy;
  $('refreshBtn').disabled = state.busy;
  $('revisionSelect').disabled = state.busy || !state.revisions.length;
  canvas.classList.toggle('editable',canEdit && !view.pan);
  $('panBtn').setAttribute('aria-pressed', String(view.pan));
  $('panBtn').classList.toggle('active',view.pan);
  $('viewHint').textContent = view.pan || !canEdit
    ? 'Move / read: swipe to scroll; pinch with two fingers to zoom. Select an annotation tool to mark the LIR.'
    : 'Annotation mode: tap to mark. Use + / − to zoom, or Move / read to scroll and pinch.';
  signatureCanvas.classList.toggle('editable',canEdit);
  $('status').textContent = state.doc ? `v${state.doc.revision} · ${state.doc.status}${state.dirty ? ' · Unsaved' : ''}` : 'No LIR uploaded';
  $('signatureInfo').textContent = state.doc?.signedAt
    ? `Signed by ${state.doc.signedByName} · ${london(state.doc.signedAt)}`
    : state.doc?.updatedByName ? `Last saved by ${state.doc.updatedByName} · ${london(state.doc.updatedAt)}` : 'Signature is recorded when RAMP completes the LIR.';
}
function historySave() {
  state.history = state.history.slice(0,state.historyIndex+1);
  state.history.push(JSON.stringify({ annotations:state.annotations, signature:state.signature }));
  if (state.history.length > 50) state.history.shift();
  state.historyIndex = state.history.length-1;
  state.dirty = true;
  queueLive();
  controls();
}
function historyInit() {
  state.history = [JSON.stringify({ annotations:state.annotations, signature:state.signature })];
  state.historyIndex = 0;
  state.dirty = false;
}
function coords(event, element) {
  const r = element.getBoundingClientRect();
  return { x:Math.max(0, Math.min(1,(event.clientX-r.left)/r.width)), y:Math.max(0,Math.min(1,(event.clientY-r.top)/r.height)) };
}
function drawMark(c, item, width, height) {
  const x = item.x*width, y=item.y*height;
  c.save();c.strokeStyle='#0066ff';c.fillStyle='#0066ff';c.lineWidth=2;c.lineCap='round';c.lineJoin='round';c.textBaseline='top';c.font='12px "Courier New", monospace';
  if(item.type==='tick') { c.lineWidth=3;c.beginPath();c.moveTo(x-5,y);c.lineTo(x,y+8);c.lineTo(x+12,y-8);c.stroke(); }
  else if(item.type==='strike') { c.beginPath();c.moveTo(x,y);c.lineTo(item.x2*width,y);c.stroke(); }
  else if(item.type==='nil') { c.font='18px Arial';c.fillText('NIL',x,y); }
  else if(item.type==='uldonly') { c.translate(x,y);c.rotate(Math.PI/2);c.fillText(item.text,0,0); }
  else if(item.type==='pcs') { c.fillStyle='#f00';c.strokeStyle='#f00';c.fillText(item.text,x,y);const w=c.measureText(item.text).width;c.beginPath();c.ellipse(x+w/2,y+6,w/2+5,10,0,0,Math.PI*2);c.stroke(); }
  else if(item.type==='uld') { c.fillText(item.text,x,y);if(item.pieces){const dx=x+c.measureText(item.text).width+5;c.fillStyle='#f00';c.strokeStyle='#f00';c.fillText(item.pieces,dx,y);const w=c.measureText(item.pieces).width;c.beginPath();c.ellipse(dx+w/2,y+6,w/2+5,10,0,0,Math.PI*2);c.stroke();} }
  c.restore();
}
function redraw(preview) {
  if(!state.ready)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(background,0,0);
  (remoteDraft?.annotations || state.annotations).filter(mark=>mark.page===state.page).forEach(mark=>drawMark(ctx,mark,canvas.width,canvas.height));
  if(preview)drawMark(ctx,preview,canvas.width,canvas.height);
}
function drawSignature() {
  signatureCtx.clearRect(0,0,signatureCanvas.width,signatureCanvas.height);
  signatureCtx.strokeStyle='#000';signatureCtx.lineWidth=2;signatureCtx.lineCap='round';
  [...state.signature,...(signatureStroke ? [signatureStroke] : [])].forEach(stroke=>{
    signatureCtx.beginPath();stroke.forEach((p,i)=>signatureCtx[i?'lineTo':'moveTo'](p.x*signatureCanvas.width,p.y*signatureCanvas.height));signatureCtx.stroke();
  });
}
async function renderPage() {
  const generation=++state.renderVersion;
  state.ready=false;controls();
  const pageCanvas=document.createElement('canvas');const c=pageCanvas.getContext('2d');
  if(state.pdf) {
    const page=await state.pdf.getPage(state.page);
    const natural=page.getViewport({scale:1});const viewport=page.getViewport({scale:900/natural.width});
    if(viewport.height>4000)throw new Error('PDF page is too tall to annotate safely');
    pageCanvas.width=900;pageCanvas.height=Math.ceil(viewport.height);
    c.fillStyle='#fff';c.fillRect(0,0,pageCanvas.width,pageCanvas.height);
    await page.render({canvasContext:c,viewport}).promise;
  } else {
    pageCanvas.width=900;pageCanvas.height=1100;c.fillStyle='#fff';c.fillRect(0,0,900,1100);c.fillStyle='#000';c.textBaseline='top';
    const lines=state.textPages[state.page-1] || [];
    // Fixed font for all pages of this version; long lines remain visible.
    const maxLength=Math.max(1,...state.textPages.flat().map(line=>line.length));
    const font=Math.min(12,850/(maxLength*0.61));c.font=`${font}px "Courier New", monospace`;
    lines.forEach((line,i)=>c.fillText(line,25,25+i*17));
  }
  if(generation!==state.renderVersion)return;
  canvas.width=background.width=pageCanvas.width;canvas.height=background.height=pageCanvas.height;
  backgroundCtx.drawImage(pageCanvas,0,0);state.ready=true;applyZoom();
  $('pageLabel').textContent=`Page ${state.page} of ${state.pages}`;
  redraw();drawSignature();controls();
}
async function openDocument(doc) {
  releaseLive();
  state.ready=false;state.stale=false;state.doc=doc;state.annotations=structuredClone(doc?.annotations || []);state.signature=structuredClone(doc?.signature || []);historyInit();controls();
  if(state.pdf)await state.pdf.destroy();state.pdf=null;state.fileBuffer=null;state.textPages=[];
  if(!doc){message('No LIR yet. OPS can upload PDF or paste text.');return;}
  $('documentInfo').textContent=`${doc.filename} · Uploaded by ${doc.uploadedByName} · ${london(doc.createdAt)}`;
  const response=await request(`${base}/${doc._id}/source`);
  state.fileBuffer=await response.arrayBuffer();
  if(doc.kind==='pdf') {
    const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
    state.pdf=await pdfjs.getDocument({data:new Uint8Array(state.fileBuffer.slice(0)),isEvalSupported:false}).promise;
    state.pages=state.pdf.numPages;if(state.pages>50)throw new Error('This PDF has more than 50 pages. OPS must upload a smaller document.');
  } else {
    const lines=new TextDecoder().decode(state.fileBuffer).split('\n');
    for(let i=0;i<lines.length;i+=60)state.textPages.push(lines.slice(i,i+60));
    state.pages=state.textPages.length;
  }
  state.page=1;await renderPage();watchLive();
  message(doc._id!==state.latestId?'Historical version — read only.':doc.status==='COMPLETED'?'Completed LIR — read only.':state.permissions.annotate?'RAMP: select a tool and annotate the document, then save.':'OPS: RAMP can now annotate this LIR.');
}
async function refresh() {
  if(state.busy)return;
  if(state.dirty&&!confirm('Discard unsaved local annotations and load the latest saved LIR?'))return;
  state.busy=true;controls();
  try {
    const data=await (await request(base)).json();
    state.permissions=data.permissions;state.sequence=data.sequence;state.revisions=data.revisions;state.latestId=data.document?._id;
    $('flightLabel').textContent=`${data.flight.display} · ${data.flight.operatingDate}`;
    $('revisionSelect').replaceChildren(...data.revisions.map(doc=>{const option=document.createElement('option');option.value=doc._id;option.textContent=`v${doc.revision} — ${doc.status}`;return option;}));
    await openDocument(data.document);
  } catch(error){state.ready=false;message(error.message,'danger');}
  finally{state.busy=false;controls();}
}
$('refreshBtn').onclick=refresh;
$('revisionSelect').onchange=async()=>{
  const id=$('revisionSelect').value;
  if(state.dirty&&!confirm('Discard unsaved local annotations?')){$('revisionSelect').value=state.doc._id;return;}
  state.busy=true;controls();
  try{await openDocument(await (await request(`${base}/${id}`)).json());}catch(error){state.ready=false;message(error.message,'danger');}finally{state.busy=false;controls();}
};
$('uploadBtn').onclick=async()=>{
  if(state.busy||!state.permissions.upload)return;
  const file=$('sourceFile').files[0];const pasted=$('sourceText').value;
  if(file&&pasted.trim()){message('Choose either a file or pasted text, not both.','warning');return;}
  if(!file&&!pasted.trim()){message('Choose a PDF/text file or paste LIR text.','warning');return;}
  if(state.doc&&!confirm('Upload a new version? Current annotations stay with the previous version.'))return;
  if(state.dirty&&!confirm('Discard your unsaved annotations?'))return;
  state.busy=true;controls();
  try{
    const body={expectedSequence:state.sequence};
    if(file){
      if(file.size>5*1024*1024)throw new Error('Maximum file size is 5 MB');
      body.filename=file.name;
      if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
        body.kind='pdf';const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));body.base64=btoa(binary);
      }else if(file.type==='text/plain'||/\.txt$/i.test(file.name)){body.kind='text';body.text=await file.text();}
      else throw new Error('Choose a PDF or .txt file');
    }else{body.kind='text';body.text=pasted;body.filename='LIR.txt';}
    await request(base,{method:'POST',body:JSON.stringify(body)});
    state.dirty=false;$('sourceFile').value='';$('sourceText').value='';state.busy=false;await refresh();
  }catch(error){message(error.message,'danger');}finally{state.busy=false;controls();}
};
document.querySelectorAll('[data-tool]').forEach(button=>button.onclick=()=>{
  view.pan=false;controls();state.tool=button.dataset.tool;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b===button));$('toolStatus').textContent=`Tool: ${button.textContent}`;
});
document.querySelector('[data-tool="tick"]').classList.add('active');
function addMark(mark){if(!editable())return;if(state.annotations.length>=1000){message('Maximum 1,000 annotations reached.','warning');return;}state.annotations.push(mark);historySave();redraw();}
canvas.onpointerdown=event=>{
  if(!editable() || view.pan)return;event.preventDefault();const pos=coords(event,canvas);
  if(state.tool==='strike'){strikeStart=pos;canvas.setPointerCapture(event.pointerId);return;}
  const mark={page:state.page,type:state.tool,...pos};
  if(['tick','nil'].includes(state.tool)){addMark(mark);return;}
  pendingAnnotation=mark;$('annotationText').value='';$('piecesText').value='';$('piecesGroup').hidden=state.tool!=='uld';
  $('dialogTitle').textContent=state.tool==='pcs'?'Pieces':state.tool==='uldonly'?'ULD Number (vertical)':'ULD Details';
  $('textLabel').textContent=state.tool==='pcs'?'Pieces':'ULD number';$('annotationDialog').showModal();$('annotationText').focus();
};
canvas.onpointermove=event=>{if(strikeStart&&editable()){event.preventDefault();redraw({page:state.page,type:'strike',...strikeStart,x2:coords(event,canvas).x});}};
canvas.onpointerup=event=>{if(!strikeStart)return;const start=strikeStart;strikeStart=null;if(editable()&&Math.abs(coords(event,canvas).x-start.x)>.004)addMark({page:state.page,type:'strike',...start,x2:coords(event,canvas).x});else redraw();};
canvas.onpointercancel=()=>{strikeStart=null;redraw();};
$('annotationDialog').addEventListener('close',()=>{if($('annotationDialog').returnValue==='add'&&pendingAnnotation&&$('annotationText').value.trim()){addMark({...pendingAnnotation,text:$('annotationText').value.trim().toUpperCase(),pieces:$('piecesText').value.trim()});}pendingAnnotation=null;});
function restoreHistory(delta){if(!editable())return;const index=state.historyIndex+delta;if(index<0||index>=state.history.length)return;state.historyIndex=index;Object.assign(state,JSON.parse(state.history[index]));state.dirty=true;queueLive();redraw();drawSignature();controls();}
$('undoBtn').onclick=()=>restoreHistory(-1);$('redoBtn').onclick=()=>restoreHistory(1);
$('clearPageBtn').onclick=()=>{if(editable()&&confirm('Clear annotations on this page?')){state.annotations=state.annotations.filter(mark=>mark.page!==state.page);historySave();redraw();}};
signatureCanvas.onpointerdown=event=>{if(!editable())return;event.preventDefault();signatureStroke=[coords(event,signatureCanvas)];signatureCanvas.setPointerCapture(event.pointerId);};
signatureCanvas.onpointermove=event=>{if(!signatureStroke)return;event.preventDefault();if(signatureStroke.length<2000)signatureStroke.push(coords(event,signatureCanvas));drawSignature();};
signatureCanvas.onpointerup=()=>{if(signatureStroke?.length>1&&editable()){state.signature.push(signatureStroke);signatureStroke=null;historySave();}else signatureStroke=null;drawSignature();};
signatureCanvas.onpointercancel=()=>{signatureStroke=null;drawSignature();};
$('clearSignatureBtn').onclick=()=>{if(editable()){state.signature=[];historySave();drawSignature();}};
async function save(complete){
  if(!editable())return;
  if(complete&&!confirm('Sign and complete this LIR? This version will become read only.'))return;
  state.busy=true;controls();
  try{
    const doc=await (await request(`${base}/${state.doc._id}/annotations`,{method:'PUT',body:JSON.stringify({expectedVersion:state.doc.annotationVersion,annotations:state.annotations,signature:state.signature,complete})})).json();
    state.doc=doc;state.dirty=false;historyInit();
    message(complete?'LIR signed and completed.':'Annotations saved.','success');
  }catch(error){if(error.status===409)state.stale=true;message(error.message,'danger');}finally{state.busy=false;controls();}
}
$('saveBtn').onclick=()=>save(false);$('completeBtn').onclick=()=>save(true);
async function changePage(delta){if(state.busy||!state.ready)return;state.busy=true;state.page+=delta;try{await renderPage();}catch(error){state.ready=false;message(error.message,'danger');}finally{state.busy=false;controls();}}
$('prevBtn').onclick=()=>changePage(-1);$('nextBtn').onclick=()=>changePage(1);
function download(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('sourceDownloadBtn').onclick=async()=>{try{const response=await request(`${base}/${state.doc._id}/source`);download(await response.blob(),state.doc.filename);}catch(error){message(error.message,'danger');}};
$('pngBtn').onclick=()=>{
  if(!state.ready)return;const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height+230;const c=out.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,out.width,out.height);c.drawImage(canvas,0,0);c.fillStyle='#000';c.font='14px Arial';c.fillText(`LIR v${state.doc.revision} · Page ${state.page}/${state.pages} · ${state.doc.status}${remoteDraft?' · LIVE UNSAVED PREVIEW':state.dirty?' · UNSAVED DRAFT':''}`,20,canvas.height+25);c.drawImage(signatureCanvas,20,canvas.height+40);c.fillText(state.doc.signedAt?`Signed: ${state.doc.signedByName} · ${london(state.doc.signedAt)}`:'Draft — not completed',20,canvas.height+215);out.toBlob(blob=>{if(blob)download(blob,`LIR-v${state.doc.revision}-page-${state.page}.png`);},'image/png');
};
window.addEventListener('beforeunload',event=>{if(state.dirty){event.preventDefault();event.returnValue='';}});
function serverChanged() {
  if(state.busy){pendingServerChange=true;return;}
  if(state.dirty){state.stale=true;message('LIR changed or connection restored. Your local annotations are preserved; download the draft before refreshing.','warning');controls();}
  else refresh();
}
socket.on('connect',()=>{socket.emit('joinFlight',flightId);serverChanged();});
socket.on('lirUpdated',serverChanged);
if(!/^[a-f\d]{24}$/i.test(flightId||''))message('Open eLIR from a flight dashboard.','danger');else refresh();
