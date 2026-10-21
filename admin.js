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
  toast(editando ? 'Imóvel atualizado.' : 'Imóvel salvo neste navegador. Clique em "Publicar no site" para que todos os visitantes vejam.', 'ok');
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
async function publicar(){
  const cfg = cfgPub();
  if(!cfg.repo || !cfg.token){ $('pubErr').textContent = 'Preencha o repositório e o token.'; $('modalPub').classList.add('open'); return; }
  const btn = $('pub');
  btn.disabled = true; btn.textContent = 'Publicando…';
  try {
    const publicados = cfg.publicados || {};
    const checks = cfg.checks || {};
    const mapa = {};
    const novosChecks = {};
    for(const im of imoveis){
      const prev = publicados[im.id] || [];
      const lista = [];
      for(let k=0;k<(im.fotos||[]).length;k++){
        const f = im.fotos[k];
        if(typeof f !== 'string' || !f.startsWith('data:')){ lista.push(f); continue; }
        const base = f.slice(f.indexOf(',')+1);
        const ck = checksum(base);
        const nome = prev[k] || (PASTA_FOTOS + '/' + slug(im.titulo) + '-' + im.id + '-' + (k+1) + '.jpg');
        if(checks[nome] !== ck){
          if(base.length > LIMITE_FOTO) throw new Error('a foto de "' + (im.titulo||'um imóvel') + '" é grande demais para publicar.');
          await putFile(cfg.repo, cfg.branch || 'main', nome, base, cfg.token);
        }
        novosChecks[nome] = ck;
        lista.push(nome);
      }
      mapa[im.id] = lista;
    }
    const conteudo = 'window.IMOVEIS_PADRAO = ' + JSON.stringify(imoveis.map(im => ({...im, fotos: mapa[im.id]})), null, 2) + ';\n';
    await putFile(cfg.repo, cfg.branch || 'main', 'data.js', b64(conteudo), cfg.token);
    cfg.publicados = mapa; cfg.checks = novosChecks;
    cfg.ultimo = checksum(JSON.stringify(imoveis));
    cfg.em = Date.now();
    salvarCfgPub(cfg);
    toast('Publicado! O site atualiza em instantes (1–2 min).', 'ok');
  } catch(e){
    toast('Falha ao publicar: ' + e.message, 'erro');
  } finally {
    btn.disabled = false; btn.textContent = 'Publicar no site';
    atualizarStatus();
  }
}
$('pub').onclick = () => {
  const cfg = cfgPub();
  $('pubRepo').value = cfg.repo || REPO_PADRAO;
  $('pubBranch').value = cfg.branch || 'main';
  $('pubToken').value = cfg.token || '';
  $('pubErr').textContent = '';
  $('modalPub').classList.add('open');
};
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
$('exp').onclick = () => {
  const txt = 'window.IMOVEIS_PADRAO = ' + JSON.stringify(imoveis,null,2) + ';\n';
  baixar('data.js', txt, 'text/javascript');
  try { navigator.clipboard.writeText(txt); } catch {}
  toast('data.js baixado e copiado. Substitua o arquivo no repositório para publicar.', 'ok');
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
