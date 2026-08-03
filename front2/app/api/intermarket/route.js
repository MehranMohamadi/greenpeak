export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const series = searchParams.get("series");

    if (!series) {
      return Response.json({ error: "Missing series" }, { status: 400 });
    }

    const apiKey = process.env.FRED_API_KEY;

    const url =
      `https://api.stlouisfed.org/fred/series/observations?` +
      `series_id=${series}&api_key=${apiKey}&file_type=json`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      return Response.json(
        { error: "FRED Fetch Failed", status: res.status },
        { status: 500 }
      );
    }

    const json = await res.json();

    return Response.json({
      series,
      data: json.observations, // [{date, value}, ...]
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}