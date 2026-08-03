// app/api/market/sp500/route.ts
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const API_KEY = process.env.ALPHA_VANTAGE_KEY;

    const url =
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=SPY&apikey=${API_KEY}`;

    const res = await fetch(url, {
      next: { revalidate: 60 }, // کش ۱ دقیقه‌ای
    });

    const json = await res.json();

    if (!json["Time Series (Daily)"]) {
      return Response.json(
        { error: "Invalid API response" },
        { status: 500 }
      );
    }

    const data = Object.entries(json["Time Series (Daily)"])
      .slice(0, 100)
      .map(([date, values]) => ({
        time: new Date(date).getTime(),
        open: +values["1. open"],
        high: +values["2. high"],
        low: +values["3. low"],
        close: +values["4. close"],
        volume: +values["5. volume"],
      }))
      .reverse();

    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: "Failed to fetch market data" },
      { status: 500 }
    );
  }
}