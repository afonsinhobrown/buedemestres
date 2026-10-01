import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'
import { jwtVerify } from 'jose'

// Rotas que exigem sessão
const PROTECTED_PREFIXES = ['/painel', '/pedidos', '/mensagens', '/favoritos', '/definicoes', '/pro', '/admin', '/superadmin']
// Rotas de auth: redirecionar para /painel se já autenticado
const AUTH_ROUTES = ['/entrar', '/registar', '/recuperar']

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get('bdm_session')?.value
  const session = await decrypt(token)

  const isAuthenticated = !!session?.userId
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r))

  // Redirecionar para /entrar se não autenticado
  if (isProtected && !isAuthenticated) {
    const url = req.nextUrl.clone()
    url.pathname = '/entrar'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Redirecionar para /painel se já autenticado e tenta aceder a página de auth
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/painel', req.nextUrl))
  }

  // Protecção por papel: /pro só para profissionais e admins
  if (
    pathname.startsWith('/pro') &&
    session?.role !== 'provider' &&
    session?.role !== 'admin' && 
    session?.role !== 'superadmin'
  ) {
    return NextResponse.redirect(new URL('/painel', req.nextUrl))
  }

  // SECÇÃO STAFF / ADMIN / SUPERADMIN
  if (pathname.startsWith('/admin') || pathname.startsWith('/superadmin')) {
    const role = session?.role as string
    const isStaff = ['support', 'moderator', 'finance', 'admin', 'superadmin'].includes(role)
    
    if (!isStaff) {
      return new NextResponse('Não tens permissão para aceder a esta área.', { status: 403 })
    }

    if (pathname.startsWith('/superadmin') && role !== 'superadmin' && role !== 'finance') {
      return new NextResponse('Acesso restrito ao superadmin.', { status: 403 })
    }

    const mfaVerified = session?.mfaVerified as boolean
    const mustChangePassword = session?.mustChangePassword as boolean

    if (mustChangePassword && !pathname.startsWith('/superadmin/definir-senha')) {
      return NextResponse.redirect(new URL('/superadmin/definir-senha', req.url))
    }

    if (!mustChangePassword && !mfaVerified && !pathname.startsWith('/superadmin/mfa')) {
      return NextResponse.redirect(new URL('/superadmin/mfa', req.url))
    }

    const response = NextResponse.next()
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('Cache-Control', 'no-store, max-age=0')
    response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;")
    
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)',
  ],
}
