const LIMIT_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 50;
function permissions(user) {
  const admin = user.role === 'ADMIN';
  return {
    upload:admin || user.department === 'OPERATIONS',
    annotate:admin || user.department === 'RAMP',
    view:admin || ['OPERATIONS', 'RAMP'].includes(user.department)
  };
}
function source(body) {
  if (!Number.isInteger(body.expectedSequence) || body.expectedSequence < 0) throw new Error('Refresh the LIR before uploading');
  if (!['text','pdf'].includes(body.kind)) throw new Error('Upload PDF or plain text');
  let buffer;
  if (body.kind === 'text') {
    if (typeof body.text !== 'string' || !body.text.trim()) throw new Error('LIR text is required');
    const text = body.text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
    if (text.length > 120000 || text.split('\n').length > MAX_PAGES * 60 || text.split('\n').some(line => line.length > 200)) throw new Error('Text is too large (120,000 characters, 3,000 lines, 200 characters per line maximum)');
    buffer = Buffer.from(text, 'utf8');
  } else {
    if (typeof body.base64 !== 'string' || body.base64.length > Math.ceil(LIMIT_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.base64)) throw new Error('Invalid PDF upload');
    buffer = Buffer.from(body.base64, 'base64');
    if (!buffer.subarray(0,1024).includes(Buffer.from('%PDF-'))) throw new Error('The file is not a PDF');
  }
  if (!buffer.length || buffer.length > LIMIT_BYTES) throw new Error('Maximum document size is 5 MB');
  const filename = String(body.filename || (body.kind === 'pdf' ? 'LIR.pdf' : 'LIR.txt')).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0,120);
  return { kind:body.kind, original:buffer, filename, byteLength:buffer.length };
}
const unit = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
function annotations(body) {
  if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 0) throw new Error('Refresh before saving');
  if (typeof body.complete !== 'boolean') throw new Error('Invalid completion state');
  if (!Array.isArray(body.annotations) || body.annotations.length > 1000) throw new Error('Maximum 1,000 annotations');
  const clean = body.annotations.map(item => {
    if (!item || !['tick','nil','uld','uldonly','pcs','strike'].includes(item.type) || !Number.isInteger(item.page) || item.page < 1 || item.page > MAX_PAGES || !unit(item.x) || !unit(item.y)) throw new Error('Invalid annotation');
    const result = { type:item.type, page:item.page, x:item.x, y:item.y };
    if (item.type === 'strike') {
      if (!unit(item.x2)) throw new Error('Invalid strike endpoint');
      result.x2 = item.x2;
    }
    if (['uld','uldonly','pcs'].includes(item.type)) {
      if (typeof item.text !== 'string' || !item.text.trim() || item.text.length > 80) throw new Error('Annotation text must be 1–80 characters');
      result.text = item.text.trim();
      if (item.type === 'uld') {
        if (item.pieces != null && (typeof item.pieces !== 'string' || item.pieces.length > 20)) throw new Error('Invalid pieces');
        result.pieces = (item.pieces || '').trim();
      }
    }
    return result;
  });
  if (!Array.isArray(body.signature) || body.signature.length > 100) throw new Error('Invalid signature');
  let points = 0;
  const signature = body.signature.map(stroke => {
    if (!Array.isArray(stroke) || stroke.length < 2) throw new Error('Invalid signature stroke');
    points += stroke.length;
    if (points > 10000) throw new Error('Signature is too large');
    return stroke.map(p => {
      if (!p || !unit(p.x) || !unit(p.y)) throw new Error('Invalid signature point');
      return { x:p.x, y:p.y };
    });
  });
  if (body.complete && !signature.length) throw new Error('A signature is required to complete the LIR');
  return { annotations:clean, signature };
}
module.exports = { permissions, source, annotations, MAX_PAGES };
