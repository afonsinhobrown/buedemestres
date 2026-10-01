export default function CentroDeAjudaPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto min-h-screen bg-gray-50">
      <h1 className="text-4xl font-bold mb-4 text-gray-900">Centro de Ajuda</h1>
      <p className="text-gray-600 mb-8 text-lg">Como podemos ajudar-te hoje?</p>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <h2 className="text-xl font-bold mb-4">Os meus pedidos recentes</h2>
        <div className="flex flex-col gap-4">
          <div className="border rounded-xl p-4 flex justify-between items-center bg-gray-50 hover:bg-gray-100 cursor-pointer">
            <div>
              <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">TKT-1045</span>
              <h3 className="font-semibold mt-2">Problema com o pagamento do M-Pesa</h3>
              <p className="text-sm text-gray-500">Última actualização: Há 2 horas</p>
            </div>
            <div className="text-orange-500 font-bold bg-orange-100 px-3 py-1 rounded-full text-sm">
              Aguarda resposta
            </div>
          </div>
          <p className="text-center text-sm text-gray-500 mt-2">
            <a href="/ajuda/tickets" className="text-blue-600 hover:underline">Ver todos os pedidos de ajuda</a>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <a href="/ajuda/tickets/novo" className="bg-blue-600 text-white p-8 rounded-2xl flex flex-col items-center justify-center hover:bg-blue-700 transition">
          <span className="text-4xl mb-4">💬</span>
          <span className="font-bold text-xl">Abrir Pedido de Ajuda</span>
          <span className="text-blue-100 mt-2 text-center text-sm">Fale com a nossa equipa de suporte para resolver o seu problema.</span>
        </a>
        <a href="/faq" className="bg-white border p-8 rounded-2xl flex flex-col items-center justify-center hover:bg-gray-50 transition">
          <span className="text-4xl mb-4">📚</span>
          <span className="font-bold text-xl text-gray-900">Perguntas Frequentes</span>
          <span className="text-gray-500 mt-2 text-center text-sm">Explore os nossos tutoriais e respostas automáticas.</span>
        </a>
      </div>
    </div>
  );
}
