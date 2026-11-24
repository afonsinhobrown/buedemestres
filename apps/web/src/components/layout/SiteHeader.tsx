import Link from 'next/link'

export function SiteHeader() {
  return (
    <div className="site-chrome">
      <header className="bdm-topbar">
        <Link href="/" className="bdm-brand" aria-label="Bué de Mestres — mapa">
          <span className="bdm-brand-mark">🛠</span>
          <span className="bdm-brand-name">
            Bué de Mestres
            <small>O serviço certo, perto de si.</small>
          </span>
        </Link>
        <div className="bdm-top-actions">
          <Link href="/" className="bdm-top-link">Mapa</Link>
          <Link href="/chamar" className="bdm-top-link bdm-top-link--optional">Chamar agora</Link>
          <Link href="/trabalhos" className="bdm-top-link">Trabalhos</Link>
          <Link href="/pedidos" className="bdm-top-link bdm-top-link--optional">Pedidos</Link>
          <Link href="/pro/trabalhos" className="bdm-top-link bdm-top-link--optional">Área do mestre</Link>
          <Link href="/ajuda" className="bdm-top-link">Ajuda</Link>
          <Link href="/entrar" className="bdm-top-link">Entrar</Link>
          <Link href="/registar" className="bdm-top-cta">Criar conta</Link>
        </div>
      </header>
      <nav className="bdm-mobile-nav" aria-label="Serviços">
        <Link href="/">Mapa</Link>
        <Link href="/chamar">Chamar agora</Link>
        <Link href="/trabalhos">Trabalhos</Link>
        <Link href="/pedidos">Pedidos</Link>
        <Link href="/pro/trabalhos">Área do mestre</Link>
        <Link href="/notificacoes">Notificações</Link>
        <Link href="/ajuda">Ajuda</Link>
        <Link href="/como-funciona">Como funciona</Link>
      </nav>
    </div>
  )
}
