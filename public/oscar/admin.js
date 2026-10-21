// Senha padrão: oscar2026  — para trocar, gere o SHA-256 da nova senha e cole abaixo.
const SENHA_HASH = 'd610dd4971f71ed75688f7014046f69b7f3bdcec898ca3eb7d4d821dff9b789f';
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function sha256(t){
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('');
}
function entrar(){ $('login').style.display='none'; $('app').style.display='block'; render(); }
if(sessionStorage.getItem('oscar_auth')==='1') entrar();
$('fLogin').onsubmit = async e => {
  e.preventDefault();
  if(await sha256($('senha').value) === SENHA_HASH){ sessionStorage.setItem('oscar_auth','1'); entrar(); }
  else { $('err').textContent = 'Senha incorreta.'; $('senha').value=''; }
};
$('sair').onclick = () => { sessionStorage.removeItem('oscar_auth'); location.reload(); };

let imoveis = JSON.parse(localStorage.getItem('oscar_imoveis') || 'null') || [...(window.IMOVEIS_PADRAO||[])];
let fotos = [], editId = null;
function salvar(){
  try { localStorage.setItem('oscar_imoveis', JSON.stringify(imoveis)); return true; }
  catch { alert('Espaço do navegador cheio. Use menos fotos ou remova imóveis antigos.'); return false; }
}
function render(){
  $('n').textContent = imoveis.length;
  $('list').innerHTML = imoveis.map(i => `<div class="item"><img src="${i.fotos?.[0]||''}"><div class="info"><b>${esc(i.titulo)}</b><br><small>${esc(i.tipo)} · ${esc(i.local)} · ${esc(i.preco)}</small></div>
    <button class="sm" data-e="${i.id}">Editar</button><button class="sm del" data-d="${i.id}">Excluir</button></div>`).join('') || '<p style="color:var(--muted)">Nenhum imóvel ainda.</p>';
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => editar(+b.dataset.e));
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
    if(confirm('Excluir este imóvel?')){ imoveis = imoveis.filter(i => i.id !== +b.dataset.d); salvar(); render(); }
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
const campos = ['titulo','tipo','local','preco','quartos','banheiros','area','descricao'];
function limpar(){ $('form').reset(); fotos=[]; editId=null; renderPrev(); $('ftitle').textContent='Novo imóvel'; $('cancel').style.display='none'; }
function editar(id){
  const i = imoveis.find(x=>x.id===id); editId=id;
  campos.forEach(c => $(c).value = i[c] ?? ''); fotos=[...(i.fotos||[])]; renderPrev();
  $('ftitle').textContent='Editar imóvel'; $('cancel').style.display='block'; scrollTo({top:0,behavior:'smooth'});
}
$('cancel').onclick = limpar;
$('form').onsubmit = e => {
  e.preventDefault();
  const d = {}; campos.forEach(c => d[c] = $(c).value); d.fotos = [...fotos];
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
