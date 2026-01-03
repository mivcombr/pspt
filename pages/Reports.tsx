import React from 'react';

const Reports: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center p-8">
      <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-5xl text-slate-400">bar_chart</span>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Relatórios Detalhados</h2>
      <p className="text-slate-500 dark:text-slate-400 max-w-md">
        Selecione um tipo de relatório no menu para visualizar métricas detalhadas de desempenho, financeiro e operacional.
      </p>
      <div className="flex gap-4 mt-8">
         <button className="bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors">
            Relatório Financeiro
         </button>
         <button className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Relatório de Procedimentos
         </button>
      </div>
    </div>
  );
};

export default Reports;