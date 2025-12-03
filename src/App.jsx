import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Zap, ExternalLink, AlertCircle, MapPin, AlertTriangle, PackageCheck, CheckCircle, Clock, PhoneOutgoing, Filter, MessageCircle, Send, Copy, Check } from 'lucide-react';

// CONFIGURACIÓN DE NOMBRES
const STORE_NAME = 'IBericaStore';
const PRODUCT_NAME_MAP = {
  'Evilgoods_15913': 'Crema EvilGoods'
};

// --- ESTRATEGIA ANTI-BLOQUEO (SPINTAX) ---
// Usamos variaciones para que ningún mensaje sea idéntico al anterior
const VARIACIONES = {
  saludos: ["Hola", "Buenas", "Saludos", "Hola qué tal", "Muy buenas"],
  intros: ["te escribo por tu pedido", "contactamos referente a tu compra", "te hablo sobre el pedido", "vengo a confirmarte el pedido"],
  despedidas: ["Quedo a la espera", "Cualquier cosa me dices", "Espero tu confirmación", "Avísame si todo está bien"]
};

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

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

const formatearPrecio = (amount) => {
  return amount ? amount.toFixed(2).replace('.', ',') : '0,00';
};

// --- GENERADOR MENSAJE: SALUDO CORTO (ESTRATEGIA SEGURA) ---
const generarSaludoCorto = (order) => {
    const nombre = order.customer?.full_name?.split(' ')[0] || 'Cliente'; // Solo primer nombre para ser más natural
    const saludo = getRandom(VARIACIONES.saludos);
    
    // Ej: "Hola Javier, soy de IBericaStore 👋"
    let msg = `${saludo} ${nombre}, soy de ${STORE_NAME} 👋`;
    return { msg, telefono: order.customer?.phone?.replace('+', '') };
};

// --- GENERADOR MENSAJE: PEDIDO NUEVO (CON VARIACIONES) ---
const generarMensajePedido = (order) => {
  const nombre = order.customer?.full_name || 'Cliente';
  const productos = order.items.map(item => `${item.quantity} x ${getNombreProducto(item)}`).join('\n');
  const total = formatearPrecio(order.total_amount);
  const customer = order.customer;
  const tieneDir = !!(customer && customer.address);
  
  // SELECCIÓN ALEATORIA DE PALABRAS
  const saludo = getRandom(VARIACIONES.saludos);
  const intro = getRandom(VARIACIONES.intros);
  const despedida = getRandom(VARIACIONES.despedidas);

  // CONSTRUCCIÓN DEL MENSAJE "NATURAL"
  // Evitamos mayúsculas masivas al principio
  let msg = `👋 ${saludo} ${nombre}, ${intro} número #${order.id}.\n\n`;
  
  msg += `📦 *Resumen:*\n${productos}\n`;
  msg += `💰 *Total:* ${total} €\n\n`; 
  
  if (tieneDir) {
    msg += `📍 *Dirección de envío:*\n`;
    msg += `${customer.address}\n`;
    msg += `${customer.city || ''} (${customer.state || ''})\n`;
    msg += `CP: ${customer.zip || ''}\n\n`;
  }

  msg += "Si ves algún error en la dirección, porfa dímelo por aquí.\n\n";
  msg += `El pedido llegará en 24/48h laborales (8:00 a 19:00). Recuerda tener el importe exacto.\n\n`;
  msg += `${despedida}.`;
  
  return { msg, telefono: customer?.phone?.replace('+', ''), tieneDir };
};

// --- GENERADOR MENSAJE: INCIDENCIA ---
const generarMensajeIncidencia = (order) => {
  const nombre = order.customer?.full_name || 'Cliente';
  const productos = order.items.map(item => `${getNombreProducto(item)}`).join(' | ');
  const total = formatearPrecio(order.total_amount);
  
  let motivoReal = "Incidencia en entrega";
  let codigo = "UNK";

  if (order.issues) {
    codigo = order.issues.incidence_code;
    motivoReal = INCIDENCE_MAP[codigo] || `Incidencia (${codigo})`;
  }

  const saludo = getRandom(VARIACIONES.saludos);

  let msg = `${saludo} ${nombre}, te escribo desde *${STORE_NAME}* 📦\n\n`;
  msg += `Ha habido un problema con la entrega: *${motivoReal}*.\n\n`;
  
  if (codigo === 'RD') {
      msg += `El paquete está pendiente de recoger en la oficina de Tipsa más cercana.\n\n`;
  } else {
      msg += `¿Me podrías confirmar cuándo te viene bien recibirlo de nuevo?\n\n`;
  }
  
  msg += `Pedido: ${productos} (${total}€)`;

  return { msg, telefono: order.customer?.phone?.replace('+', ''), motivo: motivoReal };
};

function App() {
  const [activeTab, setActiveTab] = useState('pending'); 
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mostrarOcultos, setMostrarOcultos] = useState(false);
  const [copiedId, setCopiedId] = useState(null); // Estado para feedback visual de copiado

  // MOCK DATA PARA PRUEBAS (Descomentar para ver visualmente sin backend)
  /*
  useEffect(() => {
     setOrders([{
         id: 1234, created_at: "2023-10-25 10:00:00", total_amount: 29.90,
         customer: { full_name: "Pepe Viyuela", phone: "34666666666", address: "Calle Falsa 123", city: "Madrid", zip: "28001" },
         items: [{ quantity: 1, product: { name: "Shilajit" } }]
     }]);
  }, []);
  */

  const cargarPedidos = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOrders([]); 
    
    // Cambia esto por tu URL real
    const endpoint = activeTab === 'pending' ? '/api/get-orders' : '/api/get-incidences';

    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Error al conectar con el servidor');
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      if (Array.isArray(data)) {
        let finalData = data;

        if (activeTab === 'incidence' && !mostrarOcultos) {
            finalData = finalData.filter(order => order.issues?.status !== 'SOLUTION_SEND');
        }
        
        // Ordenar por fecha
        finalData.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        
        setOrders(finalData);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error(err);
      setError("Modo Demo: No hay conexión API real"); // Mensaje seguro para demo
    } finally {
      setLoading(false);
    }
  }, [activeTab, mostrarOcultos]);

  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

  const enviarWhatsApp = (order, modo = 'completo') => {
    let datos;
    
    if (modo === 'saludo') {
        datos = generarSaludoCorto(order);
    } else {
        datos = activeTab === 'pending' 
          ? generarMensajePedido(order) 
          : generarMensajeIncidencia(order);
    }

    const { msg, telefono } = datos;

    if (!telefono) return alert("Sin teléfono");
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const copiarConfirmacion = (order) => {
    const datos = activeTab === 'pending' 
      ? generarMensajePedido(order) 
      : generarMensajeIncidencia(order);

    navigator.clipboard.writeText(datos.msg)
      .then(() => {
        setCopiedId(order.id);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(err => alert("Error al copiar"));
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
                Gestor {STORE_NAME} <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-200">Modo Anti-Ban Activo</span>
              </h1>
            </div>
            <div className="flex gap-2">
                {activeTab === 'incidence' && (
                    <button 
                        onClick={() => setMostrarOcultos(!mostrarOcultos)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-sm border ${mostrarOcultos ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                    >
                        <Filter className="w-4 h-4" />
                        {mostrarOcultos ? 'Ocultar Gestionados' : 'Ver Todo'}
                    </button>
                )}
                
                <button 
                  onClick={cargarPedidos} 
                  disabled={loading}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Cargando...' : 'Refrescar'}
                </button>
            </div>
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
            <p className="font-bold">Estado:</p>
            <p>{error}</p>
          </div>
        )}

        {/* TABLA */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Fecha</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-48">Cliente</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-64">
                    {activeTab === 'pending' ? 'Dirección' : 'Estado'}
                  </th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Productos</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-56">Acción Segura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.length === 0 && !loading && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500">
                      No hay datos para mostrar.
                    </td>
                  </tr>
                )}
                
                {orders.map((order) => {
                   const isIncidence = activeTab === 'incidence';
                   const { tieneDir } = generarMensajePedido(order); 
                   const isCopied = copiedId === order.id;

                   return (
                    <tr key={order.id} className={`hover:bg-blue-50 transition-colors ${!isIncidence && !tieneDir ? 'bg-red-50' : ''}`}>
                      
                      {/* 1. FECHA */}
                      <td className="p-4 align-top">
                        <span className="block text-xs font-semibold text-gray-400 mb-1">{formatearFecha(order.created_at)}</span>
                        <span className="font-bold text-gray-800 text-lg">#{order.id}</span>
                      </td>

                      {/* 2. CLIENTE */}
                      <td className="p-4 align-top">
                        <div className="font-bold text-gray-900 text-base">{order.customer?.full_name}</div>
                        <div className="text-sm text-blue-600 font-mono mb-2">{order.customer?.phone}</div>
                      </td>

                      {/* 3. INFO */}
                      <td className="p-4 align-top text-sm">
                        {isIncidence ? (
                            <span className="font-bold text-red-600">{order.issues?.incidence_code}</span>
                        ) : (
                            order.customer?.city || "Sin ciudad"
                        )}
                      </td>

                      {/* 4. PRODUCTOS */}
                      <td className="p-4 align-top text-sm text-gray-600">
                        {order.items.map((item, i) => (
                            <div key={i}>{item.quantity}x {getNombreProducto(item)}</div>
                        ))}
                      </td>

                      {/* 6. ACCIONES (LA CLAVE ANTI-BAN) */}
                      <td className="p-4 align-top text-center">
                        {order.customer?.phone ? (
                          <div className="flex flex-col gap-2">
                             
                             {/* PASO 1: SALUDO */}
                             <button 
                               onClick={() => enviarWhatsApp(order, 'saludo')}
                               className="bg-teal-500 hover:bg-teal-600 text-white text-xs px-3 py-2 rounded font-bold shadow transition-all flex items-center justify-center gap-2 w-full"
                               title="Paso 1: Abrir chat y saludar"
                             >
                               <MessageCircle className="w-3 h-3" /> 1. Saludo
                             </button>

                             {/* PASO 2: GESTIÓN DE CONFIRMACIÓN */}
                             <div className="flex gap-1 w-full">
                                {/* Opción A: Abrir WA Completo */}
                                <button 
                                  onClick={() => enviarWhatsApp(order, 'completo')}
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-2 rounded font-bold shadow transition-all flex items-center justify-center gap-1"
                                  title="Abrir WA con todo el texto"
                                >
                                  <ExternalLink className="w-3 h-3" /> WA
                                </button>
                                
                                {/* Opción B: Copiar al Portapapeles (Nueva función) */}
                                <button 
                                  onClick={() => copiarConfirmacion(order)}
                                  className={`flex-1 text-xs px-2 py-2 rounded font-bold shadow transition-all flex items-center justify-center gap-1 ${
                                      isCopied 
                                      ? 'bg-green-600 text-white' 
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                                  }`}
                                  title="Paso 2: Copiar confirmación para pegar manual"
                                >
                                  {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  {isCopied ? 'Copiado' : 'Copiar'}
                                </button>
                             </div>

                          </div>
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
      </div>
    </div>
  );
}

export default App;