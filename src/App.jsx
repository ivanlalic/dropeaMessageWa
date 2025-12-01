import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Zap, ExternalLink, AlertCircle } from 'lucide-react';

// CONFIGURACIÓN DE NOMBRES
const STORE_NAME = 'IBericaStore';
const PRODUCT_NAME_MAP = {
  'Evilgoods_15913': 'Crema EvilGoods'
  // Agrega más aquí si necesitas
};

const getNombreProducto = (item) => {
  const sku = item.product?.sku || '';
  const original = item.product?.name || 'Producto';
  return PRODUCT_NAME_MAP[sku] ? PRODUCT_NAME_MAP[sku] : original;
};

const formatearFecha = (dateString) => {
  if (!dateString) return '';
  const parts = dateString.split(' ')[0].split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateString;
};

// GENERADOR DE MENSAJE (Tu lógica exacta)
const generarMensaje = (order) => {
  const nombre = order.customer?.full_name || 'Cliente';
  
  // Productos
  const productos = order.items
    .map(item => `${item.quantity} x ${getNombreProducto(item)}`)
    .join('\n');
  
  const total = (order.total_amount || 0).toFixed(2);
  const customer = order.customer;
  const tieneDir = !!(customer && customer.address);
  
  let msg = `*GRACIAS POR TU COMPRA EN ${STORE_NAME.toUpperCase()}*\n\n`;
  msg += `¡Hola, ${nombre}!\n\n`;
  msg += `Te confirmamos que hemos recibido tu pedido que incluye lo siguiente:\n${productos}\n\n`;
  msg += `Total: € ${total}\n\n`;
  
  if (tieneDir) {
    msg += `Lo enviaremos a:\n`;
    msg += `Dirección: ${customer.address}\n`;
    msg += `Ciudad: ${customer.city || ''}\n`;
    msg += `Provincia: ${customer.state || ''}\n`;
    msg += `Código Postal: ${customer.zip || ''}\n\n`;
  }

  // TEXTO ADICIONAL SOLICITADO
  msg += "Si falta algo o hay algún error, por favor envíanos la corrección.\n\n";
  msg += "Tu pedido será entregado entre las 8 y 19 horas en la dirección indicada en las próximas 24/48 horas laborales. Por favor recuerde tener el importe exacto.\n\n";
  
  msg += STORE_NAME;
  
  return { 
    msg, 
    telefono: customer?.phone?.replace('+', ''), 
    tieneDir 
  };
};

function App() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cargarPedidos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Llamamos a NUESTRO backend (api/get-orders)
      const res = await fetch('/api/get-orders');
      if (!res.ok) throw new Error('Error al conectar con el servidor');
      const data = await res.json();
      
      // Si devolvió error el backend
      if (data.error) throw new Error(data.error);

      // Si es un array, lo procesamos
      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

  const enviarWhatsApp = (order) => {
    const { msg, telefono } = generarMensaje(order);
    if (!telefono) return alert("Sin teléfono");
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-gray-800">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
              <Zap className="text-yellow-500 fill-current" />
              Gestor de Pedidos {STORE_NAME}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Pedidos <strong>PENDING</strong> (Últimos 5 días + Hoy + Mañana)
            </p>
          </div>
          <button 
            onClick={cargarPedidos} 
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Actualizando...' : 'Actualizar Lista'}
          </button>
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
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="p-4 text-xs font-bold text-gray-600 uppercase">Fecha / ID</th>
                  <th className="p-4 text-xs font-bold text-gray-600 uppercase">Cliente</th>
                  <th className="p-4 text-xs font-bold text-gray-600 uppercase">Productos</th>
                  <th className="p-4 text-xs font-bold text-gray-600 uppercase text-right">Total</th>
                  <th className="p-4 text-xs font-bold text-gray-600 uppercase text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.length === 0 && !loading && !error && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500">
                      No hay pedidos pendientes en este momento.
                    </td>
                  </tr>
                )}
                
                {orders.map((order) => {
                   const { tieneDir } = generarMensaje(order);
                   return (
                    <tr key={order.id} className={`hover:bg-blue-50 transition-colors ${!tieneDir ? 'bg-red-50' : ''}`}>
                      <td className="p-4 align-top">
                        <span className="block font-mono text-xs text-gray-500">{formatearFecha(order.created_at)}</span>
                        <span className="font-bold text-gray-700">#{order.external_order_id || order.id}</span>
                      </td>
                      <td className="p-4 align-top">
                        <div className="font-medium">{order.customer?.full_name}</div>
                        <div className="text-sm text-gray-500">{order.customer?.phone}</div>
                        {!tieneDir && (
                           <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
                             <AlertCircle className="w-3 h-3"/> Falta Dir
                           </span>
                        )}
                      </td>
                      <td className="p-4 align-top text-sm text-gray-600">
                        <ul className="list-disc list-inside">
                          {order.items.map((item, i) => (
                            <li key={i}>{item.quantity}x {getNombreProducto(item)}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="p-4 align-top text-right font-bold text-green-600">
                        €{order.total_amount?.toFixed(2)}
                      </td>
                      <td className="p-4 align-top text-center">
                        {order.customer?.phone ? (
                          <button 
                            onClick={() => enviarWhatsApp(order)}
                            className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg font-medium shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2 w-full"
                          >
                            <ExternalLink className="w-4 h-4" /> WhatsApp
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Sin Teléfono</span>
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