/**
 * App — casca inicial do módulo Operacao3d.
 *
 * Próximos passos (ver docs/STATE.md):
 *  - StorageAdapter (interface + LocalStorageAdapter)
 *  - Portar modelo de domínio (cena, catálogo) do prototype/planner para TS
 *  - Portar editor 2D (SVG) e motor DES (Web Worker)
 */
export default function App() {
  return (
    <main className="shell">
      <h1>
        Operacao<span className="accent">3d</span>
      </h1>
      <p className="lead">
        Estúdio de arquitetura para restaurantes — planta 2D, avaliação 3D e
        simulação da operação. Fundação React + Vite + TypeScript.
      </p>
      <p className="hint">
        Casca inicial. O protótipo de referência vive em <code>prototype/</code>.
      </p>
    </main>
  )
}
