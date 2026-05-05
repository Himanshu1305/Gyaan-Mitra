import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { name, email, message } = await req.json();

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return Response.json({ error: "All fields are required." }, { status: 400 });
  }

  const { error } = await supabase.from("contact_submissions").insert([
    { name: name.trim(), email: email.trim(), message: message.trim() },
  ]);

  if (error) {
    console.error("Supabase contact error:", error.message);
    return Response.json(
      { error: "Could not save your message. Please try again." },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}
