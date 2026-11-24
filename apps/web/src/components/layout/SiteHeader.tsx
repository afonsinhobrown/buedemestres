import Link from 'next/link'
import { logoutAction } from '@/app/actions/auth'
import { roleLabel, roleLinks } from '@/lib/role-nav'
import { getViewer } from '@/lib/viewer'

export async function SiteHeader() {
  const viewer = await getViewer()
  const links = viewer ? roleLinks(viewer.role) : []

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
          {viewer ? (
            <>
              {links.map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`bdm-top-link ${index > 2 ? 'bdm-top-link--optional' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="bdm-session">
                <span className="bdm-role-badge">{roleLabel(viewer.role)}</span>
                <strong>{viewer.name}</strong>
              </div>
              <form action={logoutAction}>
                <button type="submit" className="bdm-logout">Sair</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/como-funciona" className="bdm-top-link bdm-top-link--optional">Como funciona</Link>
              <Link href="/ajuda" className="bdm-top-link">Ajuda</Link>
              <Link href="/entrar" className="bdm-top-link">Entrar</Link>
              <Link href="/registar" className="bdm-top-cta">Criar conta</Link>
            </>
          )}
        </div>
      </header>
      <nav className="bdm-mobile-nav" aria-label="Serviços">
        <Link href="/">Mapa</Link>
        {viewer ? (
          <>
            <span className="bdm-mobile-session">
              <span className="bdm-role-badge">{roleLabel(viewer.role)}</span>
              {viewer.name}
            </span>
            {links.map((link) => (
              <Link key={link.href} href={link.href}>{link.label}</Link>
            ))}
            <form action={logoutAction}>
              <button type="submit">Sair</button>
            </form>
          </>
        ) : (
          <>
            <Link href="/chamar">Chamar agora</Link>
            <Link href="/como-funciona">Como funciona</Link>
            <Link href="/ajuda">Ajuda</Link>
            <Link href="/entrar">Entrar</Link>
          </>
        )}
      </nav>
    </div>
  )
}
