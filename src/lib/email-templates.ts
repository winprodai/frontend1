import type { NextApiRequest, NextApiResponse } from "next"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client with admin privileges
const supabaseAdmin = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_KEY || "")

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check if the user is authenticated and has admin privileges
  // This is a simplified example - you should implement proper authentication

  if (req.method === "GET") {
    try {
      const { data, error } = await supabaseAdmin.from("email_templates").select("*").order("name")

      if (error) throw error

      return res.status(200).json(data)
    } catch (error) {
      console.error("Error fetching email templates:", error)
      return res.status(500).json({ error: "Failed to fetch email templates" })
    }
  } else if (req.method === "POST") {
    try {
      const { name, subject, body } = req.body

      if (!name || !subject || !body) {
        return res.status(400).json({ error: "Name, subject, and body are required" })
      }

      const { data, error } = await supabaseAdmin.from("email_templates").insert([{ name, subject, body }]).select()

      if (error) throw error

      return res.status(201).json(data[0])
    } catch (error) {
      console.error("Error creating email template:", error)
      return res.status(500).json({ error: "Failed to create email template" })
    }
  } else if (req.method === "PUT") {
    try {
      const { id, name, subject, body } = req.body

      if (!id || !name || !subject || !body) {
        return res.status(400).json({ error: "ID, name, subject, and body are required" })
      }

      const { data, error } = await supabaseAdmin
        .from("email_templates")
        .update({ name, subject, body, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()

      if (error) throw error

      return res.status(200).json(data[0])
    } catch (error) {
      console.error("Error updating email template:", error)
      return res.status(500).json({ error: "Failed to update email template" })
    }
  } else if (req.method === "DELETE") {
    try {
      const { id } = req.query

      if (!id) {
        return res.status(400).json({ error: "ID is required" })
      }

      const { error } = await supabaseAdmin.from("email_templates").delete().eq("id", id)

      if (error) throw error

      return res.status(204).end()
    } catch (error) {
      console.error("Error deleting email template:", error)
      return res.status(500).json({ error: "Failed to delete email template" })
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" })
  }
}

