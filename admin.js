(function(){
try {

const SENHA_PADRAO = '123';
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CHAVE = 'oscar_imoveis';
const CHAVE_PUB = 'oscar_publicar';
const CAMPOS = ['titulo','tipo','local','preco','quartos','banheiros','area','descricao','vendido'];
const REPO_PADRAO = 'gustavomayan113-lang/oscar-corretor';
const PASTA_FOTOS = 'imagens';
const LIMITE_FOTO = 900000;

function senhaAtual(){ return SENHA_PADRAO; }
function listaPadrao(){ return [...(window.IMOVEIS_PADRAO||[])]; }
let seq = 0;
function normalizar(l){
  return (Array.isArray(l)?l:[]).map(i => {
    const o = {...i};
    o.id = Number.isFinite(Number(o.id)) ? Number(o.id) : Date.now() + (seq++);
    o.fotos = Array.isArray(o.fotos) ? o.fotos : [];
    return o;
  });
}
function carregar(){
  try { const s = localStorage.getItem(CHAVE); const v = s ? JSON.parse(s) : null; return Array.isArray(v) ? normalizar(v) : normalizar(listaPadrao()); }
  catch { return normalizar(listaPadrao()); }
}
function checksum(s){ let h = 2166136261; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h,16777619); } return (h>>>0).toString(16); }
function slug(t){ return String(t||'imovel').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40) || 'imovel'; }
function b64(str){ const bytes = new TextEncoder().encode(str); let bin=''; for(const b of bytes) bin += String.fromCharCode(b); return btoa(bin); }

let imoveis = carregar();
let fotos = [];
let editId = null;
let idExcluir = null;
let removido = null;
let timerToast = null;
let digitado = null;

const senhaEl = $('senha');
if(senhaEl){
  senhaEl.addEventListener('keyup', () => { digitado = senhaEl.value; });
  senhaEl.addEventListener('paste', () => setTimeout(() => { digitado = senhaEl.value; }, 0));
}

function entrar(){ $('login').style.display='none'; $('app').style.display='block'; render(); }
$('fLogin').onsubmit = e => {
  e.preventDefault();
  const v = String(digitado !== null ? digitado : ($('senha').value || '')).trim();
  if(v === senhaAtual()){ sessionStorage.setItem('oscar_auth','1'); $('senha').value=''; digitado=null; $('err').textContent=''; entrar(); }
  else { $('err').textContent = 'Senha incorreta.'; $('senha').value=''; digitado=null; }
};
$('sair').onclick = () => { sessionStorage.removeItem('oscar_auth'); location.href = 'index.html'; };

function toast(msg, tipo, acao, fn){
  const t = $('toast');
  t.className = 'toast show' + (tipo ? ' ' + tipo : '');
  $('toastMsg').textContent = msg;
  const b = $('toastAcao');
  if(acao){
    b.style.display = 'inline-block'; b.textContent = acao;
    b.onclick = () => { t.classList.remove('show'); if(fn) fn(); };
  } else { b.style.display = 'none'; b.onclick = null; }
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.classList.remove('show'), acao ? 9000 : 4500);
}

function salvar(){
  try { localStorage.setItem(CHAVE, JSON.stringify(imoveis)); return true; }
  catch { toast('Não foi possível salvar: o navegador está sem espaço. Remova imóveis ou use menos fotos.', 'erro'); return false; }
}

function render(){
  try {
    $('n').textContent = imoveis.length;
    $('list').innerHTML = imoveis.map(i => `
      <div class="admin-card${i.vendido?' vendido':''}">
        <div class="thumb">${i.fotos?.[0] ? `<img src="${esc(i.fotos[0])}" alt="${esc(i.titulo)}">` : '<span class="sem-foto">sem foto</span>'}</div>
        <div class="info">
          <b>${esc(i.titulo)}${i.vendido?' <span class="selo-vendido">Vendido</span>':''}</b>
          <div class="meta"><span>${esc(i.tipo)}</span><span>${esc(i.local)}</span><span>${esc(i.preco)}</span></div>
          <div class="meta">${esc(i.quartos||'')} qts · ${esc(i.banheiros||'')} ban · ${esc(i.area||'')} m²</div>
          <div class="actions">
            <button class="sm" data-e="${i.id}" type="button">Editar</button>
            <button class="sm ${i.vendido?'reativar':'vendido'}" data-v="${i.id}" type="button">${i.vendido?'Reativar':'Marcar vendido'}</button>
            <button class="sm del" data-d="${i.id}" type="button">Excluir</button>
          </div>
        </div>
      </div>`).join('') || '<p class="vazio">Nenhum imóvel ainda. Cadastre o primeiro no formulário ao lado.</p>';
    document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => editar(+b.dataset.e));
    document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => abrirExcluir(+b.dataset.d));
    document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
      const id = +b.dataset.v;
      imoveis = imoveis.map(i => i.id===id ? {...i, vendido: !i.vendido} : i);
      salvar(); render();
    });
  } catch(e){
    $('list').innerHTML = `<p class="vazio">Erro ao listar os imóveis: ${esc(e.message)}</p>`;
  }
  atualizarStatus();
}

function renderPrev(){
  $('prev').innerHTML = fotos.map((f,n)=>`<div><img src="${esc(f)}"><button type="button" data-r="${n}">×</button></div>`).join('');
  document.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { fotos.splice(+b.dataset.r,1); renderPrev(); });
}
function reduzir(file){
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const max = 1280, k = Math.min(1, max/Math.max(img.width,img.height));
      const c = document.createElement('canvas'); c.width = img.width*k; c.height = img.height*k;
      c.getContext('2d').drawImage(img,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',.72));
    }; img.src = r.result; };
    r.readAsDataURL(file);
  });
}
$('fotos').onchange = async e => {
  for(const f of e.target.files){
    const d = await reduzir(f);
    if(d.length > LIMITE_FOTO){ toast('Foto grande demais. Escolha uma imagem menor.', 'erro'); continue; }
    fotos.push(d);
  }
  e.target.value=''; renderPrev();
};
const campos = CAMPOS;
function limpar(){ $('form').reset(); $('vendido').checked=false; fotos=[]; editId=null; renderPrev(); $('ftitle').textContent='Novo imóvel'; $('cancel').style.display='none'; }
function editar(id){
  const i = imoveis.find(x=>x.id===id); if(!i) return; editId=id;
  campos.forEach(c => { if(c==='vendido'){ $(c).checked = !!i[c]; } else { $(c).value = i[c] ?? ''; } });
  fotos=[...(i.fotos||[])]; renderPrev();
  $('ftitle').textContent='Editar imóvel'; $('cancel').style.display='block'; scrollTo({top:0,behavior:'smooth'});
}
$('cancel').onclick = limpar;

function abrirExcluir(id){
  const i = imoveis.find(x => x.id === id); if(!i) return;
  idExcluir = id;
  $('delInfo').innerHTML = `
    <div class="del-thumb">${i.fotos?.[0] ? `<img src="${esc(i.fotos[0])}" alt="">` : ''}</div>
    <div class="del-txt"><b>${esc(i.titulo)}</b><span>${esc(i.tipo)} · ${esc(i.local)} · ${esc(i.preco)}</span></div>`;
  $('modalExcluir').classList.add('open');
  $('confirmExcluir').focus();
}
function fecharExcluir(){ $('modalExcluir').classList.remove('open'); idExcluir = null; }
function excluir(){
  if(idExcluir == null) return;
  const idx = imoveis.findIndex(i => i.id === idExcluir);
  if(idx < 0){ fecharExcluir(); return; }
  removido = { imovel: imoveis[idx], indice: idx };
  imoveis.splice(idx,1);
  if(editId === idExcluir) limpar();
  salvar(); render();
  fecharExcluir();
  toast('"' + (removido.imovel.titulo||'Imóvel') + '" foi excluído.', 'erro', 'Desfazer', desfazer);
}
function desfazer(){
  if(!removido) return;
  const pos = Math.min(removido.indice, imoveis.length);
  imoveis.splice(pos, 0, removido.imovel);
  const nome = removido.imovel.titulo;
  removido = null;
  salvar(); render();
  toast('"' + (nome||'Imóvel') + '" voltou para a lista.', 'ok');
}
$('cancelExcluir').onclick = fecharExcluir;
$('modalExcluir').onclick = e => { if(e.target === $('modalExcluir')) fecharExcluir(); };
$('confirmExcluir').onclick = excluir;

$('form').onsubmit = e => {
  e.preventDefault();
  const d = {};
  campos.forEach(c => {
    if(c === 'vendido') d[c] = $('vendido').checked;
    else d[c] = $(c).value;
  });
  d.fotos = [...fotos];
  const editando = !!editId;
  const antes = JSON.stringify(imoveis);
  if(editId) imoveis = imoveis.map(i => i.id===editId ? {...d,id:editId} : i);
  else imoveis.unshift({...d, id: Date.now()});
  if(!salvar()){ imoveis = JSON.parse(antes); render(); return; }
  limpar(); render();
  if(cfgPub().token && cfgPub().repo){
    publicar();
  } else {
    toast('Imóvel salvo. Agora publique para o site ficar visível para todos.', 'ok', 'Publicar', () => abrirPublicar());
  }
};

function cfgPub(){ try { return JSON.parse(localStorage.getItem(CHAVE_PUB) || '{}'); } catch { return {}; } }
function salvarCfgPub(c){ localStorage.setItem(CHAVE_PUB, JSON.stringify(c)); }
function atualizarStatus(){
  const cfg = cfgPub();
  const s = $('pubStatus');
  if(!cfg.repo || !cfg.token){ s.innerHTML = '<span class="dot wait"></span>Publicação não configurada — os imóveis ficam só neste navegador.'; return; }
  if(cfg.ultimo && cfg.ultimo !== checksum(JSON.stringify(imoveis))){ s.innerHTML = '<span class="dot wait"></span>Há alterações ainda não publicadas no site.'; return; }
  if(cfg.em){ s.innerHTML = '<span class="dot ok"></span>Publicado em ' + esc(new Date(cfg.em).toLocaleString('pt-BR')) + '.'; return; }
  s.innerHTML = '<span class="dot wait"></span>Pronto para publicar.';
}
async function putFile(repo, branch, path, contentB64, token){
  const url = 'https://api.github.com/repos/' + repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
  let sha = null;
  try {
    const r = await fetch(url + '?ref=' + encodeURIComponent(branch), { headers });
    if(r.ok){ const j = await r.json(); sha = j.sha || null; }
  } catch {}
  const body = { message: 'Atualiza os imóveis do site', content: contentB64, branch };
  if(sha) body.sha = sha;
  const res = await fetch(url, { method:'PUT', headers, body: JSON.stringify(body) });
  const j = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(j.message || ('HTTP ' + res.status));
  return j;
}
function nomesFotos(){
  const cfg = cfgPub();
  const publicados = cfg.publicados || {};
  const mapa = {};
  for(const im of imoveis){
    const prev = publicados[im.id] || [];
    mapa[im.id] = (im.fotos||[]).map((f,k) => {
      if(typeof f !== 'string' || !f.startsWith('data:')) return f;
      return prev[k] || (PASTA_FOTOS + '/' + slug(im.titulo) + '-' + im.id + '-' + (k+1) + '.jpg');
    });
  }
  return mapa;
}
function textoDataJs(mapa){
  return 'window.IMOVEIS_PADRAO = ' + JSON.stringify(imoveis.map(im => ({...im, fotos: mapa[im.id]})), null, 2) + ';\n';
}
function bytesBase64(dataUrl){
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',')+1));
  const out = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
}
let tabelaCrc = null;
function crc32(bytes){
  if(!tabelaCrc){
    tabelaCrc = new Uint32Array(256);
    for(let n=0;n<256;n++){
      let c = n;
      for(let k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1);
      tabelaCrc[n] = c>>>0;
    }
  }
  let crc = 0xFFFFFFFF;
  for(let i=0;i<bytes.length;i++) crc = tabelaCrc[(crc ^ bytes[i]) & 0xFF] ^ (crc>>>8);
  return (crc ^ 0xFFFFFFFF)>>>0;
}
function fazerZip(arquivos){
  const enc = new TextEncoder();
  const partes = [];
  const centro = [];
  let offset = 0;
  const ag = new Date();
  const hora = ((ag.getHours()&31)<<11) | ((ag.getMinutes()&63)<<5) | ((ag.getSeconds()/2)&31);
  const dia = (((ag.getFullYear()-1980)&127)<<9) | (((ag.getMonth()+1)&15)<<5) | (ag.getDate()&31);
  for(const arq of arquivos){
    const nome = enc.encode(arq.nome);
    const crc = crc32(arq.bytes);
    const lh = new Uint8Array(30 + nome.length);
    const dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(8, 0, true);
    dv.setUint16(10, hora, true); dv.setUint16(12, dia, true);
    dv.setUint32(14, crc, true); dv.setUint32(18, arq.bytes.length, true); dv.setUint32(22, arq.bytes.length, true);
    dv.setUint16(26, nome.length, true);
    lh.set(nome, 30);
    const cd = new Uint8Array(46 + nome.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, hora, true); cv.setUint16(14, dia, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, arq.bytes.length, true); cv.setUint32(24, arq.bytes.length, true);
    cv.setUint16(28, nome.length, true); cv.setUint32(42, offset, true);
    cd.set(nome, 46);
    partes.push(lh, arq.bytes);
    centro.push(cd);
    offset += lh.length + arq.bytes.length;
  }
  let tamCentro = 0;
  centro.forEach(c => tamCentro += c.length);
  const fim = new Uint8Array(22);
  const fv = new DataView(fim.buffer);
  fv.setUint32(0, 0x06054b50, true);
  fv.setUint16(8, centro.length, true); fv.setUint16(10, centro.length, true);
  fv.setUint32(12, tamCentro, true); fv.setUint32(16, offset, true);
  return new Blob([...partes, ...centro, fim], {type:'application/zip'});
}
async function publicar(){
  const cfg = cfgPub();
  if(!cfg.repo || !cfg.token){ $('pubErr').textContent = 'Preencha o repositório e o token.'; $('modalPub').classList.add('open'); return; }
  const btn = $('pub');
  btn.disabled = true; btn.textContent = 'Publicando…';
  try {
    const publicados = cfg.publicados || {};
    const checks = cfg.checks || {};
    const mapa = nomesFotos();
    const novosChecks = {};
    for(const im of imoveis){
      for(let k=0;k<(im.fotos||[]).length;k++){
        const f = im.fotos[k];
        if(typeof f !== 'string' || !f.startsWith('data:')) continue;
        const base = f.slice(f.indexOf(',')+1);
        const ck = checksum(base);
        const nome = mapa[im.id][k];
        if(checks[nome] !== ck){
          if(base.length > LIMITE_FOTO) throw new Error('a foto de "' + (im.titulo||'um imóvel') + '" é grande demais para publicar.');
          await putFile(cfg.repo, cfg.branch || 'main', nome, base, cfg.token);
        }
        novosChecks[nome] = ck;
      }
    }
    await putFile(cfg.repo, cfg.branch || 'main', 'data.js', b64(textoDataJs(mapa)), cfg.token);
    cfg.publicados = mapa; cfg.checks = novosChecks;
    cfg.ultimo = checksum(JSON.stringify(imoveis));
    cfg.em = Date.now();
    salvarCfgPub(cfg);
    toast('Publicado! O site atualiza em instantes (1–2 min).', 'ok');
  } catch(e){
    const m = String(e && e.message || e);
    let dica = m;
    if(/401|Bad credentials/i.test(m)) dica = 'token inválido ou expirado. Gere um novo token no GitHub.';
    else if(/403|Forbidden/i.test(m)) dica = 'o token não tem permissão de escrita neste repositório.';
    else if(/404|Not Found/i.test(m)) dica = 'repositório ou branch não encontrado. Confira o nome e a branch.';
    else if(/401|403/.test(m)) dica = 'permissão negada pelo GitHub.';
    toast('Não foi possível publicar: ' + dica, 'erro');
  } finally {
    btn.disabled = false; btn.textContent = 'Publicar no site';
    atualizarStatus();
  }
}
function abrirPublicar(){
  const cfg = cfgPub();
  $('pubRepo').value = cfg.repo || REPO_PADRAO;
  $('pubBranch').value = cfg.branch || 'main';
  $('pubToken').value = cfg.token || '';
  $('pubErr').textContent = '';
  $('modalPub').classList.add('open');
  $('pubToken').focus();
}
$('pub').onclick = abrirPublicar;
$('cancelPub').onclick = () => $('modalPub').classList.remove('open');
$('modalPub').onclick = e => { if(e.target === $('modalPub')) $('modalPub').classList.remove('open'); };
$('fPub').onsubmit = e => {
  e.preventDefault();
  const repo = $('pubRepo').value.trim();
  const branch = $('pubBranch').value.trim() || 'main';
  const token = $('pubToken').value.trim();
  if(!repo || !token){ $('pubErr').textContent = 'Preencha o repositório e o token.'; return; }
  const cfg = cfgPub();
  cfg.repo = repo; cfg.branch = branch; cfg.token = token;
  salvarCfgPub(cfg);
  $('modalPub').classList.remove('open');
  publicar();
};

function baixar(nome, txt, tipo){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:tipo})); a.download=nome; a.click(); }
$('abrirGithub').onclick = () => {
  const cfg = cfgPub();
  const repo = cfg.repo || REPO_PADRAO;
  const branch = cfg.branch || 'main';
  const txt = textoDataJs(nomesFotos());
  try { navigator.clipboard.writeText(txt); } catch {}
  window.open('https://github.com/' + repo + '/edit/' + branch + '/data.js', '_blank');
  toast('data.js copiado. Na aba do GitHub, cole (Ctrl+V) no lugar do texto antigo e clique em "Commit changes". A Vercel publica em seguida.', 'ok');
};
$('baixarPacote').onclick = () => {
  const mapa = nomesFotos();
  const arquivos = [{ nome:'data.js', bytes: new TextEncoder().encode(textoDataJs(mapa)) }];
  for(const im of imoveis){
    (im.fotos||[]).forEach((f,k) => {
      if(typeof f !== 'string' || !f.startsWith('data:')) return;
      arquivos.push({ nome: mapa[im.id][k], bytes: bytesBase64(f) });
    });
  }
  const blob = fazerZip(arquivos);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'oscar-imoveis.zip'; a.click();
  toast(arquivos.length > 1
    ? 'Pacote baixado (data.js + fotos). Descompacte, envie os arquivos no GitHub em "Add file → Upload files" e faça o commit.'
    : 'Pacote baixado (só o data.js). Envie o arquivo no GitHub em "Add file → Upload files" e faça o commit.', 'ok');
};

$('exp').onclick = () => {
  const txt = 'window.IMOVEIS_PADRAO = ' + JSON.stringify(imoveis,null,2) + ';\n';
  baixar('data.js', txt, 'text/javascript');
  try { navigator.clipboard.writeText(txt); } catch {}
  const temFoto = imoveis.some(i => (i.fotos||[]).some(f => String(f).startsWith('data:')));
  toast(temFoto
    ? 'data.js baixado e copiado, mas ele ficou grande por causa das fotos. Nesse caso use "Publicar no site" (com token): as fotos vão como arquivos.'
    : 'data.js baixado e copiado. No GitHub, abra o arquivo data.js, cole o conteúdo e clique em "Commit changes". A Vercel publica em instantes.', 'ok');
};
$('bkp').onclick = () => baixar('imoveis-backup.json', JSON.stringify(imoveis), 'application/json');
$('imp').onchange = e => { const r=new FileReader(); r.onload=()=>{ try{ const v=JSON.parse(r.result); if(!Array.isArray(v)) throw 0; imoveis=normalizar(v); salvar(); render(); toast('Backup restaurado!', 'ok'); }catch{ toast('Arquivo inválido.', 'erro'); } }; r.readAsText(e.target.files[0]); };
$('rst').onclick = () => {
  if(!confirm('Substituir a lista atual pelos imóveis padrão do site?')) return;
  imoveis = normalizar(listaPadrao()); salvar(); render();
  toast('Lista restaurada com os imóveis padrão.', 'ok');
};

window.addEventListener('storage', e => { if(e.key === CHAVE){ imoveis = carregar(); render(); } });

try { localStorage.removeItem('oscar_pwd'); sessionStorage.removeItem('oscar_senha'); } catch {}

function limparSenha(){ const s = $('senha'); if(s) s.value=''; digitado = null; }
window.addEventListener('pageshow', limparSenha);
window.addEventListener('load', () => setTimeout(limparSenha, 400));

if(sessionStorage.getItem('oscar_auth')==='1') entrar();

} catch(e){
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;background:#b42318;color:#fff;padding:14px 18px;font:13px/1.5 monospace;z-index:9999;white-space:pre-wrap';
  d.textContent = 'Erro no painel: ' + (e && e.message ? e.message : e);
  document.body.appendChild(d);
  console.error(e);
}
})();
