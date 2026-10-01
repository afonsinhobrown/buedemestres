export default function NovoTicketPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto min-h-screen bg-white mt-12 rounded-2xl border shadow-sm">
      <h1 className="text-3xl font-bold mb-2">Novo Pedido de Ajuda</h1>
      <p className="text-gray-500 mb-8">Por favor, descreva o problema com o máximo de detalhe possível para podermos ser rápidos.</p>

      <form className="space-y-6">
        <div>
          <label className="block text-sm font-semibold mb-2">Categoria</label>
          <select className="w-full p-4 border rounded-xl bg-gray-50" required>
            <option value="">Selecione uma opção...</option>
            <option value="pagamento">Problema de Pagamento / Carteira</option>
            <option value="disputa">Disputa de Serviço (Trabalho)</option>
            <option value="conta">Conta e Acesso</option>
            <option value="tecnico">Erro Técnico</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Assunto Principal</label>
          <input type="text" className="w-full p-4 border rounded-xl bg-gray-50" placeholder="Ex: Não recebi o pagamento do job..." required minLength={5} maxLength={120} />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Descrição Completa</label>
          <textarea className="w-full p-4 border rounded-xl bg-gray-50 h-40" placeholder="Explique tudo o que aconteceu..." required minLength={10}></textarea>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Anexos (Opcional)</label>
          <div className="border-2 border-dashed border-gray-300 p-8 text-center rounded-xl hover:bg-gray-50 cursor-pointer">
            <span className="text-gray-500">Clique para anexar imagens ou PDFs (Max: 5MB)</span>
          </div>
        </div>

        <button type="button" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-blue-700">
          Enviar Pedido
        </button>
      </form>
    </div>
  );
}
