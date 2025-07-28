exports.handler = async (event, context) => {
  const apiKey = process.env.OPENCHARGE_API_KEY;
  const { latitude, longitude, distance } = event.queryStringParameters;
  
  try {
    const response = await fetch(`https://api.openchargemap.io/v3/poi/?output=json&latitude=${latitude}&longitude=${longitude}&distance=${distance}&maxresults=20&key=${apiKey}`);
    const data = await response.json();
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error fetching charging stations data' })
    };
  }
};