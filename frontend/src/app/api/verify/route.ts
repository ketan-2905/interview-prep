import { type NextRequest } from "next/server";

export async function POST(request: Request) {
  const { pass } = await request.json()

  console.log(pass);
  
  if (pass === process.env.USE_FEATURE_PASSWORD) {
    return Response.json({ allowed: true })
  }

  return Response.json({ allowed: false }, { status: 403 })
}
