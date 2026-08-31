export function authMessage(raw: string) {
  const text = raw.toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Se você acabou de cadastrar um e-mail que já existia, a senha antiga continua valendo.";
  }
  if (text.includes("email not confirmed")) {
    return "Confirme o e-mail antes de entrar.";
  }
  return raw;
}
