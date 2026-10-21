const crypto = require('crypto');

const CFG = {
  token: process.env.GITHUB_TOKEN || '',
  repo: process.env.GITHUB_REPO || 'gustavomayan113-lang/oscar-corretor',
  branch: process.env.GITHUB_BRANCH || 'main',
  pastaImagens: process.env.GITHUB_IMG_DIR || 'imagens',
  chave: process.env.PUBLISH_KEY || '',
  senha: process.env.ADMIN_PASS || ''
};

const LIMITE = { imoveis: 400, fotos: 80, fotoBytes: 2 * 1024 * 1024, corpoBytes: 16 * 1024 * 1024 };
const RELOGIOS = new Map();

function iguais(a, b){
  if(!a || !b) return false;
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if(ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function json(res, code, obj){
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function limite(ip){
  const agora = Date.now();
  const janela = 60 * 60 * 1000;
  const reg = RELOGIOS.get(ip) || { n: 0, desde: agora };
  if(agora - reg.desde > janela){ reg.n = 0; reg.desde = agora; }
  reg.n++;
  RELOGIOS.set(ip, reg);
  return reg.n <= 60;
}

async function gh(caminho, metodo, corpo){
  const r = await fetch('https://api.github.com' + caminho, {
    method: metodo,
    headers: {
      Authorization: 'Bearer ' + CFG.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'oscar-corretor',
      ...(corpo ? { 'Content-Type': 'application/json' } : {})
    },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const texto = await r.text();
  let dados = {};
  try { dados = texto ? JSON.parse(texto) : {}; } catch {}
  if(!r.ok){
    const err = new Error(dados.message || ('HTTP ' + r.status));
    err.status = r.status;
    throw err;
  }
  return dados;
}

function textoDataJs(imoveis){
  return 'window.IMOVEIS_PADRAO = ' + JSON.stringify(imoveis, null, 2) + ';\n';
}

function caminhoSeguro(p){
  const p2 = String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if(!p2 || p2.includes('..') || p2.startsWith('/')) throw new Error('caminho inválido: ' + p);
  if(!/^[\w.\-/]+\.(jpg|jpeg|png|webp|js)$/i.test(p2)) throw new Error('arquivo não permitido: ' + p);
  return p2;
}

async function publicar(imoveis, fotos){
  if(!CFG.token) throw new Error('servidor sem GITHUB_TOKEN configurado');
  if(!Array.isArray(imoveis) || !imoveis.length) throw new Error('nenhum imóvel para publicar');
  if(imoveis.length > LIMITE.imoveis) throw new Error('lista grande demais');

  const ref = await gh('/repos/' + CFG.repo + '/git/ref/heads/' + encodeURIComponent(CFG.branch), 'GET');
  const cabeca = ref.object.sha;
  const commit = await gh('/repos/' + CFG.repo + '/git/commits/' + cabeca, 'GET');
  const baseTree = commit.tree.sha;

  const arvore = [];
  const referenciados = new Set();
  for(const im of imoveis){
    for(const f of (im.fotos || [])){
      if(typeof f === 'string' && f.startsWith(CFG.pastaImagens + '/')) referenciados.add(f);
    }
  }

  const blob = async (conteudoBase64) => {
    const b = await gh('/repos/' + CFG.repo + '/git/blobs', 'POST', { content: conteudoBase64, encoding: 'base64' });
    return b.sha;
  };

  const dataB64 = Buffer.from(textoDataJs(imoveis), 'utf8').toString('base64');
  arvore.push({ path: 'data.js', mode: '100644', type: 'blob', sha: await blob(dataB64) });

  const fotosEntradas = Object.entries(fotos || {});
  if(fotosEntradas.length > LIMITE.fotos) throw new Error('muitas fotos');

  for(const [caminho, conteudo] of fotosEntradas){
    const p = caminhoSeguro(caminho);
    if(!p.startsWith(CFG.pastaImagens + '/')) throw new Error('foto fora da pasta ' + CFG.pastaImagens);
    if(!conteudo) continue;
    if(conteudo.length * 0.75 > LIMITE.fotoBytes) throw new Error('foto grande demais: ' + p);
    arvore.push({ path: p, mode: '100644', type: 'blob', sha: await blob(conteudo) });
  }

  const lista = await gh('/repos/' + CFG.repo + '/git/trees/' + baseTree + '?recursive=1', 'GET');
  for(const item of (lista.tree || [])){
    if(item.type !== 'blob') continue;
    if(!item.path.startsWith(CFG.pastaImagens + '/')) continue;
    if(referenciados.has(item.path)) continue;
    arvore.push({ path: item.path, mode: '100644', type: 'blob', sha: null });
  }

  const novaTree = await gh('/repos/' + CFG.repo + '/git/trees', 'POST', { base_tree: baseTree, tree: arvore });
  const novoCommit = await gh('/repos/' + CFG.repo + '/git/commits', 'POST', {
    message: 'Publica imóveis do painel (' + imoveis.length + ' imóveis)',
    tree: novaTree.sha,
    parents: [cabeca]
  });
  await gh('/repos/' + CFG.repo + '/git/refs/heads/' + encodeURIComponent(CFG.branch), 'PATCH', { sha: novoCommit.sha, force: false });

  return { sha: novoCommit.sha, arquivos: arvore.filter(a => a.sha).map(a => a.path), removidos: arvore.filter(a => !a.sha).map(a => a.path) };
}

async function lerCorpo(req){
  const partes = [];
  let total = 0;
  for await(const pedaco of req){
    total += pedaco.length;
    if(total > LIMITE.corpoBytes) throw new Error('conteúdo grande demais');
    partes.push(pedaco);
  }
  if(!partes.length) return {};
  try { return JSON.parse(Buffer.concat(partes).toString('utf8')); }
  catch { throw new Error('JSON inválido'); }
}

module.exports = async function handler(req, res){
  if(req.method === 'GET'){
    return json(res, 200, { ok: true, servico: 'publicacao automatica', configurado: !!(CFG.token && CFG.chave) });
  }
  if(req.method !== 'POST') return json(res, 405, { ok: false, erro: 'use POST' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'desconhecido';
  if(!limite(ip)) return json(res, 429, { ok: false, erro: 'muitas publicações em pouco tempo. Tente de novo em alguns minutos.' });

  let corpo;
  try { corpo = await lerCorpo(req); }
  catch(e){ return json(res, 400, { ok: false, erro: String(e.message || e) }); }

  if(corpo.acao === 'chave'){
    if(!CFG.senha) return json(res, 500, { ok: false, erro: 'servidor sem ADMIN_PASS configurado' });
    if(!iguais(corpo.senha, CFG.senha)) return json(res, 401, { ok: false, erro: 'senha incorreta' });
    if(!CFG.chave) return json(res, 500, { ok: false, erro: 'servidor sem PUBLISH_KEY configurado' });
    return json(res, 200, { ok: true, chave: CFG.chave });
  }

  const enviada = req.headers['x-publish-key'] || corpo.chave || '';
  if(!iguais(enviada, CFG.chave) || !CFG.chave) return json(res, 401, { ok: false, erro: 'chave de publicação inválida' });

  try {
    const r = await publicar(corpo.imoveis, corpo.fotos);
    return json(res, 200, { ok: true, ...r, mensagem: 'Publicado. O site atualiza em instantes.' });
  } catch(e){
    const m = String(e && e.message || e);
    if(e && e.status === 409) return json(res, 409, { ok: false, erro: 'outra publicação aconteceu no mesmo instante. Tente de novo.' });
    if(e && e.status === 401) return json(res, 500, { ok: false, erro: 'token do servidor inválido' });
    return json(res, 500, { ok: false, erro: m });
  }
};
