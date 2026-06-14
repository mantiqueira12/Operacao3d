/* RNG semeável (mulberry32) — extensão sobre o sim-core original, que usava
   Math.random() sem seed. Permite reprodutibilidade e validação determinística.
   Passando seed undefined, cai num seed derivado de Date.now() (estocástico). */

export class Rng {
  private state: number

  constructor(seed?: number) {
    this.state = (seed ?? (Date.now() >>> 0)) >>> 0
    if (this.state === 0) this.state = 0x9e3779b9
  }

  /** Uniforme em [0, 1). */
  random(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Exponencial negativa com taxa `rate` (média 1/rate). */
  exp(rate: number): number {
    return -Math.log(1 - this.random()) / rate
  }

  /** Uniforme em [a, b). */
  uniform(a: number, b: number): number {
    return a + (b - a) * this.random()
  }
}
