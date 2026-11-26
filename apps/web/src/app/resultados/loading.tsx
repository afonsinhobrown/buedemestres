import './discovery.css'

export default function ResultadosLoading() {
  return (
    <div className="dx-page" aria-busy="true" aria-label="A carregar resultados">
      <header className="dx-topbar">
        <div className="dx-brand">
          <span className="dx-brand-mark" aria-hidden="true">
            🛠️
          </span>
          <span className="dx-brand-name">
            Bué de Mestres
            <span>O serviço certo, na hora certa, perto de ti.</span>
          </span>
        </div>
      </header>

      <main className="dx-app">
        <aside className="dx-left dx-panel">
          <div className="dx-panel-head">Categorias</div>
          <div className="dx-cat-list">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="dx-skeleton dx-skeleton-line" />
            ))}
          </div>
        </aside>

        <section className="dx-center">
          <div className="dx-map-shell">
            <div className="dx-skeleton dx-skeleton-map" />
          </div>
          <section className="dx-results">
            <div className="dx-skeleton dx-skeleton-line" />
            <div className="dx-skeleton dx-skeleton-line is-short" />
            <div className="dx-skeleton-results">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="dx-skeleton dx-skeleton-card" />
              ))}
            </div>
          </section>
        </section>

        <aside className="dx-right">
          <div className="dx-skeleton" style={{ height: 185 }} />
          <div className="dx-skeleton" style={{ height: 82 }} />
          <div className="dx-skeleton" style={{ height: 100 }} />
        </aside>
      </main>
    </div>
  )
}
