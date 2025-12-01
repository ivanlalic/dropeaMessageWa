export default async function handler(req, res) {
  const API_ENDPOINT = 'https://api.dropea.com/graphql/dropshippers';
  // Vercel buscará esta clave en sus variables de entorno
  const API_KEY = process.env.DROPEA_API_KEY; 

  if (!API_KEY) {
    return res.status(500).json({ error: 'Falta la API Key en la configuración de Vercel' });
  }

  // Calculamos fechas: Miramos los últimos 15 días para no perder incidencias vivas
  const today = new Date();
  
  // Fecha fin: Mañana
  const endDateObj = new Date();
  endDateObj.setDate(today.getDate() + 1); 
  const endDate = endDateObj.toISOString().split('T')[0].split('-').reverse().join('-'); 

  // Fecha inicio: Hace 15 días
  const startDateObj = new Date();
  startDateObj.setDate(today.getDate() - 15); 
  const startDate = startDateObj.toISOString().split('T')[0].split('-').reverse().join('-'); 

  // QUERY CORREGIDA (Sort: CREATED_AT para evitar error de Dropea)
  const query = `
    query GetIncidenceOrders($page: Int!, $perPage: Int!, $dateField: FilterDateEnum!, $startDate: String!, $endDate: String!) {
      orders(
        page: $page, 
        limit: $perPage,
        status: INCIDENCE, 
        date_field: $dateField,
        start_date: $startDate,
        end_date: $endDate,
        sort: CREATED_AT, 
        direction: DESC
      ) {
        data {
          id
          created_at
          external_order_id
          status
          customer {
            full_name
            phone
            address
            city
            state
            zip
          }
          items {
            product {
              name
              sku
            }
            quantity
          }
          total_amount
          issues {
            description
            incidence_code
            status
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        query: query,
        variables: {
          page: 1,
          perPage: 50,
          dateField: 'UPDATED_AT', // Filtramos por cuando se actualizó la incidencia
          startDate: startDate,
          endDate: endDate
        }
      })
    });

    const json = await response.json();

    if (json.errors) {
        console.error("Error Dropea:", json.errors);
        return res.status(500).json({ error: 'Error en la respuesta de Dropea' });
    }

    return res.status(200).json(json.data.orders.data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}