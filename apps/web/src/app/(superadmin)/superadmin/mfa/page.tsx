export default function MfaPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border-t-4 border-gray-900">
        <h1 className="text-2xl font-bold mb-2">Autenticação de Dois Factores</h1>
        <p className="text-gray-600 mb-6 text-sm">
          A sua conta possui permissões elevadas. Por favor, introduza o código de 6 dígitos gerado pela sua aplicação Authy ou Google Authenticator.
        </p>

        <form className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2 text-center text-gray-500">CÓDIGO TOTP</label>
            <input 
              type="text" 
              maxLength={6}
              placeholder="000000"
              className="w-full p-4 border rounded-lg bg-gray-50 text-center text-3xl font-mono tracking-[0.5em]" 
            />
          </div>

          <button className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold hover:bg-black transition-colors mt-6">
            Verificar Identidade
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-500 hover:underline cursor-pointer">
          Perdeu o dispositivo? Usar código de recuperação.
        </p>
      </div>
    </div>
  );
}
