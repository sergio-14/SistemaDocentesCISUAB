import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaList, FaChartBar } from 'react-icons/fa';

const CatalogosMenu = ({ onMenuClick }) => {
  const navigate = useNavigate();
  
  return (
    <div className="poa-catalogos-submenu flex flex-col gap-1 p-3 mx-2 mb-1 bg-blue-950/70 rounded-lg border border-blue-800/60 shadow-inner">
      <button
        onClick={() => { navigate('/poa/catalogos/items'); onMenuClick?.(); }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium hover:bg-blue-800/60 text-blue-200 hover:text-white text-left w-full"
      >
        <FaList className="text-blue-300" />
        Items
      </button>
      <button
        onClick={() => { navigate('/poa/catalogos/indicadores'); onMenuClick?.(); }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium hover:bg-blue-800/60 text-blue-200 hover:text-white text-left w-full"
      >
        <FaChartBar className="text-blue-300" />
        Indicadores
      </button>
    </div>
  );
};

export default CatalogosMenu;
