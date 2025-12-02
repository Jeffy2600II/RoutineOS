import { NextResponse } from "next/server";
import schedule from "@/data/schedule.json";

export async function GET() {
  return NextResponse.json(schedule);
}