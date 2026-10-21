function getImoveis(){
  try {
    const s = localStorage.getItem('oscar_imoveis');
    const v = s ? JSON.parse(s) : null;
    return Array.isArray(v) ? v : (window.IMOVEIS_PADRAO || []);
  } catch { return window.IMOVEIS_PADRAO || []; }
}
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let imoveis = getImoveis().filter(i => !i.vendido);
let filtro = 'Todos';
document.getElementById('ano').textContent = new Date().getFullYear();
document.getElementById('count').textContent = imoveis.length;

function renderFiltros(){
  const tipos = ['Todos', ...new Set(imoveis.map(i => i.tipo))];
  document.getElementById('filters').innerHTML = tipos.map(t =>
    `<button class="${t===filtro?'active':''}" data-t="${esc(t)}">${esc(t)}</button>`).join('');
  document.querySelectorAll('#filters button').forEach(b => b.onclick = () => { filtro = b.dataset.t; renderFiltros(); render(); });
}
function render(){
  const lista = imoveis.filter(i => filtro==='Todos' || i.tipo===filtro);
  document.getElementById('grid').innerHTML = lista.length ? lista.map(i => `
    <article class="card reveal" data-id="${i.id}">
      <div class="img" style="background-image:url('${esc(i.fotos?.[0]||'')}')"><span class="tag">${esc(i.tipo)}</span></div>
      <div class="body"><h3>${esc(i.titulo)}</h3><div class="loc">📍 ${esc(i.local)}</div>
        <div class="feats"><span>🛏 ${esc(i.quartos)} quartos</span><span>🛁 ${esc(i.banheiros)} banh.</span><span>📐 ${esc(i.area)} m²</span></div>
        <div class="price">${esc(i.preco)}</div></div>
    </article>`).join('') : '<p class="empty">Nenhum imóvel cadastrado no momento.</p>';
  document.querySelectorAll('.card').forEach(c => c.onclick = () => abrir(+c.dataset.id));
  observe();
}
function abrir(id){
  const i = imoveis.find(x => x.id===id); if(!i) return;
  const fotos = i.fotos?.length ? i.fotos : [''];
  document.getElementById('mbox').innerHTML = `
    <div class="gallery-main" id="gm" style="background-image:url('${esc(fotos[0])}')"></div>
    <div class="thumbs">${fotos.map((f,n)=>`<img src="${esc(f)}" class="${n?'':'on'}">`).join('')}</div>
    <div class="modal-body"><span class="tag" style="position:static">${esc(i.tipo)}</span>
      <h3>${esc(i.titulo)}</h3><div class="loc" style="color:var(--muted)">📍 ${esc(i.local)}</div>
      <div class="price">${esc(i.preco)}</div>
      <div class="feats" style="margin:14px 0"><span>🛏 ${esc(i.quartos)} quartos</span><span>🛁 ${esc(i.banheiros)} banheiros</span><span>📐 ${esc(i.area)} m²</span></div>
      <p>${esc(i.descricao).replace(/\n/g,'<br>')}</p>
      <a class="btn btn-gold" style="margin-top:20px" target="_blank" href="https://wa.me/5500000000000?text=${encodeURIComponent('Olá Oscar! Tenho interesse no imóvel: '+i.titulo)}">Tenho interesse</a></div>`;
  document.querySelectorAll('.thumbs img').forEach(t => t.onclick = () => {
    document.getElementById('gm').style.backgroundImage = `url('${t.src}')`;
    document.querySelectorAll('.thumbs img').forEach(x=>x.classList.remove('on')); t.classList.add('on');
  });
  document.getElementById('modal').classList.add('open');
}
const modal = document.getElementById('modal');
document.getElementById('close').onclick = () => modal.classList.remove('open');
modal.onclick = e => { if(e.target===modal) modal.classList.remove('open'); };
const nav = document.getElementById('nav');
const menu = document.getElementById('menu');
const menuBtn = document.getElementById('menuBtn');
function fecharMenu(){ menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded','false'); }
menuBtn.onclick = () => {
  const aberto = menu.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
  menuBtn.textContent = aberto ? '✕' : '☰';
};
menu.querySelectorAll('a').forEach(a => a.onclick = fecharMenu);
window.addEventListener('scroll', () => { nav.classList.toggle('scrolled', scrollY>40); if(scrollY>40) fecharMenu(); });
window.addEventListener('resize', () => { if(window.innerWidth>800) fecharMenu(); });
function observe(){
  const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), {threshold:.1});
  document.querySelectorAll('.reveal:not(.in)').forEach(el => io.observe(el));
}
window.addEventListener('storage', e => {
  if(e.key !== 'oscar_imoveis') return;
  imoveis = getImoveis().filter(i => !i.vendido);
  document.getElementById('count').textContent = imoveis.length;
  if(!imoveis.some(i => i.tipo === filtro)) filtro = 'Todos';
  renderFiltros(); render();
});
renderFiltros(); render();
