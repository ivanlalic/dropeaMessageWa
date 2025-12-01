import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Zap, ExternalLink, AlertCircle, MapPin, AlertTriangle, PackageCheck, CheckCircle, Clock, PhoneOutgoing } from 'lucide-react';

// CONFIGURACIÓN DE NOMBRES
const STORE_NAME = 'IBericaStore';
const PRODUCT_NAME_MAP = {
  'Evilgoods_15913': 'Crema EvilGoods'
  // Si tienes más productos con nombres largos, agrega sus SKUs aquí
};

// DICCIONARIO DE INCIDENCIAS
const INCIDENCE_MAP = {
  'AS': 'Destinatario Ausente',
  'NAM': 'No Acepta Mercancía (Rechazado)',
  'RD': 'Pendiente de recoger en Tipsa',
  'FD': 'Dirección Incorrecta o Faltan Datos',
  'EAD': 'Entrega Aplazada por Destinatario',
  'DI': 'Dirección Incompleta',
  'DO': 'Dirección Desconocida',
  'EPA': 'En Reparto',
  'FE': 'Festivo Local o Fuerza Mayor'
};

// Función auxiliar para obtener el nombre "bonito" del producto
const getNombreProducto = (item) => {
  const sku = item.product?.sku || '';
  const original = item.product?.name || 'Producto';
  // Si el SKU está en el mapa, usa el nombre corto; si no, usa el original
  return PRODUCT_NAME_MAP[sku] ? PRODUCT_NAME_MAP[sku] : original;
};

const formatearFecha = (dateString) => {
  if (!dateString) return '';
  const parts = dateString.split(' ')[0].split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateString;
};

const formatearPrecio = (amount) => {
  return amount ? amount.toFixed(2).replace('.', ',') : '0,00';
};

// --- GENERADOR MENSAJE: PEDIDO NUEVO ---
const generarMensajePedido = (order) => {
  const nombre = order.customer?.full_name || 'Cliente';
  const productos = order.items.map(item => `${item.quantity} x ${getNombreProducto(item)}`).join('\n');
  const total = formatearPrecio(order.total_amount);
  const customer = order.customer;
  const tieneDir = !!(customer && customer.address);
  
  // SIN EMOJIS, SOLO TEXTO
  let msg = `*GRACIAS POR TU COMPRA EN ${STORE_NAME.toUpperCase()}*\n\n`;
  msg += `¡Hola, ${nombre}!\n\n`;
  msg += `Te confirmamos que hemos recibido tu pedido que incluye lo siguiente:\n${productos}\n\n`;
  msg += `Total: ${total} €\n\n`; 
  
  if (tieneDir) {
    msg += `Lo enviaremos a:\n`;
    msg += `Dirección: ${customer.address}\n`;
    msg += `Ciudad: ${customer.city || ''}\n`;
    msg += `Provincia: ${customer.state || ''}\n`;
    msg += `Código Postal: ${customer.zip || ''}\n\n`;
  }

  msg += "Si falta algo o hay algún error, por favor envíanos la corrección.\n\n";
  msg += "Tu pedido será entregado entre las 8 y 19 horas en la dirección indicada en las próximas 24/48 horas laborales. Por favor recuerde tener el importe exacto.\n\n";
  msg += STORE_NAME;
  
  return { msg, telefono: customer?.phone?.replace('+', ''), tieneDir };
};

// --- GENERADOR MENSAJE: INCIDENCIA ---
const generarMensajeIncidencia = (order) => {
  const nombre = order.customer?.full_name || 'Cliente';
  
  // CORRECCIÓN: Ahora usamos getNombreProducto aquí también
  const productos = order.items.map(item => `${getNombreProducto(item)}`).join(' | ');
  
  const total = formatearPrecio(order.total_amount);
  
  let motivoReal = "Incidencia en entrega";
  let codigo = "UNK";

  if (order.issues) {
    codigo = order.issues.incidence_code;
    motivoReal = INCIDENCE_MAP[codigo] || `Incidencia (${codigo})`;
  }

  // MENSAJE LIMPIO SIN EMOJIS
  let msg = `*¡Hola, ${nombre}!*\n\n`;
  msg += `Soy Inés, le escribimos desde la tienda *${STORE_NAME.toUpperCase()}*\n\n`;
  msg += `Nos comunicamos porque han intentado entregar su pedido sin éxito.\n\n`;
  
  msg += `Motivo: ${motivoReal}\n\n`;
  
  msg += `¿Ha tenido algún inconveniente para recibirlo?\n\n`;
  
  if (codigo === 'RD') {
      msg += `Su pedido está pendiente de recoger en la oficina de Tipsa.\n\n`;
  } else {
      msg += `Podemos gestionar una nueva entrega en un plazo de 48 horas (fines de semana y festivos no incluidos).\n\n`;
      msg += `¿Podéis decir qué día puede recibir vuestra entrega?\n\n`;
  }
  
  msg += `Tu pedido: ${productos}\n\n`;
  msg += `Total: ${total} €`;

  return { msg, telefono: order.customer?.phone?.replace('+', ''), motivo: motivoReal };
};

function App() {
  const [activeTab, setActiveTab] = useState('pending'); 
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cargarPedidos = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOrders([]); 
    
    const endpoint = activeTab === 'pending' ? '/api/get-orders' : '/api/get-incidences';

    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Error al conectar con el servidor');
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      if (Array.isArray(data)) {
        let finalData = data;

        if (activeTab === 'incidence') {
            // Filtro estricto: PENDING y CLIENT_MANAGED
            finalData = finalData.filter(order => {
                const status = order.issues?.status;
                return status === 'PENDING' || status === 'CLIENT_MANAGED';
            });

            finalData.sort((a, b) => {
                const dateA = a.updated_at ? new Date(a.updated_at.split(" ")[0].split("-").reverse().join("-") + "T" + a.updated_at.split(" ")[1]) : new Date(0);
                const dateB = b.updated_at ? new Date(b.updated_at.split(" ")[0].split("-").reverse().join("-") + "T" + b.updated_at.split(" ")[1]) : new Date(0);
                return dateB - dateA;
            });
        }
        setOrders(finalData);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

  const enviarWhatsApp = (order) => {
    const { msg, telefono } = activeTab === 'pending' 
      ? generarMensajePedido(order) 
      : generarMensajeIncidencia(order);

    if (!telefono) return alert("Sin teléfono");
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-gray-800">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 border-b-4 border-yellow-400">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
                <Zap className="text-yellow-500 fill-current" />
                Gestor de Pedidos {STORE_NAME}
              </h1>
            </div>
            <button 
              onClick={cargarPedidos} 
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Actualizando...' : 'Refrescar'}
            </button>
          </div>

          <div className="flex space-x-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === 'pending' 
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <PackageCheck className="w-4 h-4" />
              Pedidos Pendientes
            </button>
            <button
              onClick={() => setActiveTab('incidence')}
              className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === 'incidence' 
                  ? 'bg-red-50 text-red-700 border-b-2 border-red-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Incidencias
            </button>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow-sm">
            <p className="font-bold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* TABLA */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Fecha / ID</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-48">Cliente</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-64">
                    {activeTab === 'pending' ? 'Dirección' : 'Estado / Motivo'}
                  </th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Productos</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-32">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.length === 0 && !loading && !error && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500">
                      {activeTab === 'pending' ? 'No hay pedidos pendientes.' : 'No hay incidencias que requieran acción.'}
                    </td>
                  </tr>
                )}
                
                {orders.map((order) => {
                   const isIncidence = activeTab === 'incidence';
                   
                   // Lógica Pedido Pending
                   const { tieneDir } = generarMensajePedido(order); 
                   const direccionBusqueda = `${order.customer?.address} ${order.customer?.city} ${order.customer?.zip}`;
                   const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionBusqueda)}`;
                   
                   // Lógica Incidencia
                   let motivoDisplay = null;
                   let esGestionCliente = false;

                   if (isIncidence && order.issues) {
                      const issue = order.issues;
                      // Aquí se llama a la función corregida de incidencias
                      const { motivo } = generarMensajeIncidencia(order);
                      motivoDisplay = motivo;
                      esGestionCliente = issue.status === 'CLIENT_MANAGED';
                   }

                   return (
                    <tr key={order.id} className={`hover:bg-blue-50 transition-colors ${!isIncidence && !tieneDir ? 'bg-red-50' : ''}`}>
                      
                      {/* 1. FECHA / ID */}
                      <td className="p-4 align-top">
                        <span className="block text-xs font-semibold text-gray-400 mb-1">{formatearFecha(order.created_at)}</span>
                        <div className="flex items-center gap-1" title={`ID Largo: ${order.external_order_id}`}>
                           <span className="text-gray-400 font-light">#</span>
                           <span className="font-bold text-gray-800 text-lg">{order.id}</span>
                        </div>
                      </td>

                      {/* 2. CLIENTE */}
                      <td className="p-4 align-top">
                        <div className="font-bold text-gray-900 text-base">{order.customer?.full_name}</div>
                        <div className="text-sm text-blue-600 font-mono mb-2">{order.customer?.phone}</div>
                      </td>

                      {/* 3. COLUMNA CENTRAL (DIRECCIÓN o ESTADO INCIDENCIA) */}
                      <td className="p-4 align-top">
                        {!isIncidence ? (
                          // MODO PENDIENTE
                           tieneDir ? (
                             <div className="flex items-start gap-2">
                               <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="block group flex-1">
                                 <div className="bg-gray-50 border border-gray-200 rounded p-2 text-xs text-gray-600 shadow-sm group-hover:bg-blue-100 transition-all cursor-pointer h-full">
                                    <div className="flex items-start gap-1">
                                      <MapPin className="w-3 h-3 mt-0.5 text-gray-400 flex-shrink-0 group-hover:text-blue-600" />
                                      <div>
                                        <p className="font-semibold text-gray-800 group-hover:text-blue-800">{order.customer.address}</p>
                                        <p>{order.customer.city} ({order.customer.zip})</p>
                                      </div>
                                    </div>
                                 </div>
                               </a>
                               <a href="https://distritopostal.es/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center p-2 bg-white border border-gray-200 rounded hover:bg-gray-50 shadow-sm h-10 w-10 flex-shrink-0" title="Verificar Distrito Postal">
                                 <img src="https://www.google.com/s2/favicons?domain=distritopostal.es&sz=32" alt="DP" className="w-5 h-5 opacity-70 hover:opacity-100" />
                               </a>
                             </div>
                           ) : (
                             <div className="inline-flex items-center gap-1 px-3 py-1 rounded bg-red-100 text-red-700 border border-red-200 text-xs font-bold shadow-sm">
                               <AlertCircle className="w-4 h-4"/> FALTA DIRECCIÓN
                             </div>
                           )
                        ) : (
                          // MODO INCIDENCIA
                          <div className="space-y-2">
                            {esGestionCliente ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
                                    <PhoneOutgoing className="w-3 h-3" /> GESTIONANDO
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                                    <AlertTriangle className="w-3 h-3" /> REQUIERE ACCIÓN
                                </span>
                            )}
                            
                            <div className={`border p-2 rounded-lg text-sm font-semibold shadow-sm flex items-start gap-2 ${esGestionCliente ? 'bg-yellow-50 border-yellow-200 text-yellow-900' : 'bg-orange-50 border-orange-200 text-orange-900'}`}>
                                <span>{motivoDisplay}</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 4. PRODUCTOS */}
                      <td className="p-4 align-top text-sm text-gray-600">
                        <ul className="space-y-1">
                          {order.items.map((item, i) => (
                            <li key={i} className="flex gap-2">
                               <span className="font-bold text-gray-800 bg-gray-100 px-1.5 rounded text-xs h-fit pt-0.5">{item.quantity}x</span>
                               <span>{getNombreProducto(item)}</span>
                            </li>
                          ))}
                        </ul>
                      </td>

                      {/* 5. TOTAL */}
                      <td className="p-4 align-top text-right">
                        <span className="font-bold text-green-600 text-lg bg-green-50 px-2 py-1 rounded">
                           {formatearPrecio(order.total_amount)} €
                        </span>
                      </td>

                      {/* 6. ACCIÓN */}
                      <td className="p-4 align-top text-center">
                        {order.customer?.phone ? (
                          <button 
                            onClick={() => enviarWhatsApp(order)}
                            className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-3 rounded-lg font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 w-full hover:shadow-lg"
                          >
                            <ExternalLink className="w-4 h-4" /> WA {isIncidence ? 'Incidencia' : ''}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs italic bg-gray-100 px-2 py-1 rounded">Sin Teléfono</span>
                        )}
                      </td>
                    </tr>
                   );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="mt-6 text-center text-xs text-gray-400">
           Sistema interno de {STORE_NAME} • Desarrollado con Vercel
        </div>
      </div>
    </div>
  );
}

export default App;