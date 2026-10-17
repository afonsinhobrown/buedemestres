export default function DefinirSenhaPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border-t-4 border-[#8B0000]">
        <h1 className="text-2xl font-bold mb-2">Definir Nova Palavra-passe</h1>
        <p className="text-gray-600 mb-6 text-sm">
          Como medida de segurança, o primeiro acesso ou reset da conta requer que defina uma nova palavra-passe. Deve ter no mínimo 12 caracteres.
        </p>

        <form className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Nova Palavra-passe</label>
            <input type="password" required minLength={12} className="w-full p-3 border rounded-lg bg-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Confirmar Palavra-passe</label>
            <input type="password" required minLength={12} className="w-full p-3 border rounded-lg bg-gray-50" />
          </div>

          <button className="w-full bg-[#8B0000] text-white py-3 rounded-lg font-bold hover:bg-red-900 transition-colors mt-6">
            Actualizar e Continuar
          </button>
        </form>
      </div>
    </div>
  );
}
