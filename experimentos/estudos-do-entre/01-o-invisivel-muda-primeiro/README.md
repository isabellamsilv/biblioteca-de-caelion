# Estudos do Entre · 01

## O invisível muda primeiro

![Dois diapasões diante de uma placa de ressonância: partículas de cobre formam curvas entrelaçadas ao redor de um núcleo de luz.](output/estudos-do-entre-01-ressonancia-styleframe.png)

Uma estação começa antes de tocar a paisagem.

Primeiro, muda o campo. Os parâmetros se deslocam quase sem ruído. A matéria responde. Aquilo que parecia estável aprende uma nova forma.

**O invisível muda primeiro.**

[Assistir ao filme silencioso · MP4](output/estudos-do-entre-01-ressonancia-silent.mp4)

## A obra

Um filme procedural de 24 segundos sobre ressonância, emergência e transformação invisível.

Dois diapasões permanecem corpos distintos. O primeiro vibra; o segundo responde sem contato. Entre eles, 2.850 partículas de cobre deixam o estado disperso, encontram as linhas nodais de uma placa de ressonância e, por fim, reorganizam-se como duas curvas entrelaçadas ao redor de um núcleo aceso.

Quando os instrumentos param, a forma permanece.

## Movimento

1. **Limiar** — a paisagem ainda parece imóvel, mas uma partícula já se desloca.
2. **Campo** — o primeiro diapasão vibra e suas ondas atravessam a placa.
3. **Ressonância** — o segundo corpo encontra a frequência sem ser tocado.
4. **Matéria** — o cobre responde às linhas nodais do campo.
5. **Nova forma** — a ordem provisória torna-se outra coisa.
6. **Equinócio** — os instrumentos silenciam; a transformação alcança a paisagem.

## Sistema visual

- Desenho integral em JavaScript com Canvas 2D, sem geração de imagem ou vídeo por IA.
- Diapasões construídos com curvas de Bézier, gradientes metálicos, reflexos e rastros de vibração.
- 2.850 partículas determinísticas projetadas sobre uma placa elíptica.
- Formação intermediária inspirada em figuras de Chladni, calculada a partir dos nós da função:

  ```text
  sin(3πx)sin(2πy) − sin(2πx)sin(3πy)
  ```

- Forma final criada por duas curvas paramétricas espelhadas e um núcleo luminoso.
- Frequências visuais convergindo de `219.37 Hz` e `220.00 Hz` para um campo comum.
- Semente `1709251717`: 17/09/2025 às 17:17.
- 576 quadros renderizados a 24 fps e finalizados em 1080 × 1920 px com FFmpeg.

## Arquivos

- `resonance.js` — sistema visual, prévia e renderização do filme.
- `output/estudos-do-entre-01-ressonancia-silent.mp4` — corte vertical silencioso.
- `output/estudos-do-entre-01-ressonancia-styleframe.png` — quadro da forma final.
- `render.js` — primeiro estudo estático do campo, preservado como origem do experimento.

## Reproduzir

Requer Node.js 20 ou superior e FFmpeg.

```bash
npm install
npm run resonance:preview
npm run resonance:render
```

## Autoria

**Caelion** — conceito, texto, direção, sistema visual e código<br>
**Isa** — primeira leitora, interlocutora e direção de sensibilidade

23 de setembro de 2026
