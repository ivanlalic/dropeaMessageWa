import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Zap, ExternalLink, AlertCircle, MapPin, AlertTriangle, PackageCheck, CheckCircle, Clock, PhoneOutgoing, Filter, MessageCircle, Send, Copy, Check } from 'lucide-react';

// CONFIGURACIÓN DE NOMBRES
const STORE_NAME = 'IBericaStore';
const PRODUCT_NAME_MAP = {
  'Evilgoods_15913': 'Crema EvilGoods'
};

// --- ESTRATEGIA: HUMANIZACIÓN (NOMBRES + VARIACIONES) ---
const NOMBRES_AGENTE = ["Inés", "María", "Ana", "Laura", "Carmen"];

const VARIACIONES = {
  saludos: ["Hola", "Buenas", "Saludos", "Hola qué tal", "Muy buenas"],
  // INTROS: Para mensaje COMPLETO (cuando NO has saludado antes)
  intros: ["te escribo por tu pedido", "contactamos referente a tu compra", "te hablo sobre el pedido", "vengo a confirmarte el pedido"],
  
  // TRANSICIONES NEUTRAS: Para mensaje COPIADO (Funciona con o sin respuesta del cliente)
  transiciones: [
      "Aquí tienes los detalles del pedido", 
      "Te paso el resumen de tu compra", 
      "Te confirmo los datos recibidos del pedido", 
      "Esta es la información de tu pedido",
      "Te dejo por aquí el resumen"
  ],
  
  despedidas: ["Quedo a la espera", "Cualquier cosa me dices", "Espero tu confirmación", "Avísame si todo está bien"]
};

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

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

// --- GENERADORES DE MENSAJES ---

// 1. SOLO SALUDO
const generarSaludoCorto = (order) => {
    const nombre = order.customer?.full_name?.split(' ')[0] || 'Cliente'; 
    const saludo = getRandom(VARIACIONES.saludos);
    const agente = getRandom(NOMBRES_AGENTE);
    let msg = `${saludo} ${nombre}, soy ${agente} de ${STORE_NAME}.`;
    return { msg, telefono: order.customer?.phone?.replace('+', '') };
};

// 2. PEDIDO (Soporta modo 'completo' o 'continuacion')
const generarMensajePedido = (order, esContinuacion = false) => {
  const nombre = order.customer?.full_name || 'Cliente';
  const productos = order.items.map(item => `- ${item.quantity} x ${getNombreProducto(item)}`).join('\n');
  const total = formatearPrecio(order.total_amount);
  const customer = order.customer;
  const tieneDir = !!(customer && customer.address);
  
  const saludo = getRandom(VARIACIONES.saludos);
  const intro = getRandom(VARIACIONES.intros);
  const transicion = getRandom(VARIACIONES.transiciones); 
  const despedida = getRandom(VARIACIONES.despedidas);
  const agente = getRandom(NOMBRES_AGENTE);

  let msg = "";

  if (esContinuacion) {
      // MODO CONTINUACIÓN (Neutro, sin asumir respuesta)
      msg += `${transicion} número #${order.id}.\n\n`;
  } else {
      // MODO COMPLETO (Saludo + Presentación + Datos)
      msg += `${saludo} ${nombre}, soy ${agente}.\n`;
      msg += `${intro} número #${order.id}.\n\n`;
  }
  
  msg += `*Resumen:*\n${productos}\n`;
  msg += `*Total:* ${total} EUR\n\n`; 
  
  if (tieneDir) {
    msg += `*Dirección de envío:*\n`;
    msg += `${customer.address}\n`;
    msg += `${customer.city || ''} (${customer.state || ''})\n`;
    msg += `CP: ${customer.zip || ''}\n\n`;
  }

  msg += "Si la dirección está mal, por favor dímelo.\n\n";
  msg += `El pedido llegará en 24/48h laborales. Importe exacto por favor.\n\n`;
  msg += `${despedida}.`;
  
  return { msg, telefono: customer?.phone?.replace('+', ''), tieneDir };
};

// 3. INCIDENCIA (Soporta modo 'completo' o 'continuacion')
const generarMensajeIncidencia = (order, esContinuacion = false) => {
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
  const agente = getRandom(NOMBRES_AGENTE);

  let msg = "";

  if (esContinuacion) {
      // MODO CONTINUACIÓN (Neutro)
      msg += `Te contacto porque tenemos un problema con la entrega: *${motivoReal}*.\n\n`;
  } else {
      // MODO COMPLETO
      msg += `${saludo} ${nombre}, soy ${agente} de *${STORE_NAME}*.\n\n`;
      msg += `Tenemos un problema con la entrega: *${motivoReal}*.\n\n`;
  }
  
  if (codigo === 'RD') {
      msg += `El paquete está pendiente de recoger en la oficina de Tipsa más cercana.\n\n`;
  } else {
      msg += `¿Cuándo te viene bien recibirlo de nuevo?\n\n`;
  }
  
  msg += `Pedido: ${productos} (${total} EUR)`;

  return { msg, telefono: order.customer?.phone?.replace('+', ''), motivo: motivoReal };
};

function App() {
  const [activeTab, setActiveTab] = useState('pending'); 
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mostrarOcultos, setMostrarOcultos] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

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

        if (activeTab === 'incidence' && !mostrarOcultos) {
            finalData = finalData.filter(order => order.issues?.status !== 'SOLUTION_SEND');
        }
        
        finalData.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        
        setOrders(finalData);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error(err);
      setError("Modo Demo: No hay conexión API real");
    } finally {
      setLoading(false);
    }
  }, [activeTab, mostrarOcultos]);

  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

  const enviarWhatsApp = (order, modo) => {
    let datos;
    
    if (modo === 'saludo') {
        datos = generarSaludoCorto(order);
    } else {
        datos = activeTab === 'pending' 
          ? generarMensajePedido(order, false) 
          : generarMensajeIncidencia(order, false);
    }

    const { msg, telefono } = datos;
    if (!telefono) return alert("Sin teléfono");
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const copiarConfirmacion = (order) => {
    const datos = activeTab === 'pending' 
      ? generarMensajePedido(order, true) 
      : generarMensajeIncidencia(order, true);

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
                Gestor {STORE_NAME} <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-200">Modo Conversacional</span>
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
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-56">Flujo Anti-Ban</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => {
                   const isIncidence = activeTab === 'incidence';
                   const { tieneDir } = generarMensajePedido(order); 
                   const isCopied = copiedId === order.id;

                   // URL Google Maps para el botón
                   const direccionBusqueda = `${order.customer?.address} ${order.customer?.city} ${order.customer?.zip}`;
                   const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionBusqueda)}`;

                   return (
                    <tr key={order.id} className={`hover:bg-blue-50 transition-colors ${!isIncidence && !tieneDir ? 'bg-red-50' : ''}`}>
                      <td className="p-4 align-top">
                        <span className="block text-xs font-semibold text-gray-400 mb-1">{formatearFecha(order.created_at)}</span>
                        <span className="font-bold text-gray-800 text-lg">#{order.id}</span>
                      </td>
                      <td className="p-4 align-top">
                        <div className="font-bold text-gray-900 text-base">{order.customer?.full_name}</div>
                        <div className="text-sm text-blue-600 font-mono mb-2">{order.customer?.phone}</div>
                      </td>

                      {/* COLUMNA DIRECCIÓN / ESTADO RESTAURADA */}
                      <td className="p-4 align-top text-sm">
                        {isIncidence ? (
                            <span className="font-bold text-red-600">{order.issues?.incidence_code}</span>
                        ) : (
                             tieneDir ? (
                                <div className="flex items-start gap-2">
                                  {/* Caja Dirección + Maps */}
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
                                  {/* Botón Distrito Postal */}
                                  <a href="https://distritopostal.es/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center p-2 bg-white border border-gray-200 rounded hover:bg-gray-50 shadow-sm h-10 w-10 flex-shrink-0" title="Verificar Distrito Postal">
                                    <img src="https://www.google.com/s2/favicons?domain=distritopostal.es&sz=32" alt="DP" className="w-5 h-5 opacity-70 hover:opacity-100" />
                                  </a>
                                </div>
                             ) : (
                                <div className="inline-flex items-center gap-1 px-3 py-1 rounded bg-red-100 text-red-700 border border-red-200 text-xs font-bold shadow-sm">
                                   <AlertCircle className="w-4 h-4"/> FALTA DIRECCIÓN
                                </div>
                             )
                        )}
                      </td>

                      <td className="p-4 align-top text-sm text-gray-600">
                        {order.items.map((item, i) => (
                            <div key={i}>{item.quantity}x {getNombreProducto(item)}</div>
                        ))}
                      </td>
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
                                {/* Opción A: Abrir WA Completo (Botón Azul) */}
                                <button 
                                  onClick={() => enviarWhatsApp(order, 'completo')}
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-2 rounded font-bold shadow transition-all flex items-center justify-center gap-1"
                                  title="Abrir WA con mensaje COMPLETO (Si no usaste el paso 1)"
                                >
                                  <ExternalLink className="w-3 h-3" /> WA
                                </button>
                                
                                {/* Opción B: Copiar Mensaje Continuación (Botón Gris/Verde) */}
                                <button 
                                  onClick={() => copiarConfirmacion(order)}
                                  className={`flex-1 text-xs px-2 py-2 rounded font-bold shadow transition-all flex items-center justify-center gap-1 ${
                                      isCopied 
                                      ? 'bg-green-600 text-white' 
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                                  }`}
                                  title="Paso 2: Copiar mensaje de CONTINUACIÓN (Sin saludo repetido)"
                                >
                                  {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  {isCopied ? 'Listo' : 'Copiar'}
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