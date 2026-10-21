// Senha padrão para teste: 123 — pode ser trocada pelo painel.
const SENHA_PADRAO = '123';
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function senhaAtual(){ return localStorage.getItem('oscar_pwd') || SENHA_PADRAO; }

async function entrar(){ $('login').style.display='none'; $('app').style.display='block'; render(); }
if(sessionStorage.getItem('oscar_auth')==='1') entrar();
$('fLogin').onsubmit = e => {
  e.preventDefault();
  if($('senha').value === senhaAtual()){ sessionStorage.setItem('oscar_auth','1'); entrar(); }
  else { $('err').textContent = 'Senha incorreta.'; $('senha').value=''; }
};
$('sair').onclick = () => { sessionStorage.removeItem('oscar_auth'); location.href = 'index.html'; };

// --- Alterar senha pelo painel ---
const modalSenha = $('modalSenha');
$('btnTrocarSenha').onclick = () => { modalSenha.classList.add('open'); $('senhaAtual').value=''; $('novaSenha').value=''; $('confirmaSenha').value=''; $('senhaAtual').focus(); $('errSenha').textContent=''; };
$('cancelSenha').onclick = () => { modalSenha.classList.remove('open'); };
modalSenha.onclick = e => { if(e.target===modalSenha) modalSenha.classList.remove('open'); };

$('fTrocaSenha').onsubmit = e => {
  e.preventDefault();
  const atual = $('senhaAtual').value;
  const nova = $('novaSenha').value;
  const conf = $('confirmaSenha').value;
  if(nova !== conf){ $('errSenha').textContent = 'As senhas não conferem.'; return; }
  if(atual !== senhaAtual()){ $('errSenha').textContent = 'Senha atual incorreta.'; return; }
  localStorage.setItem('oscar_pwd', nova);
  modalSenha.classList.remove('open');
  alert('Senha alterada com sucesso!');
};

// Botão para redefinir senha de volta para 123
$('btnRedefinir123').onclick = () => {
  if(confirm('Redefinir a senha para 123?')){ localStorage.removeItem('oscar_pwd'); alert('Senha redefinida para 123.'); }
};

let imoveis = JSON.parse(localStorage.getItem('oscar_imoveis') || 'null') || [...(window.IMOVEIS_PADRAO||[])];
let fotos = [], editId = null;
function salvar(){
  try { localStorage.setItem('oscar_imoveis', JSON.stringify(imoveis)); return true; }
  catch { alert('Espaço do navegador cheio. Use menos fotos ou remova imóveis antigos.'); return false; }
}
function render(){
  $('n').textContent = imoveis.length;
  $('list').innerHTML = imoveis.map(i => `
    <div class="admin-card${i.vendido?' vendido':''}" id="card-${i.id}">
      <img src="${i.fotos?.[0]||''}" alt="${esc(i.titulo)}">
      <div class="info">
        <b>${esc(i.titulo)}${i.vendido?' <span class="selo-vendido">Vendido</span>':''}</b>
        <div class="meta"><span>${esc(i.tipo)}</span><span>${esc(i.local)}</span><span>${esc(i.preco)}</span></div>
        <div class="meta">${esc(i.quartos||'')} qts · ${esc(i.banheiros||'')} ban · ${esc(i.area||'')} m²</div>
      </div>
      <div class="actions">
        <button class="sm" data-e="${i.id}">Editar</button>
        <button class="sm ${i.vendido?'reativar':'vendido'}" data-v="${i.id}">${i.vendido?'Reativar':'Marcar vendido'}</button>
        <button class="sm del" data-d="${i.id}">Excluir</button>
      </div>
    </div>
  `).join('') || '<p style="color:var(--muted)">Nenhum imóvel ainda.</p>';
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => editar(+b.dataset.e));
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
    if(confirm('Excluir este imóvel?')){ imoveis = imoveis.filter(i => i.id !== +b.dataset.d); salvar(); render(); }
  });
  document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
    const id = +b.dataset.v;
    imoveis = imoveis.map(i => i.id===id ? {...i, vendido: !i.vendido} : i);
    salvar(); render();
  });
}
function renderPrev(){
  $('prev').innerHTML = fotos.map((f,n)=>`<div><img src="${f}"><button type="button" data-r="${n}">×</button></div>`).join('');
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
$('fotos').onchange = async e => { for(const f of e.target.files) fotos.push(await reduzir(f)); e.target.value=''; renderPrev(); };
const campos = ['titulo','tipo','local','preco','quartos','banheiros','area','descricao','vendido'];
function limpar(){ $('form').reset(); $('vendido').checked=false; fotos=[]; editId=null; renderPrev(); $('ftitle').textContent='Novo imóvel'; $('cancel').style.display='none'; }
function editar(id){
  const i = imoveis.find(x=>x.id===id); editId=id;
  campos.forEach(c => { if(c==='vendido'){ $(c).checked = !!i[c]; } else { $(c).value = i[c] ?? ''; } });
  fotos=[...(i.fotos||[])]; renderPrev();
  $('ftitle').textContent='Editar imóvel'; $('cancel').style.display='block'; scrollTo({top:0,behavior:'smooth'});
}
$('cancel').onclick = limpar;
$('form').onsubmit = e => {
  e.preventDefault();
  const d = {}; 
  campos.forEach(c => { 
    if(c === 'vendido') d[c] = $('vendido').checked; 
    else d[c] = $(c).value; 
  }); 
  d.fotos = [...fotos];
  const antes = JSON.stringify(imoveis);
  if(editId) imoveis = imoveis.map(i => i.id===editId ? {...d,id:editId} : i);
  else imoveis.unshift({...d, id: Date.now()});
  if(!salvar()){ imoveis = JSON.parse(antes); return; }
  limpar(); render();
};
function baixar(nome, txt, tipo){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:tipo})); a.download=nome; a.click(); }
$('exp').onclick = () => baixar('data.js', 'window.IMOVEIS_PADRAO = ' + JSON.stringify(imoveis,null,2) + ';\n', 'text/javascript');
$('bkp').onclick = () => baixar('imoveis-backup.json', JSON.stringify(imoveis), 'application/json');
$('imp').onchange = e => { const r=new FileReader(); r.onload=()=>{ try{ imoveis=JSON.parse(r.result); salvar(); render(); alert('Backup restaurado!'); }catch{ alert('Arquivo inválido.'); } }; r.readAsText(e.target.files[0]); };
