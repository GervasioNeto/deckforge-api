// Contas antigas nao tem nome salvo; sem isso o autor apareceria em branco.
export const PUBLIC_NAME_FALLBACK = "Jogador";

export function publicName(name: string): string {
  return name.trim() || PUBLIC_NAME_FALLBACK;
}
