import type { Item } from '../domain'

/**
 * Geometria do arco de abertura de uma porta, em metros (plano x→direita, y→baixo).
 * Puro, sem DOM. O integrador desenha a partir destes pontos (ver DoorSwing.tsx).
 *
 * - `hinge`: dobradiça (eixo de rotação da folha).
 * - `closedEnd`: ponta livre da folha fechada (encostada na parede).
 * - `openEnd`: ponta livre da folha aberta (girada 90° para dentro do ambiente).
 * - `radius`: comprimento da folha (= maior dimensão da porta).
 * - `sweepFlag`: flag de varredura do arco SVG, escolhido para o arco ligar
 *   visualmente `closedEnd → openEnd` ao longo do quarto de volta de 90°.
 */
export interface DoorSwing {
  hinge: { x: number; y: number }
  closedEnd: { x: number; y: number }
  openEnd: { x: number; y: number }
  radius: number
  sweepFlag: 0 | 1
}

/**
 * Calcula a geometria do batente/arco da porta a partir do seu footprint.
 *
 * A folha gira sempre 90° para **dentro do ambiente** (sentido +y nas portas
 * horizontais, +x nas verticais). `flip` apenas move a dobradiça para a ponta
 * oposta, espelhando o arco de forma consistente.
 *
 * @param item peça da porta (canto superior esquerdo + dimensões no plano, em m)
 * @param flip inverte a ponta onde fica a dobradiça
 */
export function doorSwingGeometry(
  item: Pick<Item, 'x' | 'y' | 'width' | 'depth'>,
  flip = false,
): DoorSwing {
  const { x, y, width, depth } = item
  // comprimento da folha = maior dimensão do retângulo fino da porta.
  const radius = Math.max(width, depth)

  // Porta horizontal: eixo longo na horizontal, folha sobre a aresta superior.
  if (width >= depth) {
    // Dobradiça à esquerda (padrão) ou à direita (flip); ponta fechada na outra ponta.
    const hinge = flip ? { x: x + radius, y } : { x, y }
    const closedEnd = flip ? { x, y } : { x: x + radius, y }
    // Abre 90° para dentro (+y), refletida sobre a vertical que passa na dobradiça.
    const openEnd = { x: hinge.x, y: hinge.y + radius }
    // Fechada→aberta vista na tela (y para baixo): leste→sul = horário (1);
    // espelhado (oeste→sul) = anti-horário (0).
    const sweepFlag: 0 | 1 = flip ? 0 : 1
    return { hinge, closedEnd, openEnd, radius, sweepFlag }
  }

  // Porta vertical: eixo longo na vertical, folha sobre a aresta esquerda.
  // Dobradiça no topo (padrão) ou na base (flip); ponta fechada na outra ponta.
  const hinge = flip ? { x, y: y + radius } : { x, y }
  const closedEnd = flip ? { x, y } : { x, y: y + radius }
  // Abre 90° para dentro (+x), refletida sobre a horizontal que passa na dobradiça.
  const openEnd = { x: hinge.x + radius, y: hinge.y }
  // sul→leste = anti-horário (0); espelhado (norte→leste) = horário (1).
  const sweepFlag: 0 | 1 = flip ? 1 : 0
  return { hinge, closedEnd, openEnd, radius, sweepFlag }
}
