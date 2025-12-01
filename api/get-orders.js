export default async function handler(req, res) {
  // CONFIGURACIÓN INTERNA
  const API_ENDPOINT = 'https://api.dropea.com/graphql/dropshippers';
  // Vercel buscará esta clave en sus variables de entorno
  const API_KEY = process.env.DROPEA_API_KEY; 

  if (!API_KEY) {
    return res.status(500).json({ error: 'Falta la API Key en la configuración de Vercel' });
  }

  // CALCULO DE FECHAS (Igual que en tu script, ajustado a JS moderno)
  const today = new Date();
  
  // Fecha fin: Hoy + 2 días (para cubrir diferencia horaria España)
  const endDateObj = new Date();
  endDateObj.setDate(today.getDate() + 2);
  const endDate = endDateObj.toISOString().split('T')[0].split('-').reverse().join('-'); // dd-mm-yyyy

  // Fecha inicio: Hoy - 5 días
  const startDateObj = new Date();
  startDateObj.setDate(today.getDate() - 5);
  const startDate = startDateObj.toISOString().split('T')[0].split('-').reverse().join('-'); // dd-mm-yyyy

  // LA QUERY DE GRAPHQL
  const query = `
    query GetPendingOrders($page: Int!, $perPage: Int!, $dateField: FilterDateEnum!, $startDate: String!, $endDate: String!) {
      orders(
        page: $page, 
        limit: $perPage,
        status: PENDING,
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
            first_name
            last_name
            phone
            email
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
        }
        has_more_pages
      }
    }
  `;

  try {
    // LLAMADA A DROPEA (backend a backend)
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
          perPage: 50, // Traemos los últimos 50
          dateField: 'CREATED_AT',
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

    // Devolvemos los datos limpios al Frontend
    return res.status(200).json(json.data.orders.data);

  } catch (error) {
    console.error("Error Serverless:", error);
    return res.status(500).json({ error: error.message });
  }
}