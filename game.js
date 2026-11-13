/* ==========================================================
   BOBO DE PAPEL - Deltarune Sim
   Seções: 1 Configuração | 2 Estado | 3 Ataques | 4 Textos
           5 Menus e fluxo | 6 Controles | 7 Atualização | 8 Desenho
   ========================================================== */


/* ---------- 1. CONFIGURAÇÃO ---------- */

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const menuEl = document.getElementById('btns');

const VIDA_MAX_JOGADOR = 80;
const VIDA_MAX_INIMIGO = 60;
const HUMOR_MAX = 4;            
const DANO_PROJETIL = 10;
const VELOCIDADE_CORACAO = 150; 


const CAIXA = { x: 170, y: 245, w: 300, h: 160 };
const CENTRO_X = CAIXA.x + CAIXA.w / 2;
const CENTRO_Y = CAIXA.y + CAIXA.h / 2;

// Sorteia um número entre min e max
const aleatorio = (min, max) => min + Math.random() * (max - min);


/* ---------- 2. ESTADO DO JOGO ---------- */

let vidaJogador, vidaInimigo, humor;
let qtdCha, qtdBolo;
let fase;               // 'menu' | 'text' | 'timing' | 'dodge' | 'end'
let mensagem = '';      // texto mostrado dentro da caixa
let opcoes = [];        // botões atuais: [['Nome', funcao], ...]
let indiceSelecionado = 0;
let final = 0;          // 0 = derrota | 1 = poupou | 2 = matou
let turno = 0;
let ordemAtaques = [];

let tremor = 0;         // tempo restante de "shake" do inimigo
let invencivel = 0;     // tempo restante de invencibilidade do jogador
let tempoBarra = 0;     // tempo da barra de ataque (FIGHT)

let ataqueAtual = null;
let tempoAtaque = 0;
let acumulador = 0;     // usado para disparar projéteis em intervalos
let projeteis = [];

const coracao = { x: CENTRO_X, y: CENTRO_Y };
const teclas = {};      // teclas atualmente pressionadas


/* ---------- 3. ATAQUES DO INIMIGO ---------- */

function criarProjetil(x, y, vx, vy, raio, quica = false) {
  projeteis.push({ x, y, vx, vy, raio, quica });
}

// Retorna true a cada "intervalo" segundos
function passouIntervalo(dt, intervalo) {
  acumulador += dt;
  if (acumulador >= intervalo) {
    acumulador -= intervalo;
    return true;
  }
  return false;
}

const ATAQUES = [
  // 1) Chuva: projéteis caem de cima
  {
    duracao: 7,
    atualizar(dt) {
      if (passouIntervalo(dt, 0.16)) {
        criarProjetil(aleatorio(CAIXA.x + 6, CAIXA.x + CAIXA.w - 6), CAIXA.y - 10, 0, aleatorio(130, 190), 6);
      }
    },
  },

  // 2) Barras: paredes vindas da direita com uma brecha
  {
    duracao: 8,
    atualizar(dt) {
      if (!passouIntervalo(dt, 1.0)) return;
      const brecha = aleatorio(CAIXA.y + 10, CAIXA.y + CAIXA.h - 55);
      for (let y = CAIXA.y; y < CAIXA.y + CAIXA.h; y += 14) {
        const dentroDaBrecha = y >= brecha && y <= brecha + 48;
        if (!dentroDaBrecha) criarProjetil(CAIXA.x + CAIXA.w + 10, y + 7, -150, 0, 8);
      }
    },
  },

  // 3) Leque: emissor em cima atira balançando de lado a lado
  {
    duracao: 8,
    atualizar(dt) {
      if (passouIntervalo(dt, 0.09)) {
        const angulo = Math.PI / 2 + Math.sin(tempoAtaque * 1.7) * 1.15;
        criarProjetil(CENTRO_X, CAIXA.y - 25, Math.cos(angulo) * 120, Math.sin(angulo) * 120, 5);
      }
    },
  },

  // 4) Bolas que quicam nas paredes da caixa
  {
    duracao: 8,
    iniciar() {
      for (let i = 0; i < 6; i++) {
        const angulo = aleatorio(0, Math.PI * 2);
        criarProjetil(
          aleatorio(CAIXA.x + 20, CAIXA.x + CAIXA.w - 20),
          aleatorio(CAIXA.y + 20, CAIXA.y + CAIXA.h - 20),
          Math.cos(angulo) * 125, Math.sin(angulo) * 125, 9, true
        );
      }
    },
    atualizar() {},
  },
];


/* ---------- 4. TEXTOS ---------- */

const FRASES_ELOGIAR = [
  '* Você elogia o chapéu. Bobo esconde o rosto, tímido.',
  '* Você elogia as dobras. Bobo faz uma reverência!',
  '* Você aplaude o show. Bobo mal contém o sorriso.',
  '* Você grita “BIS!”. Bobo está radiante!',
];

const FRASES_DANCAR = [
  '* Você dança. Bobo inclina a cabeça, curioso.',
  '* Você gira junto. Bobo ri baixinho.',
  '* Dueto! Bobo acompanha seus passos.',
  '* Final em dupla! Bobo está emocionado!',
];

const FRASES_AMBIENTE = [
  '* O ar cheira a papel e tinta.',
  '* Bobo ajeita o chapéu.',
  '* Confetes caem devagar.',
  '* Bobo espera sua jogada.',
];


/* ---------- 5. MENUS E FLUXO DO JOGO ---------- */

function reiniciarJogo() {
  vidaJogador = VIDA_MAX_JOGADOR;
  vidaInimigo = VIDA_MAX_INIMIGO;
  humor = 0;
  qtdCha = 2;
  qtdBolo = 1;
  turno = 0;
  final = 0;
  projeteis = [];
  ordemAtaques = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  mostrarMenuPrincipal('* Bobo de Papel surge dobrando-se em formas!');
}

function mudarFase(novaFase) {
  fase = novaFase;
  document.body.dataset.ph = novaFase; // o CSS usa isso para esconder/mostrar o D-pad
}

// Troca os botões do menu
function definirOpcoes(lista) {
  opcoes = lista;
  indiceSelecionado = 0;
  desenharBotoes();
}

function desenharBotoes() {
  menuEl.innerHTML = '';
  opcoes.forEach(([nome, acao], i) => {
    const botao = document.createElement('button');
    botao.className = 'b' + (i === indiceSelecionado ? ' sel' : '');
    botao.textContent = nome;
    botao.onclick = () => {
      indiceSelecionado = i;
      acao();
    };
    menuEl.appendChild(botao);
  });
}

function mostrarMenuPrincipal(texto) {
  mudarFase('menu');
  mensagem = texto || (humor >= HUMOR_MAX
    ? '* Bobo brilha em amarelo. Poupe-o em MERCY!'
    : '* O que você vai fazer?');
  definirOpcoes([
    ['FIGHT', iniciarAtaqueJogador],
    ['ACT', menuAct],
    ['ITEM', menuItem],
    ['MERCY', menuMercy],
  ]);
}

// Submenu com botão "Voltar" no final
function mostrarSubmenu(lista) {
  mudarFase('menu');
  lista.push(['Voltar', () => mostrarMenuPrincipal()]);
  definirOpcoes(lista);
}

// Mostra um texto e espera o jogador clicar em "Continuar"
function mostrarTexto(texto, aoContinuar) {
  mudarFase('text');
  mensagem = texto;
  definirOpcoes([['Continuar', aoContinuar]]);
}

/* FIGHT */
function iniciarAtaqueJogador() {
  mudarFase('timing');
  mensagem = '';
  tempoBarra = 0;
  definirOpcoes([['ATACAR!', acertarAtaque]]);
}

function posicaoDaBarra() {
  return (1 - Math.cos(tempoBarra * 3.2)) / 2; // vai de 0 a 1 e volta
}

function acertarAtaque() {
  const precisao = 1 - Math.abs(posicaoDaBarra() - 0.5) * 2; // 1 = no centro
  const dano = Math.round(5 + precisao * precisao * 22);

  vidaInimigo = Math.max(0, vidaInimigo - dano);
  tremor = 0.4;

  if (vidaInimigo <= 0) return terminarJogo(2);
  mostrarTexto(`* Você causa ${dano} de dano. Bobo amassa um pouquinho.`, iniciarTurnoInimigo);
}

/* ACT */
function menuAct() {
  mostrarSubmenu([
    ['Checar', () => mostrarTexto(
      '* BOBO DE PAPEL: ATQ 6, DEF 0.\n* Só quer uma plateia. Elogios e dança podem acalmá-lo.',
      iniciarTurnoInimigo)],
    ['Elogiar', () => aplicarAct(FRASES_ELOGIAR)],
    ['Dançar', () => aplicarAct(FRASES_DANCAR)],
  ]);
}

function aplicarAct(frases) {
  if (humor < HUMOR_MAX) humor++;
  let texto = frases[humor - 1];
  if (humor >= HUMOR_MAX) texto += '\n* Bobo está pronto para ser poupado!';
  mostrarTexto(texto, iniciarTurnoInimigo);
}

/* ITEM */
function menuItem() {
  const lista = [];
  if (qtdCha > 0) lista.push([`Chá quente x${qtdCha} (+25)`, () => usarItem('cha', 25, '* Você toma o chá quente.')]);
  if (qtdBolo > 0) lista.push([`Bolo x${qtdBolo} (+50)`, () => usarItem('bolo', 50, '* Você devora o bolo de papel de arroz.')]);

  if (lista.length === 0) return mostrarTexto('* Sua mochila está vazia.', mostrarMenuPrincipal);
  mostrarSubmenu(lista);
}

function usarItem(tipo, cura, texto) {
  if (tipo === 'cha') qtdCha--;
  else qtdBolo--;

  const vidaAntes = vidaJogador;
  vidaJogador = Math.min(VIDA_MAX_JOGADOR, vidaJogador + cura);
  mostrarTexto(`${texto}\n* Recuperou ${vidaJogador - vidaAntes} HP.`, iniciarTurnoInimigo);
}

/* MERCY */
function menuMercy() {
  mostrarSubmenu([
    ['Poupar', () => {
      if (humor >= HUMOR_MAX) terminarJogo(1);
      else mostrarTexto('* Bobo ainda não quer parar. Tente ACT.', iniciarTurnoInimigo);
    }],
    ['Fugir', () => mostrarTexto('* Você não pode abandonar o show!', iniciarTurnoInimigo)],
  ]);
}

/* TURNO DO INIMIGO (desvio) */
function iniciarTurnoInimigo() {
  ataqueAtual = ATAQUES[ordemAtaques[turno % ATAQUES.length]];
  turno++;

  projeteis = [];
  tempoAtaque = 0;
  acumulador = 0;
  invencivel = 0;
  coracao.x = CENTRO_X;
  coracao.y = CENTRO_Y;

  if (ataqueAtual.iniciar) ataqueAtual.iniciar();
  mudarFase('dodge');
  definirOpcoes([]);
}

function terminarTurnoInimigo() {
  projeteis = [];
  const frase = FRASES_AMBIENTE[Math.floor(Math.random() * FRASES_AMBIENTE.length)];
  mostrarMenuPrincipal(frase);
}

/* FIM DE JOGO: 0 = derrota, 1 = poupou, 2 = matou */
function terminarJogo(tipo) {
  mudarFase('end');
  final = tipo;
  projeteis = [];

  if (tipo === 1) mensagem = '* VOCÊ VENCEU!\n* Bobo agradece e vira um avião de papel.';
  else if (tipo === 2) mensagem = '* Bobo vira confete.\n* Ninguém aplaude.';
  else mensagem = '* Você caiu...\n* Mas a plateia ainda quer um bis.';

  definirOpcoes([['Jogar de novo', reiniciarJogo]]);
}


/* ---------- 6. CONTROLES ---------- */

// Navegação nos menus pelo teclado
function tratarTecla(tecla) {
  if (fase === 'dodge' || opcoes.length === 0) return;
  const total = opcoes.length;

  if (tecla === 'arrowright' || tecla === 'd') indiceSelecionado = (indiceSelecionado + 1) % total;
  else if (tecla === 'arrowleft' || tecla === 'a') indiceSelecionado = (indiceSelecionado + total - 1) % total;
  else if (tecla === 'arrowdown' || tecla === 's') indiceSelecionado = Math.min(indiceSelecionado + 2, total - 1);
  else if (tecla === 'arrowup' || tecla === 'w') indiceSelecionado = Math.max(indiceSelecionado - 2, 0);
  else if (tecla === 'z' || tecla === 'enter' || tecla === ' ') return opcoes[indiceSelecionado][1]();
  else if (tecla === 'x' || tecla === 'escape') {
    const voltar = opcoes.find(([nome]) => nome === 'Voltar');
    if (voltar) voltar[1]();
  }
  desenharBotoes();
}

addEventListener('keydown', (e) => {
  const tecla = e.key.toLowerCase();
  if (tecla.startsWith('arrow') || tecla === ' ' || tecla === 'enter') e.preventDefault();
  if (!teclas[tecla]) tratarTecla(tecla); // evita repetir quando a tecla fica segurada
  teclas[tecla] = true;
});

addEventListener('keyup', (e) => {
  teclas[e.key.toLowerCase()] = false;
});

// D-pad na tela (celular): cada botão simula uma seta do teclado
document.querySelectorAll('#pad button').forEach((botao) => {
  const tecla = botao.dataset.k;

  botao.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    teclas[tecla] = true;
  });

  ['pointerup', 'pointerleave', 'pointercancel'].forEach((evento) => {
    botao.addEventListener(evento, () => { teclas[tecla] = false; });
  });

  botao.addEventListener('contextmenu', (e) => e.preventDefault());
});


/* ---------- 7. ATUALIZAÇÃO (a cada frame) ---------- */

function moverCoracao(dt) {
  const esquerda = teclas.arrowleft || teclas.a;
  const direita = teclas.arrowright || teclas.d;
  const cima = teclas.arrowup || teclas.w;
  const baixo = teclas.arrowdown || teclas.s;

  let dx = (direita ? 1 : 0) - (esquerda ? 1 : 0);
  let dy = (baixo ? 1 : 0) - (cima ? 1 : 0);

  // Na diagonal, reduz a velocidade para não correr mais rápido
  if (dx && dy) {
    dx *= 0.7071;
    dy *= 0.7071;
  }

  const margem = 10;
  coracao.x = Math.max(CAIXA.x + margem, Math.min(CAIXA.x + CAIXA.w - margem, coracao.x + dx * VELOCIDADE_CORACAO * dt));
  coracao.y = Math.max(CAIXA.y + margem, Math.min(CAIXA.y + CAIXA.h - margem, coracao.y + dy * VELOCIDADE_CORACAO * dt));
}

function projetilSaiuDaTela(p) {
  return p.x < CAIXA.x - 50 || p.x > CAIXA.x + CAIXA.w + 50 ||
         p.y < CAIXA.y - 70 || p.y > CAIXA.y + CAIXA.h + 50;
}

function atualizar(dt) {
  if (tremor > 0) tremor -= dt;
  if (invencivel > 0) invencivel -= dt;
  if (fase === 'timing') tempoBarra += dt;
  if (fase !== 'dodge') return;

  tempoAtaque += dt;
  ataqueAtual.atualizar(dt);
  moverCoracao(dt);

  for (const p of projeteis) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Bolas que quicam: invertem a direção ao bater nas paredes
    if (p.quica) {
      if (p.x < CAIXA.x + p.raio || p.x > CAIXA.x + CAIXA.w - p.raio) p.vx *= -1;
      if (p.y < CAIXA.y + p.raio || p.y > CAIXA.y + CAIXA.h - p.raio) p.vy *= -1;
    }

    // Colisão com o coração
    const distancia = Math.hypot(p.x - coracao.x, p.y - coracao.y);
    if (invencivel <= 0 && distancia < p.raio + 4) {
      vidaJogador = Math.max(0, vidaJogador - DANO_PROJETIL);
      invencivel = 1.2;
      tremor = 0.25;
      if (vidaJogador <= 0) return terminarJogo(0);
    }
  }

  projeteis = projeteis.filter((p) => p.quica || !projetilSaiuDaTela(p));

  if (tempoAtaque >= ataqueAtual.duracao) terminarTurnoInimigo();
}


/* ---------- 8. DESENHO ---------- */

const FONTE = '"Pixelify Sans", monospace';

function desenharBarra(x, y, largura, altura, proporcao, corCheia, corFundo) {
  ctx.fillStyle = corFundo;
  ctx.fillRect(x, y, largura, altura);
  ctx.fillStyle = corCheia;
  ctx.fillRect(x, y, largura * proporcao, altura);
}

// Escreve texto quebrando linhas automaticamente (e respeitando \n)
function escreverTexto(texto, x, y, larguraMax, alturaLinha) {
  texto.split('\n').forEach((paragrafo) => {
    let linha = '';
    paragrafo.split(' ').forEach((palavra) => {
      const teste = linha ? linha + ' ' + palavra : palavra;
      if (ctx.measureText(teste).width > larguraMax && linha) {
        ctx.fillText(linha, x, y);
        y += alturaLinha;
        linha = palavra;
      } else {
        linha = teste;
      }
    });
    ctx.fillText(linha, x, y);
    y += alturaLinha;
  });
}

function desenharInimigo() {
  if (final === 2) return; // some quando é derrotado

  const pronto = humor >= HUMOR_MAX;
  const x = 320 + (tremor > 0 ? Math.sin(performance.now() / 18) * 8 : 0);
  const y = 120;

  // Brilho amarelo quando pode ser poupado
  if (pronto) {
    ctx.fillStyle = 'rgba(255,210,63,.18)';
    ctx.beginPath();
    ctx.arc(x, y, 92, 0, 7);
    ctx.fill();
  }

  // Corpo (triângulo) e cabeça (círculo)
  ctx.fillStyle = pronto ? '#fff3b0' : '#f4f1ff';
  ctx.beginPath();
  ctx.moveTo(x, y + 30);
  ctx.lineTo(x + 34, y + 90);
  ctx.lineTo(x - 34, y + 90);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 36, 0, 7);
  ctx.fill();

  // Chapéu de bobo da corte (duas pontas)
  ctx.fillStyle = '#ff2d55';
  ctx.beginPath();
  ctx.moveTo(x - 34, y - 14);
  ctx.lineTo(x - 52, y - 62);
  ctx.lineTo(x - 6, y - 30);
  ctx.fill();

  ctx.fillStyle = '#3ee6e0';
  ctx.beginPath();
  ctx.moveTo(x + 34, y - 14);
  ctx.lineTo(x + 52, y - 62);
  ctx.lineTo(x + 6, y - 30);
  ctx.fill();

  // Bolinhas nas pontas do chapéu
  ctx.fillStyle = '#ffd23f';
  [-52, 52].forEach((dx) => {
    ctx.beginPath();
    ctx.arc(x + dx, y - 62, 6, 0, 7);
    ctx.fill();
  });

  // Olhos
  ctx.fillStyle = '#0d0a1f';
  ctx.fillRect(x - 16, y - 8, 7, 10);
  ctx.fillRect(x + 9, y - 8, 7, 10);

  // Boca: triste no começo, sorrindo quando o humor sobe
  ctx.strokeStyle = '#0d0a1f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (humor >= 2) ctx.arc(x, y + 8, 13, 0.15, Math.PI - 0.15);
  else ctx.arc(x, y + 26, 12, Math.PI + 0.3, -0.3);
  ctx.stroke();
}

function desenharStatusInimigo() {
  ctx.font = `16px ${FONTE}`;
  ctx.fillStyle = '#f4f1ff';

  ctx.textAlign = 'left';
  ctx.fillText('HP do Bobo', 16, 28);
  desenharBarra(16, 36, 150, 12, vidaInimigo / VIDA_MAX_INIMIGO, '#ff2d55', '#4a1a2e');

  ctx.textAlign = 'right';
  ctx.fillText('Humor', 624, 28);
  const corHumor = humor >= HUMOR_MAX ? '#ffd23f' : '#3ee6e0';
  desenharBarra(474, 36, 150, 12, humor / HUMOR_MAX, corHumor, '#1d2b3a');
}

function desenharBarraDeAtaque() {
  const inicio = CAIXA.x + 16;
  const largura = CAIXA.w - 32;
  const marcador = inicio + posicaoDaBarra() * largura;

  ctx.fillStyle = '#fff';
  ctx.fillText('Aperte ATACAR no centro!', CAIXA.x + 16, CAIXA.y + 34);

  ctx.fillStyle = '#222';
  ctx.fillRect(inicio, CENTRO_Y - 4, largura, 28);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(CENTRO_X - 10, CENTRO_Y - 4, 20, 28); // zona do acerto perfeito
  ctx.fillStyle = '#fff';
  ctx.fillRect(marcador - 3, CENTRO_Y - 12, 6, 44);
}

function desenharProjeteisECoracao() {
  projeteis.forEach((p) => {
    ctx.fillStyle = '#3ee6e0';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.raio, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.raio - 3, 0, 7);
    ctx.fill();
  });

  // Pisca enquanto está invencível
  const visivel = invencivel <= 0 || Math.floor(invencivel * 12) % 2 === 1;
  if (visivel) {
    ctx.fillStyle = '#ff2d55';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♥', coracao.x, coracao.y + 8);
  }
}

function desenharCaixa() {
  ctx.fillStyle = '#000';
  ctx.fillRect(CAIXA.x, CAIXA.y, CAIXA.w, CAIXA.h);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.strokeRect(CAIXA.x, CAIXA.y, CAIXA.w, CAIXA.h);

  ctx.font = `19px ${FONTE}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';

  if (fase === 'menu' || fase === 'text' || fase === 'end') {
    escreverTexto(mensagem, CAIXA.x + 16, CAIXA.y + 30, CAIXA.w - 32, 24);
  } else if (fase === 'timing') {
    desenharBarraDeAtaque();
  } else if (fase === 'dodge') {
    desenharProjeteisECoracao();
  }
}

function desenharVidaJogador() {
  ctx.textAlign = 'left';
  ctx.font = `20px ${FONTE}`;
  ctx.fillStyle = '#f4f1ff';
  ctx.fillText('HP', 180, 448);
  desenharBarra(215, 432, 160, 18, vidaJogador / VIDA_MAX_JOGADOR, '#ffd23f', '#7a1a2e');
  ctx.fillText(`${vidaJogador} / ${VIDA_MAX_JOGADOR}`, 388, 448);
}

function desenhar() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0d0a1f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  desenharInimigo();
  desenharStatusInimigo();
  desenharCaixa();
  desenharVidaJogador();
}


/* ---------- LOOP PRINCIPAL ---------- */

let ultimoFrame = performance.now();

function loop(agora) {
  const dt = Math.min(0.05, (agora - ultimoFrame) / 1000); // segundos desde o último frame
  ultimoFrame = agora;

  atualizar(dt);
  desenhar();
  requestAnimationFrame(loop);
}

reiniciarJogo();
requestAnimationFrame(loop);