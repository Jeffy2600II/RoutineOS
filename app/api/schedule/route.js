import { NextResponse } from "next/server";
import schedule from "../../../data/schedule.json"; // ปรับ Path ให้ถูกต้อง

export async function GET() {
  return NextResponse.json(schedule);
}