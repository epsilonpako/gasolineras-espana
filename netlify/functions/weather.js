exports.handler = async (event, context) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  const params = event.queryStringParameters || {};

  const city = params.city;
  const lat = params.lat;
  const lon = params.lon;

  let url;

  if (city) {
    url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=es`;
  } else if (lat && lon) {
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=es`;
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Parámetros insuficientes' }),
    };
  }

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify(data),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error fetching weather data' }),
    };
  }
};