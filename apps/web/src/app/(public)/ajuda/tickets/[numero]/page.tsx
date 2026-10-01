export default function TicketUserDetail({ params }: { params: { numero: string } }) {
  return (
    <div className="p-8 max-w-3xl mx-auto min-h-screen bg-white mt-12 rounded-2xl border shadow-sm flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">[{params.numero}] Problema com o pagamento</h1>
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Aguardar a sua resposta</span>
        </div>
        <a href="/ajuda" className="text-gray-400 hover:text-gray-600 font-bold text-sm">← Voltar</a>
      </div>

      <div className="flex-1 overflow-y-auto mb-6 bg-gray-50 rounded-xl p-6 space-y-6">
        {/* Mensagem do Utilizador */}
        <div className="flex flex-col items-end">
          <div className="bg-blue-600 text-white p-4 rounded-2xl rounded-tr-sm max-w-[80%] shadow-sm">
            Fiz o trabalho mas o cliente diz que o M-Pesa falhou e o dinheiro não caiu.
          </div>
          <span className="text-xs text-gray-400 mt-2">Você • Hoje, 14:00</span>
        </div>

        {/* Resposta do Staff */}
        <div className="flex flex-col items-start">
          <div className="bg-white border border-gray-200 text-gray-800 p-4 rounded-2xl rounded-tl-sm max-w-[80%] shadow-sm">
            Olá João! Verificámos o sistema e a transacção com a referência #JOB-5901 ficou retida no nosso gateway. Por favor, partilhe o comprovativo em PDF gerado pelo M-Pesa para forçarmos a confirmação.
          </div>
          <span className="text-xs text-gray-400 mt-2">Equipa de Suporte • Hoje, 14:35</span>
        </div>
      </div>

      <div className="border-t pt-4">
        <textarea 
          className="w-full p-4 border rounded-xl bg-gray-50 mb-4 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500" 
          placeholder="Escreva a sua resposta e arraste o comprovativo..."
        ></textarea>
        <div className="flex justify-between items-center">
          <button className="text-gray-500 font-semibold text-sm flex items-center hover:text-gray-900">
            📎 Anexar Ficheiro (Até 5MB)
          </button>
          <button className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700">
            Enviar Resposta
          </button>
        </div>
      </div>
    </div>
  );
}
