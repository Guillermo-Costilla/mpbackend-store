// Stub para satisfacer imports. Integra tu proveedor real si lo necesitas.
export async function enviarCorreo({ to, subject, html }) {
  console.log("📧 [mailer stub] Enviando correo:", { to, subject, htmlLength: html?.length })
  return { success: true }
}
