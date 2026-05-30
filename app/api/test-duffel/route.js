export async function GET() {
  const response = await fetch('https://api.duffel.com/air/airlines', {
    headers: {
      'Authorization': `Bearer ${process.env.DUFFEL_API_KEY}`,
      'Duffel-Version': 'v2'
    }
  });
  const data = await response.json();
  return Response.json(data, { status: response.status });
}
